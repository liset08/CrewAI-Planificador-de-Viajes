# Backend — Planificador de Viajes IA · MODO JERÁRQUICO (CrewAI + FastAPI)

Copia **independiente** del backend original, pero con el crew en **proceso
jerárquico** (`Process.hierarchical`). Expone la misma **API FastAPI** y genera el
mismo tipo de itinerario, con una diferencia importante en *cómo* trabajan los agentes.

> Este backend NO reemplaza al original. Es un gemelo para comparar los dos estilos
> de orquestación en clase. Puedes lanzar uno u otro (ver `COMANDOS.md`).

## Secuencial vs. Jerárquico (la única diferencia real)

| | Backend original | Este backend |
|---|---|---|
| Proceso | `Process.sequential` | `Process.hierarchical` |
| Coordinación | Ninguna: tubería fija task1→task2→… | Un **agente manager** ("Jefe de Proyecto") delega y revisa |
| ¿Los agentes dialogan? | No, solo se pasan el resultado | Sí: el manager pregunta, pide correcciones y datos faltantes |
| Definido en | `crew.py` (`process=...`) | `crew.py` (`process=...` + `manager_agent=...`) |

Todo lo demás (herramientas Tavily, Google Calendar, FastAPI, YAML de tareas,
`kickoff_async`, `tracing=False`) es **idéntico** al original.

## Requisitos

- Python 3.10–3.12
- [uv](https://docs.astral.sh/uv/) para gestionar dependencias
- Claves en el archivo `.env` (ver `.env.example`):
  - `OPENAI_API_KEY` — modelo LLM (también lo usa el **manager** para coordinar).
  - `TAVILY_API_KEY` — búsqueda en internet de los agentes ([gratis en tavily.com](https://tavily.com)).
  - `CREWAI_PLATFORM_INTEGRATION_TOKEN` — integración de Google Calendar (Settings → Integrations en app.crewai.com).

## Puesta en marcha

```bash
cp .env.example .env      # rellena tus claves (o copia el .env del backend original)
uv sync                   # crea el .venv e instala dependencias
uv run uvicorn backend_proyecto_planificador_de_viajes.main:app \
  --app-dir src --host 127.0.0.1 --port 8005 --reload
```

El servidor queda en `http://localhost:8005`. El frontend funciona sin cambios.
Para correr ambos backends a la vez y compararlos, mira la **Opción B** en `COMANDOS.md`.

## API

| Método | Ruta          | Descripción |
|--------|---------------|-------------|
| `GET`  | `/`           | Healthcheck. |
| `POST` | `/plan-trip`  | Recibe `{ "prompt": "..." }` y devuelve el itinerario. |

Respuesta de `/plan-trip`:

```json
{
  "chat_response": "…itinerario en markdown…",
  "download_content": "…documento completo en markdown…",
  "download_filename": "itinerary.md"
}
```

## El crew (1 manager + 6 especialistas, proceso jerárquico)

Definido en `src/backend_proyecto_planificador_de_viajes/crew.py`, con los roles y
tareas en `config/agents.yaml` y `config/tasks.yaml`.

| # | Agente | Rol en el proceso | Herramienta | Función |
|---|--------|-------------------|-------------|---------|
| 0 | **Jefe de Proyecto** (`agente_gestor_proyecto`) | **Manager** — coordina y delega | — | Reparte tareas, revisa entregas, pide correcciones. |
| 1 | Experto cultural | Trabajador | Búsqueda (Tavily) | Atracciones, museos, sitios históricos. |
| 2 | Gourmet local | Trabajador | Búsqueda (Tavily) | Restaurantes y gastronomía típica. |
| 3 | Logística | Trabajador | Búsqueda (Tavily) | Vuelos, hoteles, transporte, presupuesto. |
| 4 | Planificador de itinerario | Trabajador | — | Organiza todo en un plan día por día. |
| 5 | Gestor de agenda | Trabajador | Google Calendar | Crea un evento por cada día del viaje. |
| 6 | Redactor de viajes | Trabajador | — | Escribe el documento final (`itinerary.md`). |

En vez de una fila fija, el **Jefe de Proyecto** decide a qué especialista delegar
cada tarea, revisa lo que recibe y puede devolverlo para que lo corrijan. Ahí está
el "diálogo" entre agentes que no existe en el modo secuencial.

## Cómo está implementado el manager (para explicarlo en clase)

En `crew.py`:

1. `agente_gestor_proyecto()` — método **sin** el decorador `@agent` (así NO entra
   en la lista de trabajadores `self.agents`). Lleva `allow_delegation=True`, que es
   lo que le permite hablar con los demás agentes.
2. En `crew()`:
   ```python
   process=Process.hierarchical,
   manager_agent=self.agente_gestor_proyecto(),
   ```
   Alternativa más simple (sin agente personalizado): quitar `manager_agent` y usar
   `manager_llm="gpt-5.1"` para que CrewAI cree un manager genérico.

El rol/goal/backstory del manager está en `config/agents.yaml` bajo
`agente_gestor_proyecto`.

## Herramientas de búsqueda

- **`tools/busqueda_internet_tool.py`** — herramienta **activa**, basada en **Tavily**.
- **`tools/custom_tool.py`** — alternativa con **DuckDuckGo** (`ddgs`), gratis y sin API key.

## Estructura

```
src/backend_proyecto_planificador_de_viajes/
├── main.py                  # API FastAPI (endpoint /plan-trip) — idéntico al original
├── crew.py                  # Crew JERÁRQUICO (manager + agentes + tareas)
├── config/
│   ├── agents.yaml          # Roles, objetivos y backstories (incluye el manager)
│   └── tasks.yaml           # Descripciones y outputs esperados (idéntico al original)
└── tools/
    ├── busqueda_internet_tool.py   # Búsqueda con Tavily (activa)
    └── custom_tool.py              # Búsqueda con DuckDuckGo (alternativa)
```

## Notas

- El endpoint usa `kickoff_async` (requerido dentro del event loop de FastAPI).
- El tracing interactivo de CrewAI está desactivado (`tracing=False`).
- El modo jerárquico suele consumir **más tokens y tiempo** que el secuencial, porque
  el manager razona sobre cada delegación y revisión. Es normal.
- El itinerario final se guarda en `itinerary.md` y se devuelve en `download_content`.
