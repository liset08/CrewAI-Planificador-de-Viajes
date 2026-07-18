import { jsPDF } from "jspdf";
import type { ParsedItinerary } from "../types";

// Construye un PDF de texto real (seleccionable, no una captura de imagen)
// a partir del itinerario ya parseado (parseItinerary.ts). No usa ningún
// servicio externo: jsPDF genera el archivo enteramente en el navegador.
// El diseño reutiliza la misma paleta "brand" de la web (ver src/index.css).

const MARGIN = 18; // mm
const PAGE_H = 297; // A4
const PAGE_W = 210;
const MAX_WIDTH = PAGE_W - MARGIN * 2;

const FONT = "helvetica";
const BODY_SIZE = 10.5;
const LINE_HEIGHT = 5; // mm por línea a BODY_SIZE

type RGB = [number, number, number];

const BRAND_50: RGB = [238, 246, 255];
const BRAND_100: RGB = [217, 234, 255];
const BRAND_500: RGB = [51, 133, 251];
const BRAND_600: RGB = [31, 102, 240];
const BRAND_700: RGB = [26, 81, 221];
const SLATE_800: RGB = [30, 41, 59];
const SLATE_700: RGB = [51, 65, 85];
const SLATE_600: RGB = [71, 85, 105];
const SLATE_400: RGB = [148, 163, 184];
const SLATE_200: RGB = [226, 232, 240];

const HEADER_H = 42; // mm, alto de la portada de color en la primera página

interface Cursor {
  y: number;
}

/** Avanza a una página nueva y dibuja una franja de color arriba, para que
 * el resto del documento mantenga la identidad visual de la portada. */
function goToNewPage(doc: jsPDF, cursor: Cursor) {
  doc.addPage();
  doc.setFillColor(...BRAND_500);
  doc.rect(0, 0, PAGE_W, 2.2, "F");
  cursor.y = MARGIN + 3;
}

function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number) {
  if (cursor.y + needed > PAGE_H - MARGIN) {
    goToNewPage(doc, cursor);
  }
}

/** Quita marcado inline de markdown (negrita, cursiva, links, código, imágenes)
 * dejando solo el texto legible; jsPDF no interpreta markdown. */
function stripInlineMarks(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*(?!\*)(.+?)\*(?!\*)/g, "$1")
    .trim();
}

function writeParagraph(
  doc: jsPDF,
  cursor: Cursor,
  text: string,
  opts: {
    x?: number;
    width?: number;
    size?: number;
    style?: "normal" | "bold" | "italic";
    color?: RGB;
  } = {}
) {
  const {
    x = MARGIN,
    width = MAX_WIDTH,
    size = BODY_SIZE,
    style = "normal",
    color = SLATE_700,
  } = opts;
  const clean = stripInlineMarks(text);
  if (!clean) return;

  doc.setFont(FONT, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines: string[] = doc.splitTextToSize(clean, width);

  for (const line of lines) {
    ensureSpace(doc, cursor, LINE_HEIGHT);
    doc.text(line, x, cursor.y);
    cursor.y += LINE_HEIGHT;
  }
}

function writeHeading(doc: jsPDF, cursor: Cursor, text: string, level: 1 | 2 | 3) {
  const clean = stripInlineMarks(text);
  if (!clean) return;
  const size = level === 1 ? 18 : level === 2 ? 14 : 11;
  const spaceBefore = level === 1 ? 0 : level === 2 ? 6 : 4;

  ensureSpace(doc, cursor, spaceBefore + size / 2.5);
  cursor.y += spaceBefore;

  // Los subtítulos de sección dentro de un día (ej. "Mañana", "Tarde") llevan
  // una pequeña barra de color a la izquierda para diferenciarlos del resto.
  if (level === 3) {
    doc.setFillColor(...BRAND_500);
    doc.rect(MARGIN, cursor.y - 3.4, 1.3, 4.6, "F");
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...(level === 3 ? BRAND_700 : SLATE_800));
  const textX = level === 3 ? MARGIN + 4 : MARGIN;
  const lines: string[] = doc.splitTextToSize(clean, MAX_WIDTH - (level === 3 ? 4 : 0));
  for (const line of lines) {
    ensureSpace(doc, cursor, size / 2.5);
    doc.text(line, textX, cursor.y);
    cursor.y += size / 2.5;
  }
  cursor.y += 2;
}

function drawDot(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...BRAND_500);
  doc.circle(x, y - 1.5, 0.9, "F");
}

/** Detecta el patrón "- **Nombre**: descripción" (el que usa el backend
 * para lugares/platos recomendados) y lo renderiza con el nombre en negrita
 * en su propia línea, con un punto de color en vez del guion original. */
function writeBullet(doc: jsPDF, cursor: Cursor, rawLine: string, indentLevel: number) {
  const indent = MARGIN + indentLevel * 5;
  const dotX = indent + 1.2;
  const textX = indent + 5;
  const width = MAX_WIDTH - indentLevel * 5 - 5;
  const withoutMarker = rawLine.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");

  ensureSpace(doc, cursor, LINE_HEIGHT);
  drawDot(doc, dotX, cursor.y);

  const namedMatch = withoutMarker.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
  if (namedMatch) {
    const [, nombre, resto] = namedMatch;
    writeParagraph(doc, cursor, nombre, { x: textX, width, style: "bold", color: SLATE_800 });
    if (resto.trim()) {
      writeParagraph(doc, cursor, resto, { x: textX, width, color: SLATE_600 });
    }
    return;
  }

  writeParagraph(doc, cursor, withoutMarker, { x: textX, width });
}

