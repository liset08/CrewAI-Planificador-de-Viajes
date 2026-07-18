const STORAGE_KEY = "viajes_session_id";

/**
 * UUID estable por navegador (NO es autenticación): agrupa los mensajes de
 * esta conversación en Supabase para que el backend pueda cargar el
 * historial y la conversación sobreviva a un reload de la página.
 */
export function getSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  return resetSessionId();
}

/** Genera y guarda un session_id nuevo (usado por "Nuevo viaje" para no
 * arrastrar el historial de la conversación anterior como contexto). */
export function resetSessionId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
