import { useRef, useState } from "react";
import { SendHorizonal, Plus } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  canSendEmpty?: boolean; // permite enviar solo con filtros (sin texto)
}

export default function ChatInput({ onSend, disabled, canSendEmpty }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (disabled) return;
    if (!text && !canSendEmpty) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const sendEnabled = !disabled && (Boolean(value.trim()) || canSendEmpty);

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-50">
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        aria-label="Adjuntar (decorativo)"
        tabIndex={-1}
      >
        <Plus className="h-5 w-5" />
      </button>
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        disabled={disabled}
        placeholder={
          disabled
            ? "Tu equipo de expertos está trabajando…"
            : "Pregunta lo que quieras sobre tu viaje…"
        }
        onChange={(e) => {
          setValue(e.target.value);
          autoGrow(e.target);
        }}
        onKeyDown={handleKeyDown}
        className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!sendEnabled}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Enviar"
      >
        <SendHorizonal className="h-4 w-4" />
      </button>
    </div>
  );
}
