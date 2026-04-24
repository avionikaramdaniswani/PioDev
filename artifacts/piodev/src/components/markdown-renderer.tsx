import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const LANG_DISPLAY: Record<string, string> = {
  js: "JavaScript", jsx: "JavaScript", ts: "TypeScript", tsx: "TypeScript",
  py: "Python", python: "Python", rs: "Rust", go: "Go", java: "Java",
  cs: "C#", cpp: "C++", c: "C", html: "HTML", css: "CSS", scss: "SCSS",
  json: "JSON", yaml: "YAML", yml: "YAML", md: "Markdown", sh: "Shell",
  bash: "Bash", sql: "SQL", graphql: "GraphQL", php: "PHP", rb: "Ruby",
  swift: "Swift", kt: "Kotlin", dart: "Dart",
};

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1]?.toLowerCase() ?? "";
  const displayLang = LANG_DISPLAY[lang] ?? (lang ? lang.toUpperCase() : null);
  const [copied, setCopied] = useState(false);

  const codeStr = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className={cn("group relative my-4 rounded-lg overflow-hidden", isDark ? "bg-[#18181b]" : "bg-zinc-100")}>
        <div className={cn("flex items-center justify-between px-4 py-2 border-b", isDark ? "border-white/[0.06]" : "border-black/[0.06]")}>
          <span className={cn("text-xs font-medium", isDark ? "text-zinc-500" : "text-zinc-500")}>
            {displayLang}
          </span>
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-all duration-150",
              copied
                ? isDark ? "text-green-400" : "text-green-600"
                : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy</>
            )}
          </button>
        </div>

        <div style={{ maxHeight: "500px", overflow: "auto" }}>
          <SyntaxHighlighter
            style={isDark ? oneDark : oneLight}
            language={lang}
            PreTag="div"
            showLineNumbers={false}
            customStyle={{
              margin: 0,
              padding: "1rem 1.25rem",
              background: "transparent",
              fontSize: "0.85rem",
              lineHeight: "1.7",
            }}
            codeTagProps={{ className: "font-mono" }}
            {...props}
          >
            {codeStr}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  return (
    <code
      className={cn(
        "bg-zinc-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[0.85em] font-mono",
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
};

// Lightweight code block — dipakai saat streaming, tanpa syntax highlighting berat
const StreamingCodeBlock = ({ inline, className, children }: any) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1]?.toLowerCase() ?? "";
  const displayLang = LANG_DISPLAY[lang] ?? (lang ? lang.toUpperCase() : null);

  if (!inline && match) {
    return (
      <div className={cn("group relative my-4 rounded-lg overflow-hidden", isDark ? "bg-[#18181b]" : "bg-zinc-100")}>
        {displayLang && (
          <div className={cn("flex items-center px-4 py-2 border-b text-xs font-medium", isDark ? "border-white/[0.06] text-zinc-500" : "border-black/[0.06] text-zinc-500")}>
            {displayLang}
          </div>
        )}
        <div style={{ maxHeight: "500px", overflow: "auto" }}>
          <pre className={cn("m-0 p-4 text-[0.85rem] leading-[1.7] font-mono overflow-x-auto whitespace-pre", isDark ? "text-zinc-200" : "text-zinc-800")}>
            <code>{children}</code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <code className={cn("bg-zinc-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[0.85em] font-mono", className)}>
      {children}
    </code>
  );
};

export const MarkdownRenderer = memo(({ content, isStreaming }: {
  content: string;
  isStreaming?: boolean;
}) => {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert text-[15px] leading-relaxed
      prose-p:my-2 prose-p:leading-relaxed
      prose-headings:font-semibold prose-headings:text-foreground
      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
      prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
      prose-strong:text-foreground prose-strong:font-semibold
      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
      prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-pre:shadow-none
    ">
      <ReactMarkdown
        components={{
          code: isStreaming ? StreamingCodeBlock : CodeBlock,
          img: ({ src, alt }) => (
            <span className="block my-3">
              <img
                src={src}
                alt={alt || "Generated image"}
                className="rounded-xl border border-border shadow-md max-w-[360px] w-full"
                loading="lazy"
              />
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
