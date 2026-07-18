interface Props {
  // Ej: "Experto en Gastronomía Local está investigando…". Por defecto
  // "Pensando…" mientras no se sabe todavía qué agente va a responder
  // (ver App.tsx: se llama a /clasificar en paralelo con /plan-trip).
  label?: string;
}

// Indicador ligero para respuestas rápidas (chat / consulta puntual, 1 solo
// agente). Se muestra apenas se envía el mensaje.
export default function ThinkingIndicator({ label = "Pensando…" }: Props) {
  return (
    <div className="animate-float-in flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
      </span>
      {label}
    </div>
  );
}
