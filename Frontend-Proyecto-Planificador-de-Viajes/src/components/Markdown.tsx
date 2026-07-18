import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renderiza markdown (GFM) con estilos coherentes con el tema claro.
 * Se usa tanto en las burbujas del chat como en las tarjetas del itinerario.
 */
export default function Markdown({ children, className = "" }: MarkdownProps) {
  return (
    <div className={`md-content space-y-3 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-2 text-xl font-bold text-slate-900">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 text-lg font-bold text-slate-900">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 flex items-center gap-2 text-base font-semibold text-brand-700">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-slate-700">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 marker:text-brand-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 marker:text-brand-500">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-slate-700">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="font-medium not-italic text-sunset-600">
              {children}
            </em>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-brand-300 pl-4 italic text-slate-500">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] text-sunset-600">
              {children}
            </code>
          ),
          hr: () => <hr className="border-slate-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-200 px-3 py-2 text-slate-700">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
