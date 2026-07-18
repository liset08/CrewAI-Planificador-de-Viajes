// Filtros rápidos del planificador (chips Dónde / Cuándo / Quién / Presupuesto)
export interface TripFilters {
  destino: string; // "Italia", "Cusco"...
  cuando: string; // "Octubre, 7 días"
  quien: string; // "Pareja", "Familia"...
  presupuesto: string; // "Económico", "Medio", "Alto"
}

export const EMPTY_FILTERS: TripFilters = {
  destino: "",
  cuando: "",
  quien: "",
  presupuesto: "",
};

/**
 * Combina el texto libre del usuario con los filtros seleccionados en una
 * sola petición en lenguaje natural para el backend.
 */
export function composePrompt(freeText: string, f: TripFilters): string {
  const parts: string[] = [];
  const text = freeText.trim();
  if (text) parts.push(text);

  const extras: string[] = [];
  if (f.destino) extras.push(`Destino: ${f.destino}`);
  if (f.cuando) extras.push(`Cuándo/duración: ${f.cuando}`);
  if (f.quien) extras.push(`Viajeros: ${f.quien}`);
  if (f.presupuesto) extras.push(`Presupuesto: ${f.presupuesto}`);

  if (extras.length) {
    parts.push(
      (text ? "\n\nDetalles adicionales:\n- " : "Planifica un viaje.\n- ") +
        extras.join("\n- ")
    );
  }
  return parts.join("");
}

// Un lugar/plato/opción recomendada dentro de una respuesta de consulta_puntual
// (ver RespuestaConsultaPuntual en el backend). "nombre" se usa para buscarle
// una imagen representativa en el frontend.
export interface RecommendedItem {
  nombre: string;
  descripcion: string;
  // Imagen real encontrada por el backend con Tavily (ver router.py). Si es
  // null/undefined, el frontend hace fallback a una foto genérica por
  // palabras clave (ver RecommendedItems.tsx).
  imagen_url?: string | null;
}

// Respuesta del backend (endpoint /plan-trip)
export interface PlanTripResponse {
  chat_response: string;
  download_content?: string | null;
  download_filename?: string | null;
  items?: RecommendedItem[];
}

export type Role = "user" | "assistant";

export type Categoria = "chat" | "consulta_puntual" | "plan_completo";

// Respuesta del endpoint /clasificar (ver main.py): permite mostrar el
// loader correcto ANTES de que llegue la respuesta real de /plan-trip.
export interface ClasificacionResponse {
  categoria: Categoria;
  // Nombre del especialista (ej: "Experto en Gastronomía Local"), solo si
  // categoria === "consulta_puntual".
  agente: string | null;
}

// Turno crudo tal como se guarda/lee de Supabase (endpoint /history).
export interface ChatTurn {
  role: Role;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  // Contenido markdown descargable (itinerario completo), si aplica
  downloadContent?: string | null;
  downloadFilename?: string | null;
  // Lugares/platos mencionados en la respuesta, con imagen propia (ver RecommendedItems.tsx)
  items?: RecommendedItem[];
  // Marca de error para estilizar distinto
  isError?: boolean;
}

// --- Itinerario parseado para la vista visual ---
export interface ItineraryDay {
  index: number; // 1, 2, 3...
  title: string; // "Día 1 – Lunes 15 de junio"
  subtitle?: string; // segunda línea en negrita bajo el título
  bodyMarkdown: string; // el resto del contenido del día (markdown)
}

export interface ParsedItinerary {
  title?: string; // título principal del documento (# ...)
  intro?: string; // párrafos introductorios antes del primer día
  days: ItineraryDay[];
}
