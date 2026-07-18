import type { ChatTurn, ClasificacionResponse, PlanTripResponse } from "../types";
import { getSessionId } from "./session";

// En desarrollo, VITE_BACKEND_URL = /api/plan-trip (proxy de Vite -> localhost:8005).
// En producción (ej: Vercel), hay que definir esta env var con la URL pública
// del backend (ej: https://tu-backend.easypanel.host/plan-trip) -- se hornea
// en el build, así que un cambio acá requiere volver a deployar el frontend.
export const PLAN_TRIP_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "/api/plan-trip";

// Base del backend derivada de PLAN_TRIP_URL (le quita el "/plan-trip" final),
// para pegarle también al endpoint de historial sin agregar otra env var.
const API_BASE = PLAN_TRIP_URL.replace(/\/plan-trip$/, "");

/**
 * Envía la petición de viaje al backend (CrewAI) y devuelve la respuesta estructurada.
 * El crew puede tardar varios minutos, por eso el timeout es alto (10 min).
 * No se manda el historial: el backend lo guarda/lee de Supabase usando el
 * session_id (ver src/lib/session.ts).
 */
export async function planTrip(prompt: string): Promise<PlanTripResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000); // 10 min

  try {
    const res = await fetch(PLAN_TRIP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, session_id: getSessionId() }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = "";
      try {
        const data = await res.json();
        detail = data?.details || data?.message || "";
      } catch {
        /* respuesta no-JSON */
      }
      throw new Error(
        `El servidor respondió ${res.status}${detail ? `: ${detail}` : ""}`
      );
    }

    return (await res.json()) as PlanTripResponse;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Historial de la conversación actual (session_id), guardado en Supabase.
 * Se usa al montar la app para restaurar el chat tras un reload de página.
 */
export async function fetchHistory(): Promise<ChatTurn[]> {
  const res = await fetch(`${API_BASE}/history/${getSessionId()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { history: ChatTurn[] };
  return data.history ?? [];
}

/**
 * Clasificación rápida (1-2 llamadas cortas al LLM) para saber qué loader
 * mostrar mientras se espera la respuesta real de planTrip. Se llama en
 * paralelo con planTrip, no antes: no tiene sentido bloquear la respuesta
 * real esperando esto. Si falla, se ignora (el chat sigue funcionando con
 * el loader genérico).
 */
export async function classify(prompt: string): Promise<ClasificacionResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/clasificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, session_id: getSessionId() }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClasificacionResponse;
  } catch {
    return null;
  }
}
