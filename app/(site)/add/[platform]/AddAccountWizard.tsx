// app/add/[platform]/AddAccountWizard.tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { submitProofUrlAction, type SubmitState } from "./actions";

type Props = {
  platform: string;
  label: string;
  rid: string;
  template: string;
  composeIntentUrl: string | null;
  igNote?: boolean;
};

export function AddAccountWizard({ platform, label, rid, template, composeIntentUrl, igNote }: Props) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitProofUrlAction, {});
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (insecure origin / restricted context) — select the text
      // so the user can copy it manually, and tell them.
      setCopyFailed(true);
      const el = preRef.current;
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
    <div className="wizard">
      <p className="hint credibility">
        💡 這則貼文就是你的<strong>公開證明</strong>，保留它能讓你的正身更可信 —— 任何人都能點進去親自查證。
        日後<strong>編輯或刪除</strong>這則貼文會讓證明連結失效（編輯會改變貼文網址），綁定本身則不受影響。
      </p>

      <pre className="template" ref={preRef}>{template}</pre>

      <div className="wizard-actions">
        <button type="button" className="btn-primary" onClick={copy}>
          {copied ? "已複製 ✓" : "複製貼文內容"}
        </button>
        {composeIntentUrl ? (
          <a className="btn-secondary" href={composeIntentUrl} target="_blank" rel="noopener noreferrer">
            在 {label} 發佈 ↗
          </a>
        ) : null}
      </div>

      {copyFailed ? <p className="hint warn">無法自動複製，已為你選取文字，請手動複製（⌘/Ctrl + C）。</p> : null}

      {igNote ? (
        <p className="hint">Instagram 需附上一張圖片，且貼文內的連結不可點擊 —— 建議也把網址放到個人簡介。</p>
      ) : null}

      <form action={action} className="form paste-form">
        <label className="label" htmlFor="url">貼文發佈後，把貼文網址貼回這裡</label>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <input id="url" name="url" type="url" required placeholder={`https://www.threads.net/@你的帳號/post/…`} className="input" />
        {state.error ? <p className="error">{state.error}</p> : null}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "驗證中…" : "驗證並繼續 →"}
        </button>
      </form>
    </div>
  );
}
