import { useState } from "react";
import { MapPin, CalendarDays, Users, Wallet, X } from "lucide-react";
import type { TripFilters } from "../types";

interface Props {
  value: TripFilters;
  onChange: (next: TripFilters) => void;
}

const QUIEN_OPTS = ["Solo/a", "Pareja", "Familia", "Amigos"];
const PRESUPUESTO_OPTS = ["Económico", "Medio", "Alto"];

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

export default function TripFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState<FieldKey | null>(null);

  const set = (key: FieldKey, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.map(({ key, label, icon: Icon }) => {
          const val = value[key];
          const isActive = Boolean(val);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpen((cur) => (cur === key ? null : key))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {isActive ? val : label}
              {isActive && (
                <X
                  className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    set(key, "");
                    setOpen(null);
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Popover */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(null)}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            {open === "destino" && (
              <TextField
                placeholder="Ej: Italia, Cusco, Tokio…"
                value={value.destino}
                onChange={(v) => set("destino", v)}
                onDone={() => setOpen(null)}
              />
            )}
            {open === "cuando" && (
              <TextField
                placeholder="Ej: Octubre, 7 días"
                value={value.cuando}
                onChange={(v) => set("cuando", v)}
                onDone={() => setOpen(null)}
              />
            )}
            {open === "quien" && (
              <OptionGrid
                options={QUIEN_OPTS}
                value={value.quien}
                onSelect={(v) => {
                  set("quien", v);
                  setOpen(null);
                }}
              />
            )}
            {open === "presupuesto" && (
              <OptionGrid
                options={PRESUPUESTO_OPTS}
                value={value.presupuesto}
                onSelect={(v) => {
                  set("presupuesto", v);
                  setOpen(null);
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TextField({
  placeholder,
  value,
  onChange,
  onDone,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  return (
    <input
      autoFocus
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onDone()}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
    />
  );
}

function OptionGrid({
  options,
  value,
  onSelect,
}: {
  options: string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(opt)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            value === opt
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
