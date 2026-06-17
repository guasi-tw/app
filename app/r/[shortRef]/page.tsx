import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { findUserByShortRef } from "@/lib/identity/repo";
import { listProvisionCandidates } from "@/lib/binding/repo";
import { deriveSlug, isSlugAvailable } from "@/lib/binding/slug";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { provisionExistingAction } from "./actions";

export default async function PreProvisionedPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortRef: string }>;
  searchParams: Promise<{ provision?: string; err?: string }>;
}) {
  const { shortRef } = await params;
  const { provision, err } = await searchParams;

  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const owner = await findUserByShortRef(shortRef);
  if (!owner || owner.id !== viewer.id) notFound();
  if (owner.slug) permanentRedirect(`/gua/${owner.slug}`);

  const candidates = await listProvisionCandidates(owner.id);
  const selected = provision ? candidates.find((c) => c.id === provision) : null;
  const selectedSlug = selected ? deriveSlug(selected.handle) : null;

  return (
    <main className="wrap preprov">
      <div className="banner">🔒 你的正身頁尚未公開（只有你看得到）</div>

      <div className="identity-summary">
        {owner.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.avatarUrl} alt="頭像" className="avatar-preview" />
        ) : null}
        <h1 className="wordmark sm">{owner.displayName ?? "（未命名）"}</h1>
        {owner.bio ? <p className="lede">{owner.bio}</p> : null}
      </div>

      {selected ? (
        // Slug-confirm panel for an existing verified account (§D.4 permanence gate, server-rendered).
        <div className="confirm-card">
          <p>將以這個帳號作為主要帳號並開通公開網址：</p>
          <p className="url-preview">{SITE_ORIGIN}/gua/{selectedSlug!}</p>
          {err === "slug_taken" || !(await isSlugAvailable(selectedSlug!)) ? (
            <>
              <p className="error">{SITE_ORIGIN}/gua/{selectedSlug!} 已被使用 —— 請改用其他帳號。</p>
              <a className="btn-secondary" href="/add/threads">驗證其他帳號 →</a>
            </>
          ) : (
            <form action={provisionExistingAction} className="confirm-actions">
              <input type="hidden" name="shortRef" value={shortRef} />
              <input type="hidden" name="linkedAccountId" value={selected.id} />
              <p className="hint warn">此網址永久固定，無法更改。設為主要帳號會將其永久公開。</p>
              <button type="submit" className="btn-primary">確認，建立正身頁</button>
            </form>
          )}
          <a className="btn-secondary" href={`/r/${shortRef}`}>返回</a>
        </div>
      ) : (
        <>
          <div className="slot empty">
            <span className="slot-label">主要帳號 · 尚未設定</span>
          </div>

          {candidates.length > 0 ? (
            <div className="picker">
              <p className="hint">選一個已驗證的帳號作為主要帳號：</p>
              {candidates.map((c) => (
                <div key={c.id} className="picker-row">
                  <span>@{c.handle} · {c.platform}</span>
                  <a className="btn-secondary" href={`/r/${shortRef}?provision=${c.id}`} aria-label={`設 @${c.handle} 為主要帳號`}>★ 設為主要帳號</a>
                </div>
              ))}
            </div>
          ) : null}

          <a className="btn-primary" href="/add/threads">
            ＋ 驗證另一個帳號當主要帳號 →
          </a>
        </>
      )}

      <p className="hint"><a href="/onboarding">編輯個人資料</a></p>
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
