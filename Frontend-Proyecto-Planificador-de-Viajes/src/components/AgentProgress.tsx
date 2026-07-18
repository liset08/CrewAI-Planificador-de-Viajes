import { useEffect, useState } from "react";
import {
  Landmark,
  UtensilsCrossed,
  Map,
  CalendarDays,
  PenLine,
  Check,
  Loader2,
} from "lucide-react";
import type { ComponentType } from "react";

interface Stage {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  approxSeconds: number;
}

// Refleja el flujo real del crew (crew.py): cultural -> gourmet -> logística
// -> planificador -> agenda (Google Calendar) -> redacción final.
const STAGES: Stage[] = [
  { key: "cultura", label: "Experto cultural buscando atracciones", icon: Landmark, approxSeconds: 25 },
  { key: "gourmet", label: "Gourmet local eligiendo dónde comer", icon: UtensilsCrossed, approxSeconds: 25 },
  { key: "logistica", label: "Logística cotizando vuelos y hoteles", icon: Map, approxSeconds: 30 },
  { key: "itinerario", label: "Planificando el itinerario día a día", icon: CalendarDays, approxSeconds: 30 },
  { key: "agenda", label: "Agendando eventos en tu calendario", icon: CalendarDays, approxSeconds: 20 },
  { key: "redaccion", label: "Redactando el documento final", icon: PenLine, approxSeconds: 25 },
];

/**
 * Línea de tiempo animada de los agentes trabajando. El backend responde con
 * un único POST (sin streaming), así que avanzamos las etapas por tiempo
 * estimado; la última se mantiene "en curso" hasta que llega la respuesta.
 */
export default function AgentProgress() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    STAGES.forEach((_, i) => {
      if (i === 0) return;
      acc += STAGES[i - 1].approxSeconds * 1000;
      const t = setTimeout(() => {
        if (!cancelled) setActive((prev) => Math.max(prev, i));
      }, acc);
      timers.push(t);
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="animate-float-in rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
        </span>
        Tu equipo de expertos está trabajando…
      </div>

      <ol className="space-y-2">
        {STAGES.map((stage, i) => {
          const done = i < active;
          const current = i === active;
          const Icon = stage.icon;
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                current
                  ? "bg-brand-50 ring-1 ring-brand-200"
                  : done
                  ? "opacity-70"
                  : "opacity-45"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                  done
                    ? "bg-emerald-100 text-emerald-600"
                    : current
                    ? "bg-brand-100 text-brand-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span
                className={`text-sm ${
                  current ? "text-slate-900" : "text-slate-600"
                }`}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-slate-400">
        Esto puede tardar entre 1 y varios minutos. No cierres la ventana.
      </p>
    </div>
  );
}
