import { jsPDF } from "jspdf";
import type { ParsedItinerary } from "../types";

// Construye un PDF de texto real (seleccionable, no una captura de imagen)
// a partir del itinerario ya parseado (parseItinerary.ts). No usa ningún
// servicio externo: jsPDF genera el archivo enteramente en el navegador.

const MARGIN = 18; // mm
const PAGE_H = 297; // A4
const PAGE_W = 210;
const MAX_WIDTH = PAGE_W - MARGIN * 2;

const FONT = "helvetica";
const BODY_SIZE = 10.5;
const LINE_HEIGHT = 5; // mm por línea a BODY_SIZE

interface Cursor {
  y: number;
}

function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number) {
  if (cursor.y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    cursor.y = MARGIN;
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
  opts: { x?: number; width?: number; size?: number; style?: "normal" | "bold" | "italic" } = {}
) {
  const { x = MARGIN, width = MAX_WIDTH, size = BODY_SIZE, style = "normal" } = opts;
  const clean = stripInlineMarks(text);
  if (!clean) return;

  doc.setFont(FONT, style);
  doc.setFontSize(size);
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
  const size = level === 1 ? 18 : level === 2 ? 14 : 12;
  const spaceBefore = level === 1 ? 0 : level === 2 ? 6 : 3;

  ensureSpace(doc, cursor, spaceBefore + size / 2.5);
  cursor.y += spaceBefore;

  doc.setFont(FONT, "bold");
  doc.setFontSize(size);
  const lines: string[] = doc.splitTextToSize(clean, MAX_WIDTH);
  for (const line of lines) {
    ensureSpace(doc, cursor, size / 2.5);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += size / 2.5;
  }
  cursor.y += 2;
}

/** Detecta el patrón "- **Nombre**: descripción" (el que usa el backend
 * para lugares/platos recomendados) y lo renderiza con el nombre en negrita
 * en su propia línea, para que resalte igual que en el chat. */
function writeBullet(doc: jsPDF, cursor: Cursor, rawLine: string, indentLevel: number) {
  const indent = MARGIN + indentLevel * 5;
  const width = MAX_WIDTH - indentLevel * 5;
  const withoutMarker = rawLine.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");

  const namedMatch = withoutMarker.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
  if (namedMatch) {
    const [, nombre, resto] = namedMatch;
    writeParagraph(doc, cursor, `• ${nombre}`, { x: indent, width, style: "bold" });
    if (resto.trim()) {
      writeParagraph(doc, cursor, resto, { x: indent + 4, width: width - 4 });
    }
    return;
  }

  writeParagraph(doc, cursor, `• ${withoutMarker}`, { x: indent, width });
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

export function downloadItineraryPdf(
  parsed: ParsedItinerary,
  rawMarkdownFallback: string,
  filename: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cursor: Cursor = { y: MARGIN };

  if (parsed.title) {
    writeHeading(doc, cursor, parsed.title, 1);
    cursor.y += 2;
  }

  if (parsed.intro) {
    renderMarkdownBody(doc, cursor, parsed.intro);
    cursor.y += 2;
  }

  if (parsed.days.length > 0) {
    parsed.days.forEach((day) => {
      ensureSpace(doc, cursor, 14);
      cursor.y += 4;
      writeHeading(doc, cursor, day.title, 2);
      if (day.subtitle) {
        writeParagraph(doc, cursor, day.subtitle, { style: "italic" });
        cursor.y += 1;
      }
      renderMarkdownBody(doc, cursor, day.bodyMarkdown);
    });
  } else if (!parsed.intro) {
    // Fallback total: no se detectaron ni intro ni días (markdown "plano").
    renderMarkdownBody(doc, cursor, rawMarkdownFallback);
  }

  const name = (filename || "itinerario").replace(/\.md$/i, "");
  doc.save(`${name}.pdf`);
}
