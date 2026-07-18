import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ItineraryDay } from "../types";
import Markdown from "./Markdown";
import DestImage from "./DestImage";
import { destinationImage } from "../lib/images";

interface DayCardProps {
  day: ItineraryDay;
  destination: string;
  defaultOpen?: boolean;
}

export default function DayCard({
  day,
  destination,
  defaultOpen = false,
}: DayCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const thumb = destinationImage(destination, {
    w: 240,
    h: 240,
    seed: `${destination}-dia-${day.index}`,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-brand-300">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="relative shrink-0">
          <DestImage
            src={thumb}
            alt={`${destination} — día ${day.index}`}
            className="h-14 w-14 rounded-xl"
          />
          <span className="absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white shadow ring-2 ring-white">
            {day.index}
          </span>
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {day.title}
          </span>
          {day.subtitle && (
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {day.subtitle}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          <Markdown>{day.bodyMarkdown}</Markdown>
        </div>
      )}
    </div>
  );
}
