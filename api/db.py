"""Conexao com o Postgres local do prospectar (lead-king).

Mesmo padrao do concorrentes: pool de threads, autorizacao na camada de
servico (nunca no banco -- ver nota em main.py).
"""
import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2 import pool

psycopg2.extras.register_uuid()

_pool = None


def _cfg():
    raiz = os.path.dirname(os.path.abspath(__file__))
    env = {}
    for arq in (os.path.join(raiz, "..", ".env.db"), os.path.join(raiz, ".env")):
        if not os.path.exists(arq):
            continue
        for linha in open(arq, encoding="utf-8"):
            linha = linha.strip()
            if "=" in linha and not linha.startswith("#"):
                k, v = linha.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


CFG = _cfg()


def iniciar():
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(
            1, 10,
            host=CFG["LEADKING_DB_HOST"],
            port=CFG["LEADKING_DB_PORTA"],
            dbname=CFG["LEADKING_DB_NOME"],
            user=CFG["LEADKING_DB_USUARIO"],
            password=CFG["LEADKING_DB_SENHA"],
        )
    return _pool


@contextmanager
def conexao():
    p = iniciar()
    con = p.getconn()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        p.putconn(con)


@contextmanager
def cursor():
    with conexao() as con:
        cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield cur
        finally:
            cur.close()


def um(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()


def varios(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


def executar(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.rowcount
