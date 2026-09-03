"""API do Prospectar (lead-king) -- base que substitui a Supabase.

MODELO DIFERENTE DO CONCORRENTES: aqui e workspace unico e compartilhado,
nao dado isolado por usuario. Contacts/listas/buscas sao visiveis a
qualquer usuario autenticado; o que muda por papel (admin/supervisor/agent)
e quem pode mexer em configuracao e chaves.

AUTORIZACAO NA CAMADA DE SERVICO, mesmo motivo do concorrentes: o schema
portado tem 9 funcoes (vault_*, get_vault_key etc.) que referenciam vault/
auth.uid() que nao existem na VPS -- quebram na primeira chamada. Este
servico nao as usa.

CADASTRO: replica a logica de handle_new_user() (trigger orfao no banco,
nunca ligado -- nao ha auth.users aqui). Primeiro usuario = admin,
aprovado. Demais = agent, aprovado conforme project_config.
require_account_approval (default: aprovado, ja que is_approved nao e
sequer checado pelo front hoje -- ver docs/05_Pendencias.md do projeto).

O QUE E REAL: auth, settings, onboarding, as 7 chaves de API (COM
validacao de verdade contra o provedor, nao 501), contacts/listas/buscas
(leitura e escrita basica).
O QUE E 501: tudo que gera resultado de terceiro -- busca de lead
(Apollo/Apify/Tavily/PDL/CrustData), enriquecimento, geração de abordagem
por IA, envio de WhatsApp/e-mail. Falham alto dizendo o que falta.
"""
import datetime
import json
import random
import re
import secrets as segredos
import time
import uuid

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

import auth
import db

app = FastAPI(title="Prospectar API", version="0.1.0")

