import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-3xl font-black tracking-tight text-foreground" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-2xl font-black tracking-tight text-foreground" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-xl font-bold tracking-tight text-foreground" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-7 text-foreground" {...props}>
      {children}
    </p>
  ),
  a: ({ children, ...props }) => (
    <a className="font-semibold text-primary underline underline-offset-4" {...props}>
      {children}
    </a>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal space-y-2 pl-6 text-sm leading-7 text-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-4 border-primary bg-primary-muted px-4 py-3 text-sm font-medium text-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }) => (
    <code
      className={[
        "rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-primary",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="overflow-x-auto rounded-xl border border-border bg-surface-muted p-4 text-sm text-foreground"
      {...props}
    >
      {children}
    </pre>
  ),
  img: ({ alt, ...props }) => (
    <img
      alt={alt ?? ""}
      className="max-h-[520px] w-full rounded-xl object-cover"
      loading="lazy"
      {...props}
    />
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full divide-y divide-border text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="bg-surface-muted px-3 py-2 text-left font-bold text-foreground" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 text-foreground" {...props}>
      {children}
    </td>
  ),
};

export const MarkdownContent = ({ content }: MarkdownContentProps) => (
  <div className="space-y-4">
    <ReactMarkdown
      components={markdownComponents}
      remarkPlugins={[remarkGfm]}
      urlTransform={(value) => value}
    >
      {content}
    </ReactMarkdown>
  </div>
);
