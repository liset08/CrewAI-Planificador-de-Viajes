import { Plane, User, AlertTriangle } from "lucide-react";
import type { ChatMessage } from "../types";
import Markdown from "./Markdown";
import ItineraryView from "./ItineraryView";
import RecommendedItems from "./RecommendedItems";

interface Props {
  message: ChatMessage;
  destinationHint?: string;
}

// Detecta si el contenido parece un itinerario (tiene encabezados "## Día N")
function looksLikeItinerary(text: string): boolean {
  return /^##\s+d[ií]a\s+\d+/im.test(text);
}

export default function ChatMessageView({ message, destinationHint }: Props) {
  const isUser = message.role === "user";

  const itineraryMarkdown = message.downloadContent || message.content;
  const showItinerary =
    !isUser && !message.isError && looksLikeItinerary(itineraryMarkdown);

  return (
    <div
      className={`animate-float-in flex gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          isUser
            ? "bg-slate-200 text-slate-600"
            : message.isError
            ? "bg-red-100 text-red-600"
            : "bg-gradient-to-br from-brand-500 to-brand-700 text-white"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : message.isError ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Plane className="h-4 w-4" />
        )}
      </div>

      {/* Contenido */}
      <div className={`min-w-0 ${showItinerary ? "flex-1" : "max-w-[85%]"}`}>
        {showItinerary ? (
          <ItineraryView
            markdown={itineraryMarkdown}
            downloadContent={message.downloadContent}
            downloadFilename={message.downloadFilename}
            destinationHint={destinationHint}
          />
        ) : (
          <div
            className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
              isUser
                ? "bg-brand-600 text-white"
                : message.isError
                ? "border border-red-200 bg-red-50 text-red-800"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <Markdown>{message.content}</Markdown>
                {message.items && (
                  <RecommendedItems
                    items={message.items}
                    destinationHint={destinationHint}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
