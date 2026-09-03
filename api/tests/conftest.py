# -*- coding: utf-8 -*-
"""Base da suite de testes da API do Prospectar.

DIFERENTE DO CONCORRENTES: aqui o workspace e unico e compartilhado --
contacts e outreach_messages NAO tem `user_id`. Isolar por usuario nao
protege esses dados; protege so o que e de fato por usuario (chaves,
perfil, papel). Por isso todo dado de teste em `contacts`/
`outreach_messages` e criado com um marcador reconhecivel e apagado por
esse marcador no fim, nunca por CASCADE de usuario.

Nenhum teste chama a Evolution de verdade -- os testes que envolvem envio
verificam o erro claro de "nao configurada", nao o envio em si. Enviar
WhatsApp de teste para numero de verdade nao e algo que uma suite deva
fazer.
"""
import os
import sys

import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
API = os.path.dirname(AQUI)
sys.path.insert(0, API)

import auth  # noqa: E402
import db  # noqa: E402
import main  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

EMAIL_TESTE = "pytest-prospectar@imagohub.com.br"
MARCADOR = "___pytest___"


@pytest.fixture(scope="session")
def cliente():
    return TestClient(main.app)


@pytest.fixture()
def usuario_de_teste():
    _apagar_usuario_teste()
    linha = db.um(
        "insert into public.usuario (email, nome, senha_hash, ativo) "
        "values (%s, %s, %s, true) returning id, email",
        (EMAIL_TESTE, "Usuario de teste", auth.hash_senha("senha-de-teste-123")),
    )
    db.executar(
        "insert into public.user_roles (user_id, role) values (%s, 'admin')",
        (linha["id"],),
    )
    yield linha
    sobrou = _apagar_usuario_teste()
    assert sobrou == 0, "o teste deixou %d linha(s) do usuario para tras" % sobrou


def _apagar_usuario_teste():
    u = db.um("select id from public.usuario where email = %s", (EMAIL_TESTE,))
    if not u:
        return 0
    db.executar("delete from public.usuario where id = %s", (u["id"],))
    restos = 0
    for tabela, coluna in (
        ("user_roles", "user_id"), ("profiles", "id"),
        ("user_onboarding", "user_id"), ("api_keys_registry", "user_id"),
    ):
        restos += db.um(
            "select count(*) c from public.%s where %s = %%s" % (tabela, coluna),
            (u["id"],),
        )["c"]
    return restos


@pytest.fixture()
def cabecalho(usuario_de_teste):
    token = auth.gerar_token(usuario_de_teste["id"], usuario_de_teste["email"])[0]
    return {"Authorization": "Bearer " + token}


@pytest.fixture()
def contato_de_teste():
    """Um contato marcado, no workspace COMPARTILHADO -- apagado por id no
    fim, nunca por CASCADE (contacts nao tem user_id)."""
    # `source` e enum fechado de provedores reais (apollo, firecrawl...) --
    # NULL e o unico valor neutro que o CHECK aceita para dado de teste.
    linha = db.um(
        "insert into public.contacts (name, phone, status, custom_fields) "
        "values (%s, %s, 'novo', %s) returning id, phone, custom_fields",
        (MARCADOR, "11955501234", "{}"),  # tail distinto: nao colide com dado real
    )
    yield linha
    db.executar("delete from public.contacts where id = %s", (linha["id"],))


@pytest.fixture(autouse=True)
def limpar_mensagens_de_teste():
    """As mensagens que o webhook grava nao carregam FK para o usuario de
    teste (workspace compartilhado) -- limpa pelo `provider_message_id`
    com o marcador, sempre, mesmo se o teste falhar no meio."""
    yield
    db.executar(
        "delete from public.outreach_messages where provider_message_id like %s",
        (MARCADOR + "%",),
    )
