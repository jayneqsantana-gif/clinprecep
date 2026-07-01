import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renderiza markdown clínico (títulos, listas, tabelas) com estilo do app. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-clinical space-y-2 text-sm leading-relaxed text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mt-3 text-base font-bold" {...p} />,
          h2: (p) => <h2 className="mt-3 border-t border-border pt-2 text-sm font-bold text-brand" {...p} />,
          h3: (p) => <h3 className="mt-2 text-sm font-semibold" {...p} />,
          ul: (p) => <ul className="list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="list-decimal space-y-1 pl-5" {...p} />,
          p: (p) => <p className="whitespace-pre-wrap" {...p} />,
          strong: (p) => <strong className="font-semibold text-text" {...p} />,
          a: (p) => <a className="text-brand underline" target="_blank" rel="noreferrer" {...p} />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...p} />
            </div>
          ),
          th: (p) => <th className="border border-border bg-surface-2 px-2 py-1 text-left" {...p} />,
          td: (p) => <td className="border border-border px-2 py-1" {...p} />,
          code: (p) => <code className="rounded bg-surface-2 px-1 py-0.5 text-xs" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
