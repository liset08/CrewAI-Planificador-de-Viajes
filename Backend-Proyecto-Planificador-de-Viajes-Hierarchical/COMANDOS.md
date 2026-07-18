# ================================================================
# BACKEND — MODO JERÁRQUICO (Process.hierarchical)
# ================================================================
# Esta es una copia INDEPENDIENTE del backend original. La única diferencia
# real está en crew.py: aquí un "Jefe de Proyecto" (manager) coordina y delega
# el trabajo a los especialistas, en lugar de una tubería secuencial.
#
# Puedes lanzar UNO U OTRO backend (el original o este) — no ambos a la vez si
# usas el mismo puerto 8005, porque el frontend apunta a ese puerto por defecto.
# ================================================================

# ================================================================
# Frontend con React + Vite (igual que siempre)
# - Runtime: Node.js v26
# 1. Entrar a la carpeta del frontend
cd "Frontend-Proyecto-Planificador-de-Viajes"
# 2. Instalar dependencias (SOLO la primera vez, o si cambia package.json)
npm install
# 3. Levantar el servidor de desarrollo
npm run dev

Luego abre http://localhost:5173 en el navegador.

# ================================================================

# Opción A (recomendada): lanzar SOLO este backend en el puerto 8005
# --------------------------------------------------------------
# El frontend ya apunta a localhost:8005, así que NO hay que tocar nada más.
# Asegúrate de que el backend original NO esté corriendo (mismo puerto).
uv sync

uv run uvicorn backend_proyecto_planificador_de_viajes.main:app --app-dir src --host 127.0.0.1 --port 8005 --reload

# ================================================================

# Opción B: correr AMBOS backends a la vez para compararlos
# --------------------------------------------------------------
# 1) Deja el backend ORIGINAL en el puerto 8005 (su comando de siempre).
# 2) Lanza ESTE (jerárquico) en otro puerto, p.ej. 8006:
uv sync
uv run uvicorn backend_proyecto_planificador_de_viajes.main:app --app-dir src --host 127.0.0.1 --port 8006 --reload

# 3) Para que el frontend hable con el jerárquico (8006), levántalo así:
#    (variable BACKEND_ORIGIN que lee vite.config.ts)
cd "Frontend-Proyecto-Planificador-de-Viajes"
BACKEND_ORIGIN=http://localhost:8006 npm run dev

# ================================================================

# Despliegue sobre VPS por Contenedor de Docker (usa otra etiqueta)
## Comando para Loguearte en Docker Desktop
docker login

docker buildx build \
  --platform linux/amd64 \
  -t kevininofuentecolque/app-crewai-conversacional-backend-ai-engineer-13-hierarchical:latest \
  --push \
  .
