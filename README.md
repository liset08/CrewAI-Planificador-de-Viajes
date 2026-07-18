# Project-CrewAI-Planificador-de-Viajes

Planificador de viajes conversacional construido con **CrewAI**. Un equipo de agentes de IA investiga cultura, gastronomía y logística de un destino, arma un itinerario día por día y lo **agenda automáticamente en Google Calendar** (vía la integración Tools & Integrations de la plataforma de CrewAI).

## Estructura

- **`Backend-Proyecto-Planificador-de-Viajes/`** — API FastAPI + crew de 6 agentes (CrewAI). Búsqueda en internet con **Tavily**.
- **`Frontend-Proyecto-Planificador-de-Viajes/`** — Chat en **React + Vite + TypeScript + Tailwind CSS v4**, con itinerario visual por días.

## Requisitos

- Python 3.10–3.12 y [uv](https://docs.astral.sh/uv/) (backend)
- Node.js 18+ (frontend)
- Una `OPENAI_API_KEY`
- Una `TAVILY_API_KEY` (gratis en [tavily.com](https://tavily.com)) para la búsqueda en internet de los agentes.
- Un `CREWAI_PLATFORM_INTEGRATION_TOKEN` (Settings → Integrations en app.crewai.com) con Google Calendar conectado.

## Puesta en marcha

### Backend
```bash
cd Backend-Proyecto-Planificador-de-Viajes
cp .env.example .env   # y rellena tus claves (OPENAI, TAVILY, CREWAI_PLATFORM...)
uv sync
uv run uvicorn backend_proyecto_planificador_de_viajes.main:app --app-dir src --host 127.0.0.1 --port 8005 --reload
```

### Frontend
```bash
cd Frontend-Proyecto-Planificador-de-Viajes
npm install
npm run dev
```

Abre **http://localhost:5173**. El frontend habla con el backend en el puerto 8005 mediante el proxy de Vite (`/api` → `localhost:8005`), evitando problemas de CORS en desarrollo.

Luego describe tu viaje (ej. *"Cusco del 11 al 15 de julio 2026"*) —o usa los filtros Dónde/Cuándo/Quién/Presupuesto— y el crew generará el itinerario y creará un evento por día en tu Google Calendar.
