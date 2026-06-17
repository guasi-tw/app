import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { findUserByShortRef } from "@/lib/identity/repo";

export default async function PreProvisionedPage({
  params,
}: {
  params: Promise<{ shortRef: string }>;
}) {
  const { shortRef } = await params;

  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const owner = await findUserByShortRef(shortRef);
  // Owner-only pre-provisioning page → generic 404 to anyone else (§1.3 / §D.5).
  if (!owner || owner.id !== viewer.id) notFound();

  // Once a slug is minted (Slice 2), /r/ permanently redirects to the public URL (§H.2).
  if (owner.slug) permanentRedirect(`/gua/${owner.slug}`);

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

      <div className="slot empty">
        <span className="slot-label">主要帳號 · 尚未設定</span>
        {/* Stub — Slice 2 wires this to the Add Account / slug-confirm flow. */}
        <a className="btn-primary" href="/add/threads">設定主要帳號並開通公開網址 →</a>
      </div>

      <p className="hint">
        <a href="/onboarding">編輯個人資料</a>
      </p>
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
