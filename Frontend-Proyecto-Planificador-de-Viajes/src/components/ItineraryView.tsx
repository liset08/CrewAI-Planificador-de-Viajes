import { useMemo } from "react";
import { Download, FileText, CalendarRange, MapPinned } from "lucide-react";
import { parseItinerary } from "../lib/parseItinerary";
import { destinationImage, guessDestination } from "../lib/images";
import { downloadItineraryPdf } from "../lib/generatePdf";
import DayCard from "./DayCard";
import DestImage from "./DestImage";
import Markdown from "./Markdown";

interface ItineraryViewProps {
  markdown: string;
  downloadContent?: string | null;
  downloadFilename?: string | null;
  destinationHint?: string;
}

/**
 * Vista visual del itinerario: banner de destino, título, intro y una tarjeta
 * plegable por día. Si no se detectan días, hace fallback al markdown completo.
 */
export default function ItineraryView({
  markdown,
  downloadContent,
  downloadFilename,
  destinationHint,
}: ItineraryViewProps) {
  const parsed = useMemo(() => parseItinerary(markdown), [markdown]);
  const hasDays = parsed.days.length > 0;

  const destination =
    (destinationHint && destinationHint.trim()) ||
    guessDestination(parsed.title);

  const hero = destinationImage(destination, {
    w: 1200,
    h: 500,
    seed: `hero-${destination}`,
  });

  const handleDownload = () => {
    const content = downloadContent || markdown;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename || "itinerario.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    downloadItineraryPdf(parsed, markdown, downloadFilename || "itinerario");
  };

  return (
    <div className="space-y-4">
      {/* Banner con foto del destino */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <DestImage
          src={hero}
          alt={destination}
          className="h-44 w-full sm:h-52"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
              <MapPinned className="h-3.5 w-3.5" /> Tu itinerario
            </div>
            {parsed.title && (
              <h2 className="text-lg font-bold leading-tight text-white drop-shadow sm:text-xl">
                {parsed.title}
              </h2>
            )}
            {hasDays && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                <CalendarRange className="h-3.5 w-3.5" />
                {parsed.days.length}{" "}
                {parsed.days.length === 1 ? "día" : "días"} de viaje
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-slate-800 shadow transition-colors hover:bg-white"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Descargar PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800 shadow transition-colors hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">.md</span>
            </button>
          </div>
        </div>
      </div>

      {/* Intro */}
      {parsed.intro && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Markdown>{parsed.intro}</Markdown>
        </div>
      )}

      {/* Días o fallback */}
      {hasDays ? (
        <div className="space-y-3">
          {parsed.days.map((day, i) => (
            <DayCard
              key={day.index}
              day={day}
              destination={destination}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Markdown>{markdown}</Markdown>
        </div>
      )}
    </div>
  );
}