ORIGENS = [o.strip() for o in db.CFG.get(
    "LEADKING_CORS_ORIGENS",
    "http://localhost:3000,https://prospectar.imagohub.com.br",
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHAVE_CRIPTO = db.CFG.get("LEADKING_CRIPTO_CHAVE")
WEBHOOK_SEGREDO = db.CFG.get("LEADKING_WEBHOOK_SEGREDO")
if not WEBHOOK_SEGREDO:
    raise RuntimeError(
        "LEADKING_WEBHOOK_SEGREDO ausente em api/.env -- o webhook nao pode "
        "subir sem segredo: e o unico controle de acesso que ele tem."
    )
if not CHAVE_CRIPTO:
    raise RuntimeError(
        "LEADKING_CRIPTO_CHAVE ausente em api/.env -- sem ela as chaves de "
        "API dos provedores ficariam em texto puro. O servico nao sobe."
    )

FALTA_TERCEIRO = (
    "Operacao ainda nao portada da Supabase. Depende de servico externo "
    "({servico}), que e a segunda camada do desacoplamento."
)

SERVICOS_CONHECIDOS = ["apollo", "apify", "crustdata", "tavily", "pdl", "evolution", "resend"]


# ----------------------------------------------------------------- modelos
class Credenciais(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=8)
    nome: str | None = None


class SalvarSettings(BaseModel):
    workspace_name: str | None = None
    default_country: str | None = None
    default_language: str | None = None
    default_volume: int | None = None
    auto_enrich: bool | None = None
    evolution_api_url: str | None = None
    evolution_instance_name: str | None = None
    resend_from_email: str | None = None
    resend_from_name: str | None = None


class SalvarChave(BaseModel):
    service_name: str
    api_key: str = Field(min_length=4)
    label: str | None = None
    evolution_api_url: str | None = None
    validate_only: bool = False


class NovaLista(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = ""


class NovaBusca(BaseModel):
    name: str = Field(min_length=1)
    # valores reais aceitos pela CHECK constraint (medido em 01/09, nao
    # documentado em lugar nenhum antes disso): apollo_search, google_maps,
    # crustdata_search, pdl_search, tavily_search, e uma familia grande de
    # apify_*. "apollo" sozinho NAO e aceito.
    source: str = "apollo_search"
    config: dict = {}
    target_list_id: uuid.UUID | None = None


class AtualizarContato(BaseModel):
    status: str | None = None
    score: int | None = None
    tags: list[str] | None = None
    custom_fields: dict | None = None


# ------------------------------------------------------------------- saude
@app.get("/saude")
def saude():
    linha = db.um("select count(*) as n from public.contacts")
    return {"ok": True, "banco": "prospectar", "contacts": linha["n"]}


# --------------------------------------------------------------- identidade
@app.post("/auth/signup", status_code=201)
def signup(c: Credenciais):
    ja = db.um("select id from public.usuario where lower(email) = lower(%s)", (c.email,))
    if ja:
        raise HTTPException(409, "Ja existe uma conta com esse e-mail.")

    # replica handle_new_user(): primeiro usuario = admin + aprovado.
    total = db.um("select count(*) as n from public.profiles")["n"]
    primeiro = total == 0
    exige_aprovacao = db.um(
        "select value from public.project_config where key = 'require_account_approval'"
    )
    precisa_aprovar = (exige_aprovacao or {}).get("value") == "true"
    aprovado = True if primeiro else (not precisa_aprovar)
    papel = "admin" if primeiro else "agent"

    nome = c.nome or c.email.split("@")[0]
    novo = db.um(
        "insert into public.usuario (email, nome, senha_hash) "
        "values (%s, %s, %s) returning id, email, nome",
        (c.email, nome, auth.hash_senha(c.senha)),
    )
    db.executar(
        "insert into public.profiles (id, full_name, email, is_approved) "
        "values (%s, %s, %s, %s)",
        (novo["id"], nome, novo["email"], aprovado),
    )
    db.executar(
        "insert into public.user_roles (user_id, role) values (%s, %s)",
        (novo["id"], papel),
    )
    token, expira = auth.gerar_token(novo["id"], novo["email"])
    return {"token": token, "expiraEm": expira, "usuario": novo, "role": papel}


@app.post("/auth/login")
def login(c: Credenciais):
    u = db.um(
        "select id, email, nome, senha_hash, ativo from public.usuario "
        "where lower(email) = lower(%s)",
        (c.email,),
    )
    if not u or not auth.confere_senha(c.senha, u["senha_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos.")
    if not u["ativo"]:
        raise HTTPException(403, "Conta desativada.")
    token, expira = auth.gerar_token(u["id"], u["email"])
    return {
        "token": token, "expiraEm": expira,
        "usuario": {"id": u["id"], "email": u["email"], "nome": u["nome"]},
    }


@app.get("/auth/me")
def me(u=Depends(auth.usuario_atual)):
    p = db.um(
        "select full_name, is_approved from public.profiles where id = %s", (u["id"],)
    )
    return {"usuario": u, "perfil": {**(p or {}), "role": u["role"]}}


# ------------------------------------------------------------------ settings
@app.get("/settings")
def ver_settings(u=Depends(auth.usuario_atual)):
    s = db.um("select * from public.settings limit 1")
    if not s:
        s = db.um(
            "insert into public.settings (workspace_name) values ('ProspectAI') returning *"
        )
    return s


@app.put("/settings")
def salvar_settings(s: SalvarSettings, _u=Depends(auth.exige_role("admin"))):
    campos = {k: v for k, v in s.model_dump().items() if v is not None}
    if not campos:
        return db.um("select * from public.settings limit 1")
    existe = db.um("select id from public.settings limit 1")
    if existe:
        sets = ", ".join(f"{k} = %s" for k in campos)
        db.executar(
            f"update public.settings set {sets} where id = %s",
            (*campos.values(), existe["id"]),
        )
    else:
        cols = ", ".join(campos.keys())
        vals = ", ".join(["%s"] * len(campos))
        db.executar(
            f"insert into public.settings ({cols}) values ({vals})",
            tuple(campos.values()),
        )
    return db.um("select * from public.settings limit 1")


# ---------------------------------------------------------------- onboarding
@app.get("/onboarding")
def ver_onboarding(u=Depends(auth.usuario_atual)):
    pronto = db.um(
        "select exists(select 1 from public.api_keys_registry "
        "where service_name = 'apollo' and is_active = true) as v"
    )["v"]
    completou = db.um(
        "select 1 from public.user_onboarding where user_id = %s", (u["id"],)
    )
    return {
        "workspace_ready": bool(pronto),
        "user_completed": completou is not None,
        "is_admin": u["role"] == "admin",
    }


@app.post("/onboarding/complete", status_code=204)
def completar_onboarding(u=Depends(auth.usuario_atual)):
    db.executar(
        "insert into public.user_onboarding (user_id) values (%s) "
        "on conflict (user_id) do update set completed_at = now()",
        (u["id"],),
    )


@app.post("/onboarding/reset", status_code=204)
def resetar_onboarding(u=Depends(auth.usuario_atual)):
    db.executar("delete from public.user_onboarding where user_id = %s", (u["id"],))


# --------------------------------------------------------- chaves de API
def _validar_chave(servico: str, chave: str, url_evolution: str | None = None) -> dict:
    """Testa a chave contra o provedor de verdade. Mesma logica do
    api-keys-save original, portada -- nao e 501 porque e so uma chamada
    HTTP de teste, sem dependencia de infra que nao temos."""
    try:
        with httpx.Client(timeout=10) as cli:
            if servico == "apollo":
                r = cli.get("https://api.apollo.io/api/v1/auth/health",
                           headers={"x-api-key": chave})
                d = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                if d.get("is_logged_in") is not True:
                    return {"valid": False, "message": "Apollo: chave invalida ou sem permissao"}
                probe = cli.post("https://api.apollo.io/api/v1/mixed_people/api_search",
                                 headers={"x-api-key": chave},
                                 json={"per_page": 1, "page": 1})
                if probe.status_code == 403:
                    return {"valid": True, "message": "Conectado ao Apollo.io (plano FREE)",
                            "warning": "Plano FREE: a API de busca esta bloqueada, buscas retornarao zero resultados."}
                return {"valid": True, "message": "Conectado ao Apollo.io"}
            if servico == "apify":
                r = cli.get("https://api.apify.com/v2/acts?limit=1",
                           headers={"Authorization": f"Bearer {chave}"})
                return {"valid": r.status_code == 200, "message": "Conectado ao Apify" if r.status_code == 200 else f"Apify: {r.status_code}"}
            if servico == "crustdata":
                r = cli.post("https://api.crustdata.com/screener/person/search",
                            headers={"authorization": f"Bearer {chave}", "x-api-version": "2025-11-01"},
                            json={"filters": {"field": "basic_profile.headline", "type": "(.)", "value": "test"}, "limit": 1})
                return {"valid": r.status_code == 200, "message": "Conectado ao CrustData" if r.status_code == 200 else f"CrustData: {r.status_code}"}
            if servico == "tavily":
                r = cli.post("https://api.tavily.com/search",
                            json={"api_key": chave, "query": "test", "max_results": 1})
                return {"valid": r.status_code == 200, "message": "Conectado ao Tavily" if r.status_code == 200 else f"Tavily: {r.status_code}"}
            if servico == "pdl":
                r = cli.get("https://api.peopledatalabs.com/v5/person/search",
                           params={"size": 1, "query": '{"query":{"match_all":{}}}'},
                           headers={"X-Api-Key": chave})
                return {"valid": r.status_code in (200, 402), "message": "Conectado ao People Data Labs" if r.status_code in (200, 402) else f"PDL: {r.status_code}"}
            if servico == "resend":
                r = cli.get("https://api.resend.com/domains", headers={"Authorization": f"Bearer {chave}"})
                return {"valid": r.status_code == 200, "message": "Conectado ao Resend" if r.status_code == 200 else f"Resend: {r.status_code}"}
            if servico == "evolution":
                if not url_evolution:
                    return {"valid": False, "message": "URL da Evolution e obrigatoria para validar"}
                r = cli.get(f"{url_evolution.rstrip('/')}/instance/fetchInstances", headers={"apikey": chave})
                return {"valid": r.status_code == 200, "message": "Conectado a Evolution API" if r.status_code == 200 else f"Evolution: {r.status_code}"}
            return {"valid": False, "message": "Servico desconhecido"}
    except httpx.RequestError as e:
        return {"valid": False, "message": f"Erro ao validar: {e}"}


@app.get("/api-keys")
def listar_chaves(_u=Depends(auth.exige_role("admin"))):
    linhas = db.varios(
        "select service_name, label, validation_status, last_validated_at, updated_at "
        "from public.api_keys_registry where is_active = true"
    )
    por_servico = {l["service_name"]: l for l in linhas}
    return {
        s: {
            "service_name": s,
            "configured": s in por_servico,
            "validation_status": por_servico.get(s, {}).get("validation_status", "unknown"),
            "last_validated_at": por_servico.get(s, {}).get("last_validated_at"),
            "label": por_servico.get(s, {}).get("label"),
            "updated_at": por_servico.get(s, {}).get("updated_at"),
        }
        for s in SERVICOS_CONHECIDOS
    }


@app.post("/api-keys")
def salvar_chave(c: SalvarChave, admin=Depends(auth.exige_role("admin"))):
    if c.service_name not in SERVICOS_CONHECIDOS:
        raise HTTPException(400, "service_name invalido")
    resultado = _validar_chave(c.service_name, c.api_key.strip(), c.evolution_api_url)
    if c.validate_only:
        return resultado
    if not resultado["valid"]:
        raise HTTPException(400, resultado["message"])
    db.executar(
        "insert into public.api_keys_registry "
        "(user_id, service_name, encrypted_secret, label, validation_status, last_validated_at) "
        "values (%s, %s, pgp_sym_encrypt(%s, %s), %s, 'valid', now()) "
        "on conflict (service_name) do update set "
        "encrypted_secret = excluded.encrypted_secret, label = excluded.label, "
        "validation_status = 'valid', last_validated_at = now(), is_active = true, "
        "user_id = excluded.user_id",
        (admin["id"], c.service_name, c.api_key.strip(), CHAVE_CRIPTO, c.label),
    )
    return {"success": True, "valid": True, "message": resultado["message"], "warning": resultado.get("warning")}


@app.delete("/api-keys/{service_name}", status_code=204)
def apagar_chave(service_name: str, _u=Depends(auth.exige_role("admin"))):
    db.executar(
        "delete from public.api_keys_registry where service_name = %s", (service_name,)
    )


# ---------------------------------------------------------------- listas
@app.get("/contact-lists")
def listar_listas(_u=Depends(auth.usuario_atual)):
    return db.varios("select * from public.contact_lists order by created_at desc")


@app.post("/contact-lists", status_code=201)
def criar_lista(l: NovaLista, _u=Depends(auth.usuario_atual)):
    return db.um(
        "insert into public.contact_lists (name, description) values (%s, %s) returning *",
        (l.name, l.description or ""),
    )


@app.delete("/contact-lists/{lista_id}", status_code=204)
def apagar_lista(lista_id: uuid.UUID, _u=Depends(auth.usuario_atual)):
    n = db.executar("delete from public.contact_lists where id = %s", (str(lista_id),))
    if not n:
        raise HTTPException(404, "Lista nao encontrada.")


# -------------------------------------------------------------- contatos
@app.get("/contacts")
def listar_contatos(
    list_id: uuid.UUID | None = None,
    search: str | None = None,
    status: str | None = None,
    platform: str | None = None,
    page: int = 1,
    page_size: int = 20,
    _u=Depends(auth.usuario_atual),
):
    onde = ["1=1"]
    params = []
    if list_id:
        onde.append("list_id = %s"); params.append(str(list_id))
    if search:
        onde.append("(name ilike %s or company ilike %s)")
        params += [f"%{search}%", f"%{search}%"]
    if status and status != "all":
        onde.append("status = %s"); params.append(status)
    if platform and platform != "all":
        onde.append("platform = %s"); params.append(platform)
    clausula = " and ".join(onde)

    total = db.um(f"select count(*) as n from public.contacts where {clausula}", tuple(params))["n"]
    offset = (page - 1) * page_size
    linhas = db.varios(
        f"select * from public.contacts where {clausula} "
        f"order by created_at desc limit %s offset %s",
        tuple(params) + (page_size, offset),
    )
    return {"contacts": linhas, "total": total, "page": page, "pageSize": page_size}


# -------------------------------------------------------- contatos em lote
class AtualizarLote(BaseModel):
    ids: list[uuid.UUID]
    status: str


@app.patch("/contacts/bulk-status", status_code=204)
def atualizar_status_lote(a: AtualizarLote, _u=Depends(auth.usuario_atual)):
    if not a.ids:
        return
    db.executar(
        "update public.contacts set status = %s where id = any(%s::uuid[])",
        (a.status, [str(i) for i in a.ids]),
    )


@app.get("/contacts/{contact_id}")
def ver_contato(contact_id: uuid.UUID, _u=Depends(auth.usuario_atual)):
    c = db.um("select * from public.contacts where id = %s", (str(contact_id),))
    if not c:
        raise HTTPException(404, "Contato nao encontrado.")
    return c


@app.patch("/contacts/{contact_id}")
def atualizar_contato(contact_id: uuid.UUID, a: AtualizarContato, _u=Depends(auth.usuario_atual)):
    campos = {k: v for k, v in a.model_dump().items() if v is not None}
    if not campos:
        return ver_contato(contact_id)
    sets = ", ".join(f"{k} = %s" for k in campos)
    linha = db.um(
        f"update public.contacts set {sets} where id = %s returning *",
        (*campos.values(), str(contact_id)),
    )
    if not linha:
        raise HTTPException(404, "Contato nao encontrado.")
    return linha


@app.delete("/contacts/{contact_id}", status_code=204)
def apagar_contato(contact_id: uuid.UUID, _u=Depends(auth.usuario_atual)):
    n = db.executar("delete from public.contacts where id = %s", (str(contact_id),))
    if not n:
        raise HTTPException(404, "Contato nao encontrado.")


# ------------------------------------------------------------ buscas de lead
@app.get("/lead-searches")
def listar_buscas(target_list_id: uuid.UUID | None = None, _u=Depends(auth.usuario_atual)):
    if target_list_id:
        return db.varios(
            "select * from public.lead_searches where target_list_id = %s "
            "order by created_at desc",
            (str(target_list_id),),
        )
    return db.varios("select * from public.lead_searches order by created_at desc")


@app.post("/lead-searches", status_code=201)
def criar_busca(b: NovaBusca, _u=Depends(auth.usuario_atual)):
    return db.um(
        "insert into public.lead_searches (name, source, config, target_list_id, status) "
        "values (%s, %s, %s, %s, 'pending') returning *",
        (b.name, b.source, json.dumps(b.config), str(b.target_list_id) if b.target_list_id else None),
    )


@app.post("/lead-searches/{search_id}/execute", status_code=501)
def executar_busca(search_id: uuid.UUID, _u=Depends(auth.usuario_atual)):
    raise HTTPException(501, FALTA_TERCEIRO.format(servico="Apollo/Apify/Tavily/PDL/CrustData"))


# --------------------------------------------------------------- mensagens
@app.get("/outreach-messages")
def listar_mensagens(contact_id: uuid.UUID | None = None, _u=Depends(auth.usuario_atual)):
    if contact_id:
        return db.varios(
            "select * from public.outreach_messages where contact_id = %s "
            "order by created_at desc",
            (str(contact_id),),
        )
    return db.varios("select * from public.outreach_messages order by created_at desc limit 200")


_RE_NAO_DIGITO = re.compile(r"\D")


def normalizar_telefone_br(bruto: str | None) -> str | None:
    """Porta `normalizeBrazilPhone` da edge function `whatsapp-send`.

    Aceita telefone com ou sem DDI, com ou sem o 9 do celular, com
    formatacao qualquer, e devolve `55DDDNUMERO` (12 ou 13 digitos) -- o
    formato que a Evolution espera em `number`. `None` quando nao da para
    reconhecer.
    """
    if not bruto:
        return None
    limpo = _RE_NAO_DIGITO.sub("", bruto)
    if not limpo:
        return None
    if limpo.startswith("5555") and len(limpo) >= 14:
        limpo = limpo[2:]
    if len(limpo) > 13 and limpo.startswith("55"):
        limpo = limpo[:13]
    if len(limpo) in (10, 11):
        limpo = "55" + limpo
    if len(limpo) not in (12, 13):
        return None
    return limpo


def _melhor_telefone(telefone_informado, contato):
    """Porta `resolveBestPhone`: prioriza celular (55DDD9NNNNNNNN) sobre
    fixo, e prioriza o telefone dos custom_fields sobre o da tabela e sobre
    o que veio no corpo da requisicao."""
    candidatos = []
    vistos = set()
    cf = (contato or {}).get("custom_fields") or {}

    def add(valor, origem):
        n = normalizar_telefone_br(valor) if isinstance(valor, str) else None
        if n and n not in vistos:
            vistos.add(n)
            candidatos.append((n, origem))

    add(cf.get("whatsapp"), "custom_fields.whatsapp")
    add((contato or {}).get("phone"), "db.phone")
    add(telefone_informado, "payload.phone")
    for v in (cf.get("all_phones") or []):
        add(v, "custom_fields.all_phones")

    celular = next((c for c in candidatos if re.match(r"^55\d{2}9\d{8}$", c[0])), None)
    escolhido = celular or (candidatos[0] if candidatos else None)
    return (escolhido[0], escolhido[1]) if escolhido else (None, None)


def _config_evolution_para_envio():
    """URL, chave e nome da instancia, ou HTTPException 400 clara -- a
    mesma checagem que a edge function fazia contra
    `settings.evolution_connected` antes de aceitar disparo."""
    s = db.um(
        "select evolution_api_url, evolution_instance_name, evolution_connected "
        "from public.settings limit 1"
    )
    if not s or not s["evolution_api_url"]:
        raise HTTPException(400, "Evolution API nao configurada. Va em Configuracoes -> WhatsApp.")
    if not s["evolution_connected"]:
        raise HTTPException(400, "WhatsApp nao esta conectado. Escaneie o QR Code nas Configuracoes.")
    row = db.um(
        "select pgp_sym_decrypt(encrypted_secret, %s) as chave "
        "from public.api_keys_registry where service_name = 'evolution'",
        (CHAVE_CRIPTO,),
    )
    if not row or not row["chave"]:
        raise HTTPException(400, "Chave da Evolution API nao encontrada.")
    return s["evolution_api_url"].rstrip("/"), row["chave"], s["evolution_instance_name"] or INSTANCE_NAME


def _erro_evolution(corpo, telefone):
    existe = ((corpo or {}).get("response") or {}).get("message")
    if isinstance(existe, list) and existe and existe[0].get("exists") is False:
        return "Numero nao existe no WhatsApp: %s" % telefone
    if isinstance((corpo or {}).get("error"), str):
        return corpo["error"]
    if isinstance((corpo or {}).get("message"), str):
        return corpo["message"]
    return "Erro ao enviar para %s" % telefone


class ContatoParaEnvio(BaseModel):
    contact_id: str | None = None
    phone: str | None = None
    text: str


class EnvioWhatsApp(BaseModel):
    action: str
    contacts: list[ContatoParaEnvio]


def _contatos_do_banco(ids):
    if not ids:
        return {}
    linhas = db.varios(
        "select id, phone, custom_fields from public.contacts where id = any(%s)",
        (ids,),
    )
    return {str(l["id"]): l for l in linhas}


@app.post("/messages/whatsapp")
def enviar_whatsapp(e: EnvioWhatsApp, _u=Depends(auth.usuario_atual)):
    """Porta a edge function `whatsapp-send` (`send_single`/`send_bulk`).

    Nao lida com `resolve_contacts` -- ninguem no front chama essa acao.
    """
    if e.action not in ("send_single", "send_bulk"):
        raise HTTPException(400, "action deve ser 'send_single' ou 'send_bulk'.")
    if not e.contacts:
        raise HTTPException(400, "contacts e obrigatorio.")

    base_url, chave, instancia = _config_evolution_para_envio()
    ids = [c.contact_id for c in e.contacts if c.contact_id]
    por_id = _contatos_do_banco(ids)

    preparados = []
    for c in e.contacts:
        contato = por_id.get(c.contact_id) if c.contact_id else None
        telefone, origem = _melhor_telefone(c.phone, contato)
        preparados.append({
            "contact_id": c.contact_id,
            "text": (c.text or "").strip(),
            "telefone": telefone,
            "origem": origem,
        })

    if e.action == "send_single":
        p = preparados[0]
        if not p["text"]:
            raise HTTPException(400, "text e obrigatorio.")
        if not p["telefone"]:
            raise HTTPException(400, "Nenhum numero valido para envio foi encontrado neste contato.")
        resp = _evo_fetch(base_url, chave, f"/message/sendText/{instancia}", "POST",
                          {"number": p["telefone"], "text": p["text"]})
        status = "sent" if resp["ok"] else "failed"
        msg_id = ((resp["data"] or {}).get("key") or {}).get("id")
        db.executar(
            "insert into public.outreach_messages (contact_id, channel, direction, "
            "message_text, status, provider, provider_message_id, metadata) "
            "values (%s, 'whatsapp', 'outbound', %s, %s, 'evolution', %s, %s)",
            (p["contact_id"], p["text"], status, msg_id,
             json.dumps({"resolved_phone": p["telefone"], "phone_source": p["origem"],
                        "instance": instancia,
                        "error": None if resp["ok"] else _erro_evolution(resp["data"], p["telefone"])})),
        )
        if not resp["ok"]:
            raise HTTPException(500, _erro_evolution(resp["data"], p["telefone"]))
        if p["contact_id"]:
            db.executar("update public.contacts set status = 'contatado' where id = %s", (p["contact_id"],))
        return {"success": True, "message_id": msg_id, "resolved_phone": p["telefone"]}

    # send_bulk
    resultados = []
    for i, p in enumerate(preparados):
        if not p["text"]:
            resultados.append({"contact_id": p["contact_id"], "success": False, "error": "Missing text"})
            continue
        if not p["telefone"]:
            resultados.append({
                "contact_id": p["contact_id"], "success": False,
                "error": "Nenhum numero valido para envio foi encontrado neste contato.",
            })
            continue
        try:
            resp = _evo_fetch(base_url, chave, f"/message/sendText/{instancia}", "POST",
                              {"number": p["telefone"], "text": p["text"]})
            sucesso = resp["ok"]
            if sucesso and p["contact_id"]:
                db.executar("update public.contacts set status = 'contatado' where id = %s", (p["contact_id"],))
            resultados.append({
                "contact_id": p["contact_id"], "success": sucesso,
                "message_id": ((resp["data"] or {}).get("key") or {}).get("id"),
                "error": None if sucesso else _erro_evolution(resp["data"], p["telefone"]),
            })
        except Exception as ex:
            resultados.append({"contact_id": p["contact_id"], "success": False, "error": str(ex)})
        if i < len(preparados) - 1:
            time.sleep(3 + random.random() * 5)

    for i, p in enumerate(preparados):
        db.executar(
            "insert into public.outreach_messages (contact_id, channel, direction, "
            "message_text, status, provider, provider_message_id, metadata) "
            "values (%s, 'whatsapp', 'outbound', %s, %s, 'evolution', %s, %s)",
            (p["contact_id"], p["text"], "sent" if resultados[i]["success"] else "failed",
             resultados[i].get("message_id"),
             json.dumps({"resolved_phone": p["telefone"], "phone_source": p["origem"],
                        "instance": instancia, "error": resultados[i].get("error")})),
        )

    enviados = sum(1 for r in resultados if r["success"])
    falhas = len(resultados) - enviados
    return {"sent": enviados, "failed": falhas, "total": len(e.contacts), "results": resultados}


@app.post("/evolution/webhook/{segredo_recebido}")
def evolution_webhook(segredo_recebido: str, payload: dict):
    """Porta a edge function `evolution-webhook`, sem sessao de usuario de
    proposito: quem chama e a propria Evolution, servidor-a-servidor.

    Fecha a pendencia C.3 (`docs/05_Pendencias.md`): o webhook fica
    PUBLICO por natureza -- o Evolution roda fora do `127.0.0.1` do host --
    e o que o protege e o segredo no caminho, no mesmo padrao que o
    `/api/webhook/evolution/{segredo}` do MoviZap. `compare_digest`, nunca
    `==`: um endpoint publico aceita quantas tentativas quiserem, e `==`
    vazaria o tamanho do prefixo certo pelo tempo de resposta.

    `messages.upsert` com `fromMe=false` -> mensagem recebida, tenta achar
    o contato pelos ultimos 8 digitos do telefone. `messages.update` ->
    atualiza o status de entrega da mensagem que JA enviamos.
    """
    if not segredos.compare_digest(segredo_recebido, WEBHOOK_SEGREDO):
        raise HTTPException(404)  # 404, nao 401/403 -- nao confirma que a rota existe

    evento = payload.get("event")

    if evento == "messages.upsert":
        dados = payload.get("data") or {}
        chave = dados.get("key") or {}
        if chave.get("fromMe"):
            return {"received": True, "skipped": "fromMe"}

        remote_jid = chave.get("remoteJid") or ""
        telefone = re.sub(r"@s\.whatsapp\.net$|@g\.us$", "", remote_jid)
        msg = dados.get("message") or {}
        texto = (
            msg.get("conversation")
            or (msg.get("extendedTextMessage") or {}).get("text")
            or (msg.get("imageMessage") or {}).get("caption")
            or "[midia]"
        )
        ts = dados.get("messageTimestamp")
        quando = (
            datetime.datetime.fromtimestamp(int(ts), tz=datetime.timezone.utc)
            if ts else datetime.datetime.now(datetime.timezone.utc)
        )

        contato_id = None
        if telefone:
            cauda = telefone[-8:]
            achado = db.um(
                "select id from public.contacts where phone = %s or phone ilike %s limit 1",
                (telefone, "%" + cauda),
            )
            contato_id = achado["id"] if achado else None

        db.executar(
            "insert into public.outreach_messages (contact_id, channel, direction, "
            "message_text, status, provider, provider_message_id, sent_at, metadata) "
            "values (%s, 'whatsapp', 'inbound', %s, 'delivered', 'evolution', %s, %s, %s)",
            (contato_id, texto, chave.get("id"), quando,
             json.dumps({"remote_jid": remote_jid, "phone": telefone,
                        "instance": payload.get("instance"), "push_name": dados.get("pushName")})),
        )
        return {"received": True, "direction": "inbound", "contact_id": contato_id}

    if evento == "messages.update":
        atualizacoes = payload.get("data")
        atualizacoes = atualizacoes if isinstance(atualizacoes, list) else [atualizacoes]
        mapa = {3: "delivered", "DELIVERY_ACK": "delivered", 4: "read", "READ": "read",
                5: "read", "PLAYED": "read"}
        for u in atualizacoes:
            if not u:
                continue
            msg_id = (u.get("key") or {}).get("id")
            status_evo = (u.get("update") or {}).get("status")
            novo_status = mapa.get(status_evo)
            if msg_id and novo_status:
                db.executar(
                    "update public.outreach_messages set status = %s "
                    "where provider_message_id = %s and direction = 'outbound'",
                    (novo_status, msg_id),
                )
        return {"received": True, "type": "status_update"}

    return {"received": True, "event": evento}


@app.post("/messages/email", status_code=501)
def enviar_email(_u=Depends(auth.usuario_atual)):
    raise HTTPException(501, FALTA_TERCEIRO.format(servico="Resend"))


@app.post("/messages/generate-opener", status_code=501)
def gerar_abertura(_u=Depends(auth.usuario_atual)):
    raise HTTPException(501, FALTA_TERCEIRO.format(servico="provedor de LLM"))


@app.post("/contacts/{contact_id}/enrich", status_code=501)
def enriquecer_contato(contact_id: uuid.UUID, _u=Depends(auth.usuario_atual)):
    raise HTTPException(501, FALTA_TERCEIRO.format(servico="Apollo/Apify/PDL"))




# --------------------------------------------------------------- evolution
# Portado quase linha a linha do evolution-setup original -- nao depende
# de nada que falta, so fala com a Evolution que o admin configurar (URL +
# chave, BYO-instance, diferente do padrao isolado nina/prospeccao).
INSTANCE_NAME = "prospecta-ai"


def _evo_fetch(base_url: str, api_key: str, path: str, method: str = "GET", body: dict | None = None) -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    with httpx.Client(timeout=15) as cli:
        r = cli.request(method, url, headers={"apikey": api_key, "Content-Type": "application/json"},
                        json=body if body else None)
    try:
        data = r.json()
    except Exception:
        data = {}
    return {"ok": r.is_success, "status": r.status_code, "data": data}


def _evo_credenciais(admin, url_informada: str | None, chave_informada: str | None) -> tuple[str, str]:
    url = url_informada
    chave = chave_informada
    if not url or not chave:
        s = db.um("select evolution_api_url from public.settings limit 1")
        if s and not url:
            url = s["evolution_api_url"]
        if not chave:
            row = db.um(
                "select pgp_sym_decrypt(encrypted_secret, %s) as chave "
                "from public.api_keys_registry where service_name = 'evolution'",
                (CHAVE_CRIPTO,),
            )
            chave = row["chave"] if row else None
    if not url or not chave:
        raise HTTPException(400, "URL e chave da Evolution sao obrigatorias. Configure em Configuracoes.")
    return url, chave


class EvolutionAcao(BaseModel):
    evolution_api_url: str | None = None
    evolution_api_key: str | None = None


@app.post("/evolution/test")
def evolution_test(a: EvolutionAcao, _u=Depends(auth.exige_role("admin"))):
    if not a.evolution_api_url or not a.evolution_api_key:
        raise HTTPException(400, "Informe URL e chave para testar.")
    r = _evo_fetch(a.evolution_api_url, a.evolution_api_key, "/instance/fetchInstances")
    return {"valid": r["ok"], "message": "Conectado a Evolution API" if r["ok"] else f"Erro: {r['status']}"}


@app.post("/evolution/setup")
def evolution_setup(a: EvolutionAcao, admin=Depends(auth.exige_role("admin"))):
    url, chave = _evo_credenciais(admin, a.evolution_api_url, a.evolution_api_key)

    existentes = _evo_fetch(url, chave, f"/instance/fetchInstances?instanceName={INSTANCE_NAME}")
    ja_existe = existentes["ok"] and isinstance(existentes["data"], list) and any(
        (i.get("instance") or {}).get("instanceName") == INSTANCE_NAME for i in existentes["data"]
    )

    if not ja_existe:
        criar = _evo_fetch(url, chave, "/instance/create", "POST", {
            "instanceName": INSTANCE_NAME, "integration": "WHATSAPP-BAILEYS", "qrcode": True,
            "reject_call": True, "groupsIgnore": True, "alwaysOnline": False,
            "readMessages": False, "readStatus": False, "syncFullHistory": False,
        })
        if not criar["ok"]:
            raise HTTPException(500, f"Erro ao criar instancia: {criar['data']}")
        _evo_fetch(url, chave, f"/settings/set/{INSTANCE_NAME}", "POST", {
            "rejectCall": True, "groupsIgnore": True, "alwaysOnline": False,
            "readMessages": False, "readStatus": False,
        })

    # FORA do `if not ja_existe` de proposito: ate 03/09 o webhook so era
    # registrado na criacao. Rodar o setup de novo (troca de URL, rotacao do
    # segredo) nunca atualizava o que ja estava configurado na Evolution --
    # a instancia `prospecta-ai`, criada em 07/08, ficou meses apontando
    # para um endereco sem o `/evolution/webhook` que so passou a existir
    # agora, e ninguem tinha como corrigir sem mexer na Evolution na mao.
    _evo_fetch(url, chave, f"/webhook/set/{INSTANCE_NAME}", "POST", {
        "webhook": {
            "enabled": True,
            "url": f"https://prospectar.imagohub.com.br/api/evolution/webhook/{WEBHOOK_SEGREDO}",
            "webhookByEvents": True, "webhookBase64": False,
            "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
        },
    })

    existe_settings = db.um("select id from public.settings limit 1")
    if existe_settings:
        db.executar(
            "update public.settings set evolution_api_url = %s, evolution_instance_name = %s where id = %s",
            (url, INSTANCE_NAME, existe_settings["id"]),
        )

    qr = _evo_fetch(url, chave, f"/instance/connect/{INSTANCE_NAME}")
    qrd = qr["data"] or {}
    return {
        "success": True, "instance_name": INSTANCE_NAME,
        "qrcode": qrd.get("base64") or (qrd.get("qrcode") or {}).get("base64"),
        "pairingCode": qrd.get("pairingCode"),
        "status": (qrd.get("instance") or {}).get("state", "connecting"),
    }


@app.post("/evolution/qrcode")
def evolution_qrcode(admin=Depends(auth.exige_role("admin"))):
    url, chave = _evo_credenciais(admin, None, None)
    qr = _evo_fetch(url, chave, f"/instance/connect/{INSTANCE_NAME}")
    qrd = qr["data"] or {}
    return {
        "qrcode": qrd.get("base64") or (qrd.get("qrcode") or {}).get("base64"),
        "pairingCode": qrd.get("pairingCode"),
        "status": (qrd.get("instance") or {}).get("state", "connecting"),
    }


@app.post("/evolution/status")
def evolution_status(admin=Depends(auth.exige_role("admin"))):
    url, chave = _evo_credenciais(admin, None, None)
    r = _evo_fetch(url, chave, f"/instance/connectionState/{INSTANCE_NAME}")
    d = r["data"] or {}
    estado = (d.get("instance") or {}).get("state") or d.get("state") or "unknown"
    conectado = estado == "open"
    s = db.um("select id from public.settings limit 1")
    if s:
        db.executar("update public.settings set evolution_connected = %s where id = %s", (conectado, s["id"]))
    return {"connected": conectado, "state": estado}


@app.post("/evolution/disconnect", status_code=204)
def evolution_disconnect(admin=Depends(auth.exige_role("admin"))):
    url, chave = _evo_credenciais(admin, None, None)
    _evo_fetch(url, chave, f"/instance/logout/{INSTANCE_NAME}", "DELETE")
    s = db.um("select id from public.settings limit 1")
    if s:
        db.executar("update public.settings set evolution_connected = false where id = %s", (s["id"],))


# ----------------------------------------------------------------- saude
@app.get("/health/workspace")
def saude_workspace(_u=Depends(auth.usuario_atual)):
    """Substitui o remix-health-check original -- aquele checava schema/
    funcoes do Lovable (get_vault_key etc.), que nao se aplicam mais aqui.
    Esta versao checa o que de fato importa nesta API: admin existe,
    workspace pronto, quais integracoes estao configuradas."""
    tem_admin = db.um("select 1 from public.user_roles where role = 'admin'") is not None
    pronto = db.um(
        "select exists(select 1 from public.api_keys_registry "
        "where service_name = 'apollo' and is_active = true) as v"
    )["v"]
    linhas = db.varios("select service_name from public.api_keys_registry where is_active = true")
    configurados = {l["service_name"] for l in linhas}
    integracoes = {s: ("configured" if s in configurados else "missing") for s in SERVICOS_CONHECIDOS}
    usavel = tem_admin
    return {
        "usable": usavel,
        "checks": {
            "has_admin": {"ok": tem_admin, "detail": None if tem_admin else "Nenhum admin cadastrado"},
            "workspace_ready": {"ok": bool(pronto), "detail": None if pronto else "Chave Apollo nao configurada"},
        },
        "integrations": integracoes,
        "next_step": "Tudo certo." if usavel else "Cadastre o primeiro usuario (vira admin automaticamente).",
    }


# -------------------------------------------------------------- importacao
class ContatoImportado(BaseModel):
    name: str = ""
    phone: str = ""
    company: str = ""
    city: str = ""
    tags: list[str] = []
    custom_fields: dict = {}
    score: int = 0
    source: str = "apify_instagram"


@app.post("/contacts/import")
def importar_contatos(
    contatos: list[ContatoImportado],
    list_id: uuid.UUID | None = None,
    _u=Depends(auth.usuario_atual),
):
    """Chama upsert_lead_contact(), que ja existe no banco e e SQL puro --
    nao depende de vault/auth.uid(), entao funciona como esta, sem porte."""
    novos = 0
    atualizados = 0
    for c in contatos:
        r = db.um(
            "select upsert_lead_contact(%s, %s, %s, %s, %s, %s, %s, %s, %s) as r",
            (c.name, c.phone, c.company, c.city, c.tags,
             str(list_id) if list_id else None, json.dumps(c.custom_fields), c.score, c.source),
        )
        if r["r"]["is_new"]:
            novos += 1
        else:
            atualizados += 1
    return {"novos": novos, "atualizados": atualizados, "total": len(contatos)}
