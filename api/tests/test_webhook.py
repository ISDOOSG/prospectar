# -*- coding: utf-8 -*-
"""Testes do webhook e do envio de WhatsApp, portados em 03/09/2026.

Ate esta data `POST /evolution/setup` gravava o endereco do webhook na
instancia da Evolution e `/evolution/webhook` nao existia: a Evolution
entregava mensagem num endereco que respondia 404. A prospeccao enviava e
nao escutava.
"""
import db
import main

MARCADOR = "___pytest___"
CAMINHO_WEBHOOK = "/evolution/webhook/" + main.WEBHOOK_SEGREDO


def test_webhook_rejeita_segredo_errado(cliente):
    """O segredo no caminho e o unico controle de acesso deste endpoint --
    fecha a pendencia C.3 (assinar o webhook, no padrao do MoviZap)."""
    r = cliente.post("/evolution/webhook/segredo-errado", json={"event": "connection.update"})
    assert r.status_code == 404


def test_webhook_grava_mensagem_recebida(cliente):
    r = cliente.post(
        CAMINHO_WEBHOOK,
        json={
            "event": "messages.upsert",
            "instance": "prospecta-ai",
            "data": {
                "key": {
                    "remoteJid": "5519989999999@s.whatsapp.net",
                    "fromMe": False,
                    "id": MARCADOR + "in1",
                },
                "message": {"conversation": "Oi, tenho interesse"},
                "messageTimestamp": 1735689600,
                "pushName": "Contato Teste",
            },
        },
    )
    assert r.status_code == 200
    assert r.json()["direction"] == "inbound"

    linha = db.um(
        "select channel, direction, message_text, status, metadata "
        "from public.outreach_messages where provider_message_id = %s",
        (MARCADOR + "in1",),
    )
    assert linha is not None
    assert linha["direction"] == "inbound"
    assert linha["status"] == "delivered"
    assert linha["message_text"] == "Oi, tenho interesse"
    assert linha["metadata"]["phone"] == "5519989999999"


def test_webhook_ignora_mensagem_propria(cliente):
    """`fromMe: true` e eco do que a propria instancia mandou -- nao pode
    virar mensagem 'recebida'."""
    r = cliente.post(
        CAMINHO_WEBHOOK,
        json={
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "5519989999999@s.whatsapp.net",
                        "fromMe": True, "id": MARCADOR + "eco"},
                "message": {"conversation": "eco"},
            },
        },
    )
    assert r.status_code == 200
    assert r.json().get("skipped") == "fromMe"
    assert db.um(
        "select 1 from public.outreach_messages where provider_message_id = %s",
        (MARCADOR + "eco",),
    ) is None


def test_webhook_acha_contato_pelo_telefone(cliente, contato_de_teste):
    r = cliente.post(
        CAMINHO_WEBHOOK,
        json={
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "5511955501234@s.whatsapp.net",
                        "fromMe": False, "id": MARCADOR + "in2"},
                "message": {"conversation": "resposta"},
            },
        },
    )
    assert r.status_code == 200
    assert r.json()["contact_id"] == str(contato_de_teste["id"])


def test_webhook_atualiza_status_so_de_mensagem_enviada_por_nos(cliente):
    """`messages.update` e recibo de entrega/leitura -- so faz sentido em
    `direction = 'outbound'`. Uma mensagem recebida nao tem status de
    entrega para nos."""
    db.executar(
        "insert into public.outreach_messages "
        "(contact_id, channel, direction, message_text, status, provider, provider_message_id) "
        "values (null, 'whatsapp', 'outbound', 'oi', 'sent', 'evolution', %s)",
        (MARCADOR + "out1",),
    )
    r = cliente.post(
        CAMINHO_WEBHOOK,
        json={"event": "messages.update",
              "data": {"key": {"id": MARCADOR + "out1"}, "update": {"status": 4}}},
    )
    assert r.status_code == 200
    linha = db.um(
        "select status from public.outreach_messages where provider_message_id = %s",
        (MARCADOR + "out1",),
    )
    assert linha["status"] == "read"


def test_webhook_evento_desconhecido_nao_quebra(cliente):
    r = cliente.post(CAMINHO_WEBHOOK, json={"event": "connection.update"})
    assert r.status_code == 200
    assert r.json()["event"] == "connection.update"


# ---------------------------------------------------- envio de whatsapp
def test_envio_sem_evolution_configurada_da_erro_claro(cliente, cabecalho):
    """Nenhuma chamada a Evolution deve acontecer sem `settings` e a chave
    cadastrados -- o erro precisa dizer isso, nao estourar."""
    r = cliente.post(
        "/messages/whatsapp",
        json={"action": "send_single", "contacts": [{"phone": "11999998888", "text": "oi"}]},
        headers=cabecalho,
    )
    assert r.status_code == 400
    assert "Evolution" in r.json()["detail"]


def test_envio_exige_action_valida(cliente, cabecalho):
    r = cliente.post(
        "/messages/whatsapp",
        json={"action": "invalida", "contacts": []},
        headers=cabecalho,
    )
    assert r.status_code == 400


# ---------------------------------------------- normalizacao de telefone
def test_normaliza_formatos_comuns_de_telefone_br():
    casos = {
        "(19) 98984-7447": "5519989847447",
        "+55 19 98984-7447": "5519989847447",
        "5519989847447": "5519989847447",
        "555519989847447": "5519989847447",
        "19 3232-1234": "551932321234",
        "abc": None,
        "": None,
    }
    for bruto, esperado in casos.items():
        assert main.normalizar_telefone_br(bruto) == esperado, bruto


def test_prioriza_celular_dos_custom_fields():
    contato = {"phone": "1932321234", "custom_fields": {"whatsapp": "19989847447"}}
    telefone, origem = main._melhor_telefone(None, contato)
    assert telefone == "5519989847447"
    assert origem == "custom_fields.whatsapp"


def test_sem_nenhum_telefone_nao_inventa_um():
    assert main._melhor_telefone(None, None) == (None, None)
