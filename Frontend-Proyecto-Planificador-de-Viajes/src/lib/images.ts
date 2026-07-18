// Utilidades para obtener fotos de destinos SIN API key, usando LoremFlickr
// (https://loremflickr.com/{w}/{h}/{keywords}). Devuelve fotos de Flickr que
// coinciden con las palabras clave. El parámetro ?lock={n} fija la foto para
// que sea estable entre renders (no cambie en cada recarga).

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Limpia y limita las palabras clave para la URL de LoremFlickr. */
function toKeywords(query: string, extra?: string): string {
  const words = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const all = extra ? [...words, extra] : words;
  return encodeURIComponent(all.join(","));
}

export function destinationImage(
  query: string,
  opts: { w?: number; h?: number; extra?: string; seed?: string } = {}
): string {
  const { w = 800, h = 600, extra, seed } = opts;
  const keywords = toKeywords(query || "travel", extra) || "travel";
  const lock = hashString(seed ?? query ?? "travel") % 1000;
  return `https://loremflickr.com/${w}/${h}/${keywords}?lock=${lock}`;
}

/**
 * Intenta adivinar el destino a partir del título del itinerario.
 * Ej: "Cusco en cuatro días: fiesta, historia..." -> "Cusco".
 */
export function guessDestination(title?: string): string {
  if (!title) return "travel destination";
  // Corta en el primer separador típico
  const head = title.split(/[:–\-,]|(?:\sen\s)/i)[0].trim();
  // Toma hasta 2 palabras significativas
  const words = head.split(/\s+/).filter((w) => w.length > 1);
  return words.slice(0, 2).join(" ") || title;
}
