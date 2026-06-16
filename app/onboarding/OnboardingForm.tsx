"use client";

import { useActionState } from "react";
import { saveProfileAction, type OnboardingState } from "./actions";
import { DISPLAY_NAME_MAX, BIO_MAX } from "@/lib/identity/profile";

type Initial = { displayName: string; bio: string; avatarUrl: string | null };

export function OnboardingForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    saveProfileAction,
    {},
  );

  return (
    <form action={action} className="form">
      <div className="field">
        <label className="label" htmlFor="avatar">頭像</label>
        {initial.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.avatarUrl} alt="目前頭像" className="avatar-preview" />
        ) : null}
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="input"
        />
        <p className="hint">JPEG / PNG / WebP，小於 2MB。上傳後會自動裁切與重新編碼。</p>
        {state.errors?.avatar ? <p className="error">{state.errors.avatar}</p> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="displayName">顯示名稱</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          maxLength={DISPLAY_NAME_MAX}
          defaultValue={initial.displayName}
          required
          className="input"
        />
        {state.errors?.displayName ? <p className="error">{state.errors.displayName}</p> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="bio">一句話簡介</label>
        <textarea
          id="bio"
          name="bio"
          maxLength={BIO_MAX}
          defaultValue={initial.bio}
          rows={3}
          className="textarea"
        />
        {state.errors?.bio ? <p className="error">{state.errors.bio}</p> : null}
      </div>

      <p className="hint permanence">
        接下來你會驗證<strong>主要帳號</strong>，它的帳號名稱會成為你的
        <strong>永久公開網址</strong> guasi.tw/gua/… —— <strong>之後無法更改</strong>。
      </p>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "儲存中…" : "下一步：設定主要帳號 →"}
      </button>
    </form>
  );
}
