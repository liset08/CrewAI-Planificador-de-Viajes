# Frontend — Planificador de Viajes IA (React + Vite)

Interfaz de chat para el planificador de viajes con CrewAI. Reemplaza al
frontend anterior de Streamlit con una UI moderna en **React + Vite +
TypeScript + Tailwind CSS v4**, que además renderiza el itinerario de forma
visual (tarjetas plegables por día) en lugar de texto plano.

## Requisitos

- Node.js 18+ (probado con Node 26)
- El backend (FastAPI + CrewAI) corriendo, por defecto en `http://localhost:8005`

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre http://localhost:5173

En desarrollo, Vite hace de proxy: el frontend llama a `/api/plan-trip` y se
reenvía a `http://localhost:8005/plan-trip`, evitando problemas de CORS. Si tu
backend corre en otro origen:

```bash
BACKEND_ORIGIN=http://localhost:8080 npm run dev
```

## Variables de entorno

`.env`:

```
VITE_BACKEND_URL=/api/plan-trip
```

- **Desarrollo:** déjalo como `/api/plan-trip` (usa el proxy de Vite).
- **Producción:** apunta a la URL pública del backend, p.ej.
  `VITE_BACKEND_URL=https://mi-backend.run.app/plan-trip`.

## Build de producción

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ localmente
```

## Estructura

```
src/
  App.tsx                 # Estado del chat y orquestación
  lib/
    api.ts                # Cliente del endpoint /plan-trip
    parseItinerary.ts     # Parseo del markdown a días
  components/
    Header.tsx
    ChatInput.tsx
    ChatMessageView.tsx   # Burbuja o itinerario visual según el contenido
    AgentProgress.tsx     # Línea de tiempo animada de los agentes
    ItineraryView.tsx     # Cabecera + intro + tarjetas por día
    DayCard.tsx           # Tarjeta plegable de un día
    Markdown.tsx          # Renderizador de markdown con estilos del tema
  types.ts
```

## Contrato con el backend

`POST {VITE_BACKEND_URL}` con body `{ "prompt": "..." }` y respuesta:

```json
{
  "chat_response": "…markdown…",
  "download_content": "…itinerario completo en markdown…",
  "download_filename": "itinerary.md"
}
```
