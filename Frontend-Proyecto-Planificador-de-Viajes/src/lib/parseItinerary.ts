import type { ParsedItinerary, ItineraryDay } from "../types";

/**
 * Parsea el markdown del itinerario generado por el backend a una estructura
 * navegable por días. El backend produce documentos con la forma:
 *
 *   # Título principal
 *   ...intro...
 *   ## Día 1 – Lunes 15 de junio
 *   **Subtítulo del día**
 *   ### Mañana: ...
 *   ...
 *   ## Día 2 – ...
 *
 * Si no se detecta ningún "## Día", devolvemos days = [] y el llamador puede
 * hacer fallback a renderizar el markdown completo.
 */
export function parseItinerary(markdown: string): ParsedItinerary {
  if (!markdown || !markdown.trim()) {
    return { days: [] };
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let title: string | undefined;
  const introLines: string[] = [];
  const days: ItineraryDay[] = [];

  // Detecta encabezados "## Día N", "## Día N:", "## Día N –", etc.
  const dayHeadingRe = /^##\s+(d[ií]a\s+\d+.*)$/i;
  const h1Re = /^#\s+(.*)$/;

  let current: ItineraryDay | null = null;
  let dayIndex = 0;
  const buffer: string[] = [];

  const flushBuffer = (target: string[]) => {
    while (buffer.length) target.push(buffer.shift() as string);
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const dayMatch = line.match(dayHeadingRe);

    if (dayMatch) {
      // Cerrar día anterior
      if (current) {
        current.bodyMarkdown = buffer.join("\n").trim();
        buffer.length = 0;
        days.push(current);
      } else {
        // Lo acumulado antes del primer día es intro
        flushBuffer(introLines);
      }
      dayIndex += 1;
      current = {
        index: dayIndex,
        title: cleanHeading(dayMatch[1]),
        bodyMarkdown: "",
      };
      continue;
    }

    // Título principal (solo el primer H1)
    const h1 = line.match(h1Re);
    if (h1 && !title && !current) {
      title = cleanHeading(h1[1]);
      continue;
    }

    buffer.push(line);
  }

  // Cerrar el último bloque
  if (current) {
    current.bodyMarkdown = buffer.join("\n").trim();
    days.push(current);
  } else {
    flushBuffer(introLines);
  }

  // El primer párrafo en negrita bajo el título del día se usa como subtítulo
  for (const day of days) {
    const { subtitle, rest } = extractSubtitle(day.bodyMarkdown);
    day.subtitle = subtitle;
    day.bodyMarkdown = rest;
  }

  const intro = introLines
    .join("\n")
    .replace(/^-{3,}\s*$/gm, "") // quita separadores ---
    .trim();

  return { title, intro: intro || undefined, days };
}

function cleanHeading(text: string): string {
  return text.trim().replace(/\s+$/g, "");
}

/**
 * Si la primera línea con contenido del cuerpo es un texto en **negrita**,
 * la usamos como subtítulo de la tarjeta y la quitamos del cuerpo.
 */
function extractSubtitle(body: string): { subtitle?: string; rest: string } {
  const trimmed = body.replace(/^-{3,}\s*$/gm, "").trimStart();
  const lines = trimmed.split("\n");

  // Buscar la primera línea no vacía
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;

  if (i < lines.length) {
    const first = lines[i].trim();
    const boldMatch = first.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) {
      const rest = lines.slice(i + 1).join("\n").trim();
      return { subtitle: boldMatch[1].trim(), rest };
    }
  }
  return { rest: trimmed.trim() };
}
