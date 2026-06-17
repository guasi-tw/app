// app/add/[platform]/confirm/ConfirmForms.tsx
"use client";

import { useState } from "react";

/** Hint shown by every cancel action: the verification post is now orphaned and can be deleted. */
function CancelHint({ platformLabel }: { platformLabel: string }) {
  return (
    <p className="hint">取消後，你可以到 {platformLabel} 刪除剛才發佈的驗證貼文。</p>
  );
}

/** §D.3 ordinary bind (provisioned user, non-primary 分身) — visibility choice (default 私密) + confirm/cancel. */
export function OrdinaryConfirm({
  platform,
  platformLabel,
  rid,
  confirm,
  cancel,
}: {
  platform: string;
  platformLabel: string;
  rid: string;
  confirm: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  return (
    <div className="confirm-actions">
      <form action={confirm} className="confirm-actions">
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <fieldset>
          <legend className="label">能見度設定</legend>
          <label className="label"><input type="radio" name="visibility" value="private" defaultChecked /> 私密（預設）</label>
          <label className="label"><input type="radio" name="visibility" value="public" /> 公開</label>
          <p className="hint warn">⚠ 一旦公開將永久顯示，無法改回私密。</p>
        </fieldset>
        <button type="submit" className="btn-primary">確認綁定</button>
      </form>
      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">這不是我要綁的帳號 · 取消</button>
      </form>
      <CancelHint platformLabel={platformLabel} />
    </div>
  );
}

/**
 * §D.4 first (main) binding — the main account is always public, so there is NO visibility choice
 * and NO keep-as-分身 option: the only outcomes are accept-as-primary (mint slug, public, main) or
 * cancel. A permanence checkbox gates the irreversible accept.
 */
export function SlugConfirm({
  platform,
  platformLabel,
  rid,
  slugUrl,
  taken,
  confirmAsSlug,
  cancel,
}: {
  platform: string;
  platformLabel: string;
  rid: string;
  slugUrl: string;
  taken: boolean;
  confirmAsSlug: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="confirm-actions">
      {taken ? (
        <p className="error">
          {slugUrl
            ? `${slugUrl} 已被使用 —— 此網址無法作為你的正身頁，請取消後改用其他帳號驗證。`
            : "此平台目前無法設為主要帳號，請取消後改用其他帳號驗證。"}
        </p>
      ) : (
        <>
          <p>你的永久公開網址將會是：</p>
          <p className="url-preview">{slugUrl}</p>
          <p className="hint warn">此網址永久固定且公開，無法更改。</p>
          <form action={confirmAsSlug} className="confirm-actions">
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={rid} />
            <label className="gate">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> 我了解此網址無法更改
            </label>
            <button type="submit" className="btn-primary" disabled={!agreed}>接受為主要帳號</button>
          </form>
        </>
      )}

      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">取消（不綁定此帳號）</button>
      </form>
      <CancelHint platformLabel={platformLabel} />
    </div>
  );
}
