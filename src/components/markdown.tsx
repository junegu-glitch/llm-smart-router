"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback, useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded bg-background/50 hover:bg-background/80 text-muted-foreground transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with syntax highlighting + copy button
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const codeString = String(children).replace(/\n$/, "");
          const isInline = !match && !codeString.includes("\n");

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-background/60 text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="relative group my-3">
              <div className="flex items-center justify-between px-4 py-2 bg-background/80 rounded-t-lg border border-border/50">
                <span className="text-xs text-muted-foreground font-mono">
                  {match ? match[1] : "code"}
                </span>
                <CopyButton text={codeString} />
              </div>
              <pre className="overflow-x-auto p-4 bg-background/60 rounded-b-lg border border-t-0 border-border/50">
                <code className={`text-sm font-mono ${className || ""}`} {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        // Headings
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="text-sm">{children}</li>,
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/50 pl-4 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border/50 px-3 py-1.5 bg-background/40 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border/50 px-3 py-1.5">{children}</td>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-border/50" />,
        // Strong / em
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
