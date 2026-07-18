import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// El backend (FastAPI + CrewAI) corre por defecto en http://localhost:8005.
// Usamos un proxy en /api para evitar problemas de CORS en desarrollo:
// el frontend llama a /api/plan-trip y Vite lo reenvía a localhost:8005/plan-trip.
// Se puede sobreescribir el origen con BACKEND_ORIGIN en el entorno o .env.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const BACKEND_ORIGIN = env.BACKEND_ORIGIN ?? "https://herramientas-crewai-planificador-de-viajes-github.bvhmwj.easypanel.host";//"http://localhost:8005";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: BACKEND_ORIGIN,
          changeOrigin: true,
          // /api/plan-trip -> /plan-trip
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
