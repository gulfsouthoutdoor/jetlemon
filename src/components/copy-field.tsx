"use client";

import { useState } from "react";
import { inputClass } from "./ui";

/** Read-only value with a Copy button. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={value} aria-label={label ?? "Value"} className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="shrink-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard blocked; the field is selectable instead.
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
