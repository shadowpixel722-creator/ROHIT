import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../ui";

/**
 * Renders page text (Markdown from the AI or the teacher) as formatted notes.
 * Raw HTML is not rendered (react-markdown's default), so text can't inject markup.
 */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)} data-testid="formatted-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="pt-1 text-lg font-semibold tracking-tight">{children}</h3>,
          h2: ({ children }) => <h3 className="pt-1 text-base font-semibold tracking-tight">{children}</h3>,
          h3: ({ children }) => <h4 className="pt-1 text-sm font-semibold">{children}</h4>,
          h4: ({ children }) => <h5 className="text-sm font-semibold">{children}</h5>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
          em: ({ children }) => <em className="text-muted">{children}</em>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">{children}</a>,
          table: ({ children }) => <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-border bg-surface-2 px-2 py-1 font-medium">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          code: ({ children }) => <code className="rounded bg-surface-2 px-1 font-mono text-[0.85em]">{children}</code>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 text-muted">{children}</blockquote>,
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
