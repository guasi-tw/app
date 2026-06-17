// app/add/[platform]/confirm/ConfirmForms.tsx
"use client";

import { useState } from "react";

/** §D.3 ordinary bind — visibility choice (default 私密) + confirm/cancel. */
export function OrdinaryConfirm({
  platform,
  rid,
  confirm,
  cancel,
}: {
  platform: string;
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
    </div>
  );
}

/** §D.4 slug-confirm — three actions, with a permanence checkbox gating confirm-as-slug. */
export function SlugConfirm({
  platform,
  rid,
  slugUrl,
  taken,
  confirmAsSlug,
  keepAsAccount,
  cancel,
}: {
  platform: string;
  rid: string;
  slugUrl: string;
  taken: boolean;
  confirmAsSlug: (fd: FormData) => void;
  keepAsAccount: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="confirm-actions">
      {taken ? (
        <p className="error">{slugUrl} 已被使用 —— 你可以保留此帳號為分身，或改用其他平台/帳號的名稱作為主要帳號。</p>
      ) : (
        <>
          <p>你的永久公開網址將會是：</p>
          <p className="url-preview">{slugUrl}</p>
          <p className="hint warn">此網址永久固定，無法更改。</p>
          <form action={confirmAsSlug} className="confirm-actions">
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={rid} />
            <label className="gate">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> 我了解此網址無法更改
            </label>
            <button type="submit" className="btn-primary" disabled={!agreed}>確認，建立正身頁</button>
          </form>
        </>
      )}

      <form action={keepAsAccount} className="confirm-actions">
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        {/* §D.4 keep-as-分身 commits "per the §D.3 visibility choice — default 私密". */}
        <fieldset>
          <legend className="label">保留為分身的能見度</legend>
          <label className="label"><input type="radio" name="visibility" value="private" defaultChecked /> 私密（預設）</label>
          <label className="label"><input type="radio" name="visibility" value="public" /> 公開</label>
          <p className="hint warn">⚠ 一旦公開將永久顯示，無法改回私密。</p>
        </fieldset>
        <button type="submit" className="btn-secondary">保留為分身，綁定其他帳號作為主要帳號</button>
      </form>

      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">取消（不綁定此帳號）</button>
      </form>
    </div>
  );
}
