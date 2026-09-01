"""Autenticacao propria -- substitui GoTrue da Supabase (mesmo padrao do
concorrentes). Role vive em user_roles (app_role: admin/supervisor/agent),
separado de usuario/profiles -- diferente do concorrentes, que tinha role
direto em profiles.
"""
import datetime as dt

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request

import db

SEGREDO = db.CFG.get("LEADKING_JWT_SECRET")
if not SEGREDO:
    raise RuntimeError(
        "LEADKING_JWT_SECRET ausente em api/.env -- o servico nao sobe sem ele"
    )

ALGO = "HS256"
HORAS_VALIDADE = 24


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()


def confere_senha(senha: str, hash_guardado: str) -> bool:
    if not hash_guardado:
        return False
    try:
        return bcrypt.checkpw(senha.encode(), hash_guardado.encode())
    except ValueError:
        return False


def gerar_token(user_id, email: str) -> tuple[str, str]:
    expira = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=HORAS_VALIDADE)
    payload = {"sub": str(user_id), "email": email, "exp": expira}
    return jwt.encode(payload, SEGREDO, algorithm=ALGO), expira.isoformat()


def ler_token(token: str) -> dict:
    try:
        return jwt.decode(token, SEGREDO, algorithms=[ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessao expirada. Entre de novo.")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sessao invalida. Entre de novo.")


async def usuario_atual(request: Request) -> dict:
    cabecalho = request.headers.get("authorization", "")
    if not cabecalho.lower().startswith("bearer "):
        raise HTTPException(401, "Faltou o token de acesso.")
    dados = ler_token(cabecalho[7:].strip())
    u = db.um(
        "select id, email, nome, ativo from public.usuario where id = %s",
        (dados["sub"],),
    )
    if not u:
        raise HTTPException(401, "Usuario nao existe mais.")
    if not u["ativo"]:
        raise HTTPException(403, "Conta desativada.")
    papel = db.um(
        "select role from public.user_roles where user_id = %s", (u["id"],)
    )
    u["role"] = papel["role"] if papel else "agent"
    return u


def exige_role(*papeis):
    """Dependencia parametrizada: 403 se o papel do usuario nao estiver na lista."""
    async def checador(u=Depends(usuario_atual)):
        if u["role"] not in papeis:
            raise HTTPException(403, "Voce nao tem permissao para esta acao.")
        return u
    return checador
