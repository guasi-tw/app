"use client";

import { useActionState, useState } from "react";
import { saveProfileAction, type OnboardingState } from "@/app/(site)/onboarding/actions";
import { DISPLAY_NAME_MAX, BIO_MAX, BIO_MAX_LINES } from "@/lib/identity/profile";

type Initial = { displayName: string; bio: string; avatarUrl: string | null };

export function ProfileForm({ variant, initial }: { variant: "onboarding" | "edit"; initial: Initial }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveProfileAction, {});
  const [name, setName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);

  const bioLines = bio === "" ? 0 : bio.split("\n").length;
  // Measure the SAME way the server validates (JS String.length) so the hint never disagrees.
  const invalid =
    name.trim().length === 0 ||
    name.length > DISPLAY_NAME_MAX ||
    bio.length > BIO_MAX ||
    bioLines > BIO_MAX_LINES;

  return (
    <form action={action} className="form">
      <div className="field">
        <label className="label" htmlFor={variant === "onboarding" ? "avatar" : undefined}>頭像</label>
        {initial.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.avatarUrl} alt="目前頭像" className="avatar-preview" />
        ) : null}
        {variant === "onboarding" ? (
          <>
            <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
            <p className="hint">JPEG / PNG / WebP，小於 2MB。上傳後會自動裁切與重新編碼。</p>
            {state.errors?.avatar ? <p className="error">{state.errors.avatar}</p> : null}
          </>
        ) : (
          <a className="btn-secondary" href="/settings/avatar">更換頭像 ↗</a>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="displayName">顯示名稱</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          maxLength={DISPLAY_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input"
        />
        <p className="hint counter">{name.length}/{DISPLAY_NAME_MAX}</p>
        {state.errors?.displayName ? <p className="error">{state.errors.displayName}</p> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="bio">一句話簡介</label>
        <textarea
          id="bio"
          name="bio"
          maxLength={BIO_MAX}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="textarea"
        />
        <p className="hint counter">{bio.length}/{BIO_MAX} · {bioLines}/{BIO_MAX_LINES} 行</p>
        {state.errors?.bio ? <p className="error">{state.errors.bio}</p> : null}
      </div>

      {variant === "onboarding" ? (
        <p className="hint permanence">
          接下來你會驗證<strong>主要帳號</strong>，它的帳號名稱會成為你的
          <strong>永久公開網址</strong> guasi.tw/gua/… —— <strong>之後無法更改</strong>。
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending || invalid}>
        {pending ? "儲存中…" : variant === "onboarding" ? "下一步：設定主要帳號 →" : "儲存"}
      </button>
    </form>
  );
}
