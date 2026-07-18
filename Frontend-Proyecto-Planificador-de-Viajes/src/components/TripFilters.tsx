import { useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, CalendarDays, Users, Wallet, X, Minus, Plus } from "lucide-react";
import type { TripFilters } from "../types";

interface Props {
  value: TripFilters;
  onChange: (next: TripFilters) => void;
}

type FieldKey = keyof TripFilters;

const CHIPS: {
  key: FieldKey;
  label: string;
  icon: typeof MapPin;
}[] = [
  { key: "destino", label: "Dónde", icon: MapPin },
  { key: "cuando", label: "Cuándo", icon: CalendarDays },
  { key: "quien", label: "Quién", icon: Users },
  { key: "presupuesto", label: "Presupuesto", icon: Wallet },
];

const POPOVER_WIDTH = 320; // px, debe coincidir con w-80 más abajo

interface Anchor {
  top: number;
  left: number;
}

export default function TripFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState<FieldKey | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const set = (key: FieldKey, v: string) => onChange({ ...value, [key]: v });
  const close = () => setOpen(null);

  // El popover se saca del flujo normal (createPortal a document.body) y se
  // posiciona con coordenadas de viewport calculadas del botón que lo abrió.
  // Es necesario porque el header (App.tsx) tiene overflow-x-auto en el
  // contenedor de estos chips: eso hace que el navegador calcule también
  // overflow-y:auto (efecto colateral de CSS), recortando cualquier popover
  // "position: absolute" anidado ahí adentro en vez de dejarlo flotar debajo.
  const toggle = (key: FieldKey, el: HTMLButtonElement) => {
    if (open === key) {
      close();
      return;
    }
    const rect = el.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + 8,
      left: Math.max(
        16,
        Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 16)
      ),
    });
    setOpen(key);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CHIPS.map(({ key, label, icon: Icon }) => {
        const val = value[key];
        const isActive = Boolean(val);
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => toggle(key, e.currentTarget)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[11rem] truncate">
              {isActive ? val : label}
            </span>
            {isActive && (
              <X
                className="h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  set(key, "");
                  close();
                }}
              />
            )}
          </button>
        );
      })}

      {open &&
        anchor &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
            <div
              className="fixed z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
              style={{ top: anchor.top, left: anchor.left, maxWidth: "calc(100vw - 2rem)" }}
            >
              {open === "destino" && (
                <PopoverShell label="¿A dónde quieres viajar?" onDone={close}>
                  <TextField
                    icon={MapPin}
                    placeholder="Ej: Italia, Cusco, Tokio…"
                    value={value.destino}
                    onChange={(v) => set("destino", v)}
                    onDone={close}
                  />
                </PopoverShell>
              )}
              {open === "cuando" && (
                <PopoverShell label="¿Cuándo viajas?" onDone={close}>
                  <DateRangeField onChange={(v) => set("cuando", v)} />
                </PopoverShell>
              )}
              {open === "quien" && (
                <PopoverShell label="¿Quiénes viajan?" onDone={close}>
                  <TravelersField onChange={(v) => set("quien", v)} />
                </PopoverShell>
              )}
              {open === "presupuesto" && (
                <PopoverShell label="Presupuesto del viaje" onDone={close}>
                  <BudgetField
                    onChange={(v) => set("presupuesto", v)}
                    onDone={close}
                  />
                </PopoverShell>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function PopoverShell({
  label,
  onDone,
  children,
}: {
  label: string;
  onDone: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {children}
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Listo
      </button>
    </div>
  );
}

function TextField({
  icon: Icon,
  placeholder,
  value,
  onChange,
  onDone,
}: {
  icon: typeof MapPin;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        autoFocus
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onDone()}
        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}

// --- Cuándo: rango de fechas con datepicker nativo -------------------------

function parseIsoDateLocal(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // new Date(y, m-1, d) usa hora local: evita el corrimiento de un día que
  // da new Date("YYYY-MM-DD") al interpretarse como UTC.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDateRange(desdeIso: string, hastaIso: string): string {
  const desde = parseIsoDateLocal(desdeIso);
  const hasta = hastaIso ? parseIsoDateLocal(hastaIso) : null;
  if (!desde) return "";

  if (!hasta) return dateFormatter.format(desde);

  const noches = Math.round(
    (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)
  );
  const sufijo = noches > 0 ? ` (${noches} ${noches === 1 ? "noche" : "noches"})` : "";
  return `${dateFormatter.format(desde)} – ${dateFormatter.format(hasta)}${sufijo}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function DateRangeField({
  onChange,
}: {
  onChange: (v: string) => void;
}) {
  // Estado local propio: `value` (el filtro global) guarda el texto ya
  // formateado para el prompt, no las fechas ISO crudas, así que no hay de
  // dónde "recuperarlas" al reabrir el popover. Se empieza en blanco cada vez.
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const update = (nextDesde: string, nextHasta: string) => {
    setDesde(nextDesde);
    setHasta(nextHasta);
    onChange(nextDesde ? formatDateRange(nextDesde, nextHasta) : "");
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Desde</span>
        <input
          type="date"
          value={desde}
          min={todayIso()}
          onChange={(e) => update(e.target.value, hasta && hasta < e.target.value ? "" : hasta)}
          className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Hasta</span>
        <input
          type="date"
          value={hasta}
          min={desde || todayIso()}
          disabled={!desde}
          onChange={(e) => update(desde, e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-300"
        />
      </label>
    </div>
  );
}

// --- Quién: contadores de Adultos / Niños -----------------------------------

function formatTravelers(adultos: number, ninos: number): string {
  const partes: string[] = [];
  if (adultos > 0) partes.push(`${adultos} adulto${adultos === 1 ? "" : "s"}`);
  if (ninos > 0) partes.push(`${ninos} niño${ninos === 1 ? "" : "s"}`);
  return partes.join(", ");
}

function TravelersField({
  onChange,
}: {
  onChange: (v: string) => void;
}) {
  const [adultos, setAdultos] = useState(0);
  const [ninos, setNinos] = useState(0);

  const update = (nextAdultos: number, nextNinos: number) => {
    setAdultos(nextAdultos);
    setNinos(nextNinos);
    onChange(formatTravelers(nextAdultos, nextNinos));
  };

  return (
    <div className="space-y-2">
      <Stepper
        label="Adultos"
        hint="13 años o más"
        count={adultos}
        min={0}
        onChange={(n) => update(n, ninos)}
      />
      <Stepper
        label="Niños"
        hint="0 a 12 años"
        count={ninos}
        min={0}
        onChange={(n) => update(adultos, n)}
      />
    </div>
  );
}

function Stepper({
  label,
  hint,
  count,
  min,
  onChange,
}: {
  label: string;
  hint: string;
  count: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, count - 1))}
          disabled={count <= min}
          className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-4 text-center text-sm font-semibold text-slate-800">
          {count}
        </span>
        <button
          type="button"
          onClick={() => onChange(count + 1)}
          className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Presupuesto: monto en soles --------------------------------------------

const solesFormatter = new Intl.NumberFormat("es-PE");

function BudgetField({
  onChange,
  onDone,
}: {
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  // Igual que en DateRangeField: se parte de un input en blanco, `value` ya
  // trae el texto formateado ("S/ 1,500") y no el número crudo editable.
  const [monto, setMonto] = useState("");

  const commit = (raw: string) => {
    const n = Number(raw);
    onChange(raw && !Number.isNaN(n) && n > 0 ? `S/ ${solesFormatter.format(n)}` : "");
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
        S/
      </span>
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        min={0}
        step={50}
        value={monto}
        placeholder="0"
        onChange={(e) => {
          setMonto(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => e.key === "Enter" && onDone()}
        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}
