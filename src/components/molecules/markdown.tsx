import { cn } from "cn"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

/**
 * Renders card content. Raw HTML in the source is not rendered (react-markdown's default),
 * so card text can't inject scripts.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("card-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
