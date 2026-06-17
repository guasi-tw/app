"use client";

import { useRef, useState } from "react";

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const urlRef = useRef<HTMLSpanElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable → select the text so the user can copy manually
      setCopyFailed(true);
      const el = urlRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="acct-actions" style={{ justifyContent: "center" }}>
      <button type="button" className="chip" onClick={copy}>
        {copied ? "已複製 ✓" : "複製連結"}
      </button>
      {copyFailed && (
        <span ref={urlRef} className="acct-meta">{url}</span>
      )}
    </div>
  );
}
