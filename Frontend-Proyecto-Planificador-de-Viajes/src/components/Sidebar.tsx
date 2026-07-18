import {
  Plane,
  MessageSquare,
  Briefcase,
  Compass,
  Heart,
  Sparkles,
  Plus,
} from "lucide-react";
import type { ComponentType } from "react";

interface SidebarProps {
  onNewChat: () => void;
  userName: string;
}

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: number;
}

// Navegación decorativa al estilo Mindtrip (solo "Chats" es funcional: reinicia).
const NAV: NavItem[] = [
  { label: "Chats", icon: MessageSquare, active: true, badge: 1 },
  { label: "Viajes", icon: Briefcase },
  { label: "Explorar", icon: Compass },
  { label: "Guardados", icon: Heart },
  { label: "Inspiración", icon: Sparkles },
];

export default function Sidebar({ onNewChat, userName }: SidebarProps) {
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
          <Plane className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900">
          viajes<span className="text-brand-600">.ai</span>
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.active ? onNewChat : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                item.active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold text-brand-700">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Nuevo chat */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Nuevo viaje
        </button>
      </div>

      {/* Usuario */}
      <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sunset-400 to-sunset-600 text-sm font-bold text-white">
          {initials || "U"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {userName}
          </p>
          <p className="truncate text-xs text-slate-400">Plan gratuito</p>
        </div>
      </div>
    </aside>
  );
}
