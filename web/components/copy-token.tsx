"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 font-mono text-xs text-text truncate">
        {token}
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 bg-surface-2 hover:bg-border border border-border rounded-lg px-3 py-2 text-xs text-muted hover:text-text transition-all flex-shrink-0"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
