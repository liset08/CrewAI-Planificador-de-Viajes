import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, Compass, Sparkles } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TripFilters from "./components/TripFilters";
import ChatInput from "./components/ChatInput";
import ChatMessageView from "./components/ChatMessageView";
import AgentProgress from "./components/AgentProgress";
import ThinkingIndicator from "./components/ThinkingIndicator";
import DestImage from "./components/DestImage";
import { PLAN_TRIP_URL, classify, fetchHistory, planTrip } from "./lib/api";
import { resetSessionId } from "./lib/session";
import { destinationImage } from "./lib/images";
import { EMPTY_FILTERS, composePrompt } from "./types";
import type {
  ChatMessage,
  ClasificacionResponse,
  TripFilters as Filters,
} from "./types";

const USER_NAME = "Liset Amaro";

// Tarjetas de inspiración de la pantalla de bienvenida
const INSPIRATION: { title: string; query: string; prompt: string }[] = [
  {
    title: "Costa de Italia en pareja",
    query: "italy amalfi coast",
    prompt:
      "Un viaje de 10 días por la costa de Italia para una pareja, enfocado en comida y cultura.",
  },
  {
    title: "Naturaleza en Costa Rica",
    query: "costa rica rainforest",
    prompt:
      "Una aventura de 2 semanas en Costa Rica para amantes de la naturaleza con presupuesto moderado.",
  },
  {
    title: "3 días en Nueva York",
    query: "new york city",
    prompt: "¿Qué puedo hacer en 3 días en Nueva York con un presupuesto de $500?",
  },
  {
    title: "Cusco e Inti Raymi",
    query: "cusco peru",
    prompt:
      "4 días en Cusco en junio para vivir el Inti Raymi, historia inca y gastronomía.",
  },
];

let idCounter = 0;
const nextId = () => `${Date.now()}-${idCounter++}`;

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  // Qué está pasando con el mensaje que se está esperando (categoría +
  // agente si aplica). null mientras /clasificar todavía no responde, o si
  // falló (en ese caso se muestra el loader genérico "Pensando…").
  const [loadingInfo, setLoadingInfo] = useState<ClasificacionResponse | null>(
    null
  );
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasConversation = messages.length > 0;
  const hasAnyFilter = useMemo(
    () => Object.values(filters).some(Boolean),
    [filters]
  );
  const allFiltersFilled = useMemo(
    () => Object.values(filters).every(Boolean),
    [filters]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Restaura la conversación guardada en Supabase (por session_id) al
  // recargar la página, para que no se pierda el chat.
  useEffect(() => {
    fetchHistory().then((history) => {
      if (history.length === 0) return;
      setMessages(
        history.map((turn) => ({
          id: nextId(),
          role: turn.role,
          content: turn.content,
        }))
      );
    });
  }, []);

  const resetChat = () => {
    if (loading) return;
    // Sesión nueva: así el backend no arrastra el historial de la
    // conversación anterior como contexto para el siguiente mensaje.
    resetSessionId();
    setMessages([]);
    setFilters(EMPTY_FILTERS);
  };

  const handleSend = async (freeText: string) => {
    if (loading) return;
    const prompt = composePrompt(freeText, filters);
    if (!prompt.trim()) return;

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: prompt,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setLoadingInfo(null);
    // No se espera esta respuesta antes de llamar a planTrip: corre en
    // paralelo solo para actualizar el loader (ver ThinkingIndicator/AgentProgress).
    classify(prompt).then(setLoadingInfo);

    try {
      const res = await planTrip(prompt);
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content:
          res.chat_response ||
          "Lo siento, no pude generar una respuesta esta vez.",
        downloadContent: res.download_content,
        downloadFilename: res.download_filename,
        items: res.items,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const isAbort = detail.toLowerCase().includes("abort");
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        isError: true,
        content: isAbort
          ? "**La solicitud tardó demasiado y se canceló.** El equipo de agentes puede tardar varios minutos; intenta de nuevo o simplifica tu petición."
          : `**No pude comunicarme con el equipo de expertos.**\n\nVerifica que el backend esté corriendo y sea accesible en \`${PLAN_TRIP_URL}\`, y que permita peticiones desde este dominio (CORS).\n\n*Detalle: ${detail}*`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <Sidebar onNewChat={resetChat} userName={USER_NAME} />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top bar con chips de filtros */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
              <Plane className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <TripFilters value={filters} onChange={setFilters} />
          </div>
          {allFiltersFilled && (
            <button
              type="button"
              onClick={() => handleSend("")}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Planificar viaje
            </button>
          )}
        </header>

        {/* Área de scroll */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {!hasConversation ? (
              <div className="animate-float-in mx-auto max-w-2xl pt-6 text-center">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/30">
                  <Compass className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  ¿Adónde vamos hoy, {USER_NAME}?
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Cuéntame tu viaje ideal —o usa los filtros de arriba— y mi
                  equipo de agentes de IA armará un itinerario personalizado,
                  día por día.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                  {INSPIRATION.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleSend(item.prompt)}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                    >
                      <DestImage
                        src={destinationImage(item.query, {
                          w: 400,
                          h: 300,
                          seed: item.title,
                        })}
                        alt={item.title}
                        className="h-24 w-full"
                      />
                      <span className="block p-3 text-xs font-semibold leading-snug text-slate-700 group-hover:text-brand-700">
                        {item.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <ChatMessageView
                    key={m.id}
                    message={m}
                    destinationHint={filters.destino}
                  />
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                      <Compass className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {loadingInfo?.categoria === "plan_completo" ? (
                        <AgentProgress />
                      ) : (
                        <ThinkingIndicator
                          label={
                            loadingInfo?.agente
                              ? `${loadingInfo.agente} está investigando…`
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <ChatInput
              onSend={handleSend}
              disabled={loading}
              canSendEmpty={hasAnyFilter}
            />
            <p className="mt-1.5 px-1 text-center text-[11px] text-slate-400">
              El asistente puede cometer errores. Verifica precios y
              disponibilidad. · Enter para enviar
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
