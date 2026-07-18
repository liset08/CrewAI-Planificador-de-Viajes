FROM python:3.12-slim

# lancedb (dependencia de crewai[tools]) no publica wheel para macOS x86_64,
# pero sí para manylinux x86_64/arm64. Corriendo en Linux (este contenedor)
# evitamos el error de resolución de uv en Mac Intel.

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Instala dependencias primero (cache de capas)
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

# Copia el resto del código
COPY . .
RUN uv sync --locked

EXPOSE 8005

CMD ["uv", "run", "uvicorn", "backend_proyecto_planificador_de_viajes.main:app", \
     "--app-dir", "src", "--host", "0.0.0.0", "--port", "8005", "--reload"]
