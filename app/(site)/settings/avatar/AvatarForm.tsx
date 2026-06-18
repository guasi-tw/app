"use client";

import { useActionState } from "react";
import { saveAvatarAction, type AvatarState } from "./actions";

export function AvatarForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, action, pending] = useActionState<AvatarState, FormData>(saveAvatarAction, {});
  return (
    <form action={action} className="form">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="目前頭像" className="avatar-preview" />
      ) : null}
      <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required className="input" />
      <p className="hint">JPEG / PNG / WebP，小於 2MB。上傳後會自動裁切與重新編碼。</p>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "上傳中…" : "儲存頭像"}</button>
    </form>
  );
}
