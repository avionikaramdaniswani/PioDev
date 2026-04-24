import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Code2, Copy, ExternalLink, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import {
  buildSrcdoc,
  injectHideScrollbar,
  PREVIEWABLE,
  LANG_DISPLAY,
} from "@/components/markdown-renderer";

export type ArtifactData = {
  code: string;
  lang: string;
};

function openInNewTab(srcdoc: string) {
  const blob = new Blob([srcdoc], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (tab) {
    tab.addEventListener("unload", () => URL.revokeObjectURL(url), { once: true });
  }
}

export function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: ArtifactData;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [tab, setTab] = useState<"code" | "preview">(
    PREVIEWABLE.includes(artifact.lang) ? "preview" : "code"
  );
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const canPreview = PREVIEWABLE.includes(artifact.lang);
  const displayLang = LANG_DISPLAY[artifact.lang] ?? (artifact.lang ? artifact.lang.toUpperCase() : "Code");
  const srcdoc = canPreview ? buildSrcdoc(artifact.lang, artifact.code) : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col h-full border-l", isDark ? "bg-[#111113] border-white/[0.08]" : "bg-zinc-50 border-black/[0.08]")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 border-b shrink-0", isDark ? "border-white/[0.08]" : "border-black/[0.06]")}>
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span className={cn("text-sm font-semibold", isDark ? "text-zinc-200" : "text-zinc-700")}>{displayLang}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Tabs */}
          {canPreview && (
            <div className={cn("flex items-center rounded-lg p-0.5 mr-2", isDark ? "bg-white/[0.05]" : "bg-black/[0.05]")}>
              <button
                onClick={() => setTab("code")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  tab === "code"
                    ? isDark ? "bg-white/[0.1] text-zinc-100" : "bg-white text-zinc-800 shadow-sm"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                Kode
              </button>
              <button
                onClick={() => setTab("preview")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  tab === "preview"
                    ? isDark ? "bg-white/[0.1] text-zinc-100" : "bg-white text-zinc-800 shadow-sm"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                Preview
              </button>
            </div>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Salin kode"
            className={cn(
              "p-1.5 rounded-lg transition-colors text-xs",
              copied
                ? isDark ? "text-green-400" : "text-green-600"
                : isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/[0.05]"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Open in new tab (previewable only) */}
          {canPreview && (
            <>
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                title="Reload preview"
                className={cn("p-1.5 rounded-lg transition-colors", isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/[0.05]")}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => openInNewTab(injectHideScrollbar(srcdoc))}
                title="Buka di tab baru"
                className={cn("p-1.5 rounded-lg transition-colors", isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/[0.05]")}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            title="Tutup panel"
            className={cn("p-1.5 rounded-lg transition-colors", isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/[0.05]")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {tab === "code" || !canPreview ? (
          <div className="h-full overflow-auto">
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={artifact.lang}
              PreTag="div"
              showLineNumbers
              customStyle={{
                margin: 0,
                padding: "1.25rem",
                background: "transparent",
                fontSize: "0.82rem",
                lineHeight: "1.75",
                minHeight: "100%",
              }}
              codeTagProps={{ className: "font-mono" }}
              lineNumberStyle={{ color: isDark ? "#3f3f46" : "#a1a1aa", minWidth: "2.5em", userSelect: "none" }}
            >
              {artifact.code}
            </SyntaxHighlighter>
          </div>
        ) : (
          <iframe
            key={previewKey}
            srcDoc={injectHideScrollbar(srcdoc)}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full bg-white"
            style={{ border: "none" }}
            title="Artifact Preview"
          />
        )}
      </div>
    </div>
  );
}