/** Recorre un bloque de markdown (intro o el cuerpo de un día) línea por
 * línea, agrupando párrafos, y despachando encabezados/bullets/texto plano
 * a las funciones de arriba. No es un parser de markdown completo (no hace
 * falta: el objetivo es un PDF legible, no un renderizado pixel-perfect). */
function renderMarkdownBody(doc: jsPDF, cursor: Cursor, markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) {
      writeParagraph(doc, cursor, buffer.join(" "));
      cursor.y += 1.5;
      buffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flush();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flush();
      const level = Math.min(headingMatch[1].length + 1, 3) as 1 | 2 | 3;
      writeHeading(doc, cursor, headingMatch[2], level);
      continue;
    }

    const bulletMatch = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+/);
    if (bulletMatch) {
      flush();
      const indentLevel = Math.floor(bulletMatch[1].length / 2);
      writeBullet(doc, cursor, line, indentLevel);
      continue;
    }

    if (/^-{3,}\s*$/.test(line)) {
      flush();
      continue;
    }

    buffer.push(line.trim());
  }
  flush();
}

/** Portada de color en la primera página: título, y metadatos (fecha de
 * generación, cantidad de días) igual que en el hero de ItineraryView. */
function drawCoverHeader(doc: jsPDF, cursor: Cursor, parsed: ParsedItinerary) {
  doc.setFillColor(...BRAND_600);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");
  doc.setFillColor(...BRAND_700);
  doc.rect(0, HEADER_H - 3, PAGE_W, 3, "F");

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_100);
  doc.text("ITINERARIO DE VIAJE", MARGIN, 13);

  doc.setFont(FONT, "bold");
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  const titleText = stripInlineMarks(parsed.title || "Tu itinerario de viaje");
  const titleLines = doc.splitTextToSize(titleText, MAX_WIDTH).slice(0, 2);
  let ty = 25;
  for (const line of titleLines) {
    doc.text(line, MARGIN, ty);
    ty += 8;
  }

  const meta: string[] = [
    `Generado el ${new Date().toLocaleDateString("es-PE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
  ];
  if (parsed.days.length > 0) {
    meta.push(`${parsed.days.length} ${parsed.days.length === 1 ? "día" : "días"} de viaje`);
  }
  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_100);
  doc.text(meta.join("   •   "), MARGIN, HEADER_H - 8);

  cursor.y = HEADER_H + 12;
}

/** Encabezado de cada día: una "tarjeta" con fondo suave, un badge "DÍA N"
 * en color sólido y, si existe, el subtítulo del día debajo. */
function writeDayHeading(
  doc: jsPDF,
  cursor: Cursor,
  day: ParsedItinerary["days"][number]
) {
  const pillLabel = `DÍA ${day.index}`;
  const strippedTitle = day.title.replace(/^d[ií]a\s+\d+\s*[-–:]*\s*/i, "").trim();
  const titleText = stripInlineMarks(strippedTitle || day.title);

  const padTop = 4;
  const rowH = 9;
  const subtitleH = day.subtitle ? 6 : 0;
  const padBottom = 4;
  const blockH = padTop + rowH + subtitleH + padBottom;

  ensureSpace(doc, cursor, blockH + 8);
  cursor.y += 6;

  const blockTop = cursor.y - 4;
  doc.setFillColor(...BRAND_50);
  doc.roundedRect(MARGIN - 4, blockTop, MAX_WIDTH + 8, blockH, 3, 3, "F");

  doc.setFont(FONT, "bold");
  doc.setFontSize(9.5);
  const pillTextW = doc.getTextWidth(pillLabel);
  const pillH = 7;
  const pillW = pillTextW + 8;
  const pillX = MARGIN;
  const pillY = blockTop + padTop;

  doc.setFillColor(...BRAND_600);
  doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2, pillH / 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(pillLabel, pillX + pillW / 2, pillY + pillH / 2 + 1.2, { align: "center" });

  doc.setFont(FONT, "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...SLATE_800);
  const titleX = pillX + pillW + 5;
  const titleMaxW = MAX_WIDTH - (pillW + 5);
  const titleLines = doc.splitTextToSize(titleText, titleMaxW);
  doc.text(titleLines[0] ?? "", titleX, pillY + pillH / 2 + 1.2);

  let y = blockTop + padTop + rowH;
  if (day.subtitle) {
    doc.setFont(FONT, "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE_600);
    doc.text(stripInlineMarks(day.subtitle), pillX, y + 3);
    y += subtitleH;
  }

  cursor.y = blockTop + blockH + 7;
}

/** Dibuja el pie de página (línea + numeración) en todas las páginas ya
 * generadas. Se hace al final porque recién ahí se sabe el total. */
function drawFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_400);
    doc.text("Planificador de Viajes IA", MARGIN, PAGE_H - 9);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
  }
}

export function downloadItineraryPdf(
  parsed: ParsedItinerary,
  rawMarkdownFallback: string,
  filename: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cursor: Cursor = { y: MARGIN };

  drawCoverHeader(doc, cursor, parsed);

  if (parsed.intro) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND_600);
    doc.text("RESUMEN DEL VIAJE", MARGIN, cursor.y);
    cursor.y += 6;
    renderMarkdownBody(doc, cursor, parsed.intro);
    cursor.y += 2;
  }

  if (parsed.days.length > 0) {
    parsed.days.forEach((day) => {
      writeDayHeading(doc, cursor, day);
      renderMarkdownBody(doc, cursor, day.bodyMarkdown);
    });
  } else if (!parsed.intro) {
    // Fallback total: no se detectaron ni intro ni días (markdown "plano").
    renderMarkdownBody(doc, cursor, rawMarkdownFallback);
  }

  drawFooters(doc);

  const name = (filename || "itinerario").replace(/\.md$/i, "");
  doc.save(`${name}.pdf`);
}
