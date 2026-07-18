# ============================================================================
# PERSISTENCIA DEL HISTORIAL DE CHAT (Supabase Postgres)
# ============================================================================
# El backend no tiene sesión propia: cada request a /plan-trip es stateless.
# Para que la conversación sobreviva a un reload de la página, cada turno
# (user/assistant) se guarda en Postgres (Supabase) agrupado por session_id
# (un UUID que el frontend genera una vez y guarda en localStorage — NO es
# autenticación, solo agrupa "qué mensajes son de esta pestaña/navegador").
#
# Se conecta directo a Postgres con asyncpg (no se usa el cliente supabase-py
# porque no necesitamos su capa REST/Auth: con las credenciales de conexión
# a la base (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD) alcanza).
# ============================================================================

import os
import uuid

import asyncpg

_pool: asyncpg.Pool | None = None

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_created_at_idx
    ON chat_messages (session_id, created_at);
"""


async def init_pool() -> None:
    """Crea el pool de conexiones y asegura que la tabla exista. Se llama una
    vez al arrancar FastAPI (ver evento startup en main.py)."""
    global _pool
    _pool = await asyncpg.create_pool(
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        ssl="require",  # Supabase exige conexiones cifradas.
        min_size=1,
        max_size=5,
    )
    async with _pool.acquire() as conn:
        await conn.execute(_CREATE_TABLE_SQL)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("El pool de la base de datos no fue inicializado (init_pool).")
    return _pool


async def fetch_history(session_id: uuid.UUID) -> list[dict[str, str]]:
    """Devuelve los mensajes previos de esta sesión, en orden cronológico,
    listos para pasar como `history` a las funciones de router.py."""
    rows = await _get_pool().fetch(
        "SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
        session_id,
    )
    return [{"role": row["role"], "content": row["content"]} for row in rows]


async def save_message(session_id: uuid.UUID, role: str, content: str) -> None:
    await _get_pool().execute(
        "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)",
        session_id,
        role,
        content,
    )
