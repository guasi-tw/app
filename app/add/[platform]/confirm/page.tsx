// app/add/[platform]/confirm/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { findLinkedAccount, findRequestById } from "@/lib/binding/repo";
import { deriveSlug, isSlugAvailable } from "@/lib/binding/slug";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { OrdinaryConfirm, SlugConfirm } from "./ConfirmForms";
import {
  cancelRequestAction,
  confirmAsSlugAction,
  confirmOrdinaryAction,
  keepAsAccountAction,
} from "./actions";

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ rid?: string; err?: string }>;
}) {
  const { platform } = await params;
  const { rid, err } = await searchParams;

  const adapter = getAdapter(platform);
  if (!adapter) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const req = rid ? await findRequestById(rid) : null;
  if (!req || req.userId !== user.id || req.platform !== platform || req.status !== "resolved") {
    redirect(`/add/${platform}`);
  }

  const dateStr = new Date(req!.createdAt).toLocaleDateString("zh-TW");

  // §A.6 re-validate: if the resolved account is ALREADY bound by this 正身, don't bind again.
  // Slice 2 = NOTIFY only (no write); the re_verify refresh ships with the Manage tab (Slice 5).
  const alreadyBound = await findLinkedAccount(user.id, platform, req!.resolvedAccountId!);

  return (
    <main className="wrap">
      <h1 className="wordmark sm">確認綁定 · {adapter.label}</h1>

      {alreadyBound ? (
        // Already-bound notify (on-screen; no email in MVP). Discard the redundant request.
        <div className="confirm-card">
          <p>✓ @{req!.resolvedHandle} 已經是你綁定過的帳號了。</p>
          <p className="hint">
            這次不會重複綁定。日後若要更新證明（重新驗證），可到你的{" "}
            <strong>分身管理</strong> 操作（即將推出）。
          </p>
          <a className="btn-primary" href={user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`}>
            返回我的正身
          </a>
          <form action={cancelRequestAction}>
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={req!.id} />
            <button type="submit" className="btn-secondary">關閉</button>
          </form>
        </div>
      ) : (
      <div className="confirm-card">
        <p>✓ @{req!.resolvedHandle} · 作者由平台確認 · {dateStr}</p>
        <p className="hint">
          刪除或編輯這則貼文都<strong>不會解除綁定</strong>；但會讓證明連結失效 ——{" "}
          <strong>編輯會改變貼文網址</strong>，刪除則讓貼文消失。保留原貼文能讓任何人點開查證，正身更可信。
        </p>
        {err === "dup" || err === "duplicate_binding" ? (
          <p className="error">你已經綁定過這個帳號了。</p>
        ) : null}
        {err && !["dup", "duplicate_binding", "slug_taken"].includes(err) ? (
          <p className="error">發生問題，請重試一次。</p>
        ) : null}

        {user.slug ? (
          // Owner already provisioned → ordinary bind (§D.3), commit here.
          <OrdinaryConfirm
            platform={platform}
            rid={req!.id}
            confirm={confirmOrdinaryAction}
            cancel={cancelRequestAction}
          />
        ) : adapter.slugEligible ? (
          // Pre-provisioned + slug-eligible platform → slug-confirm (§D.4).
          <SlugConfirm
            platform={platform}
            rid={req!.id}
            slugUrl={`${SITE_ORIGIN}/gua/${deriveSlug(req!.resolvedHandle!)}`}
            taken={err === "slug_taken" || !(await isSlugAvailable(deriveSlug(req!.resolvedHandle!)))}
            confirmAsSlug={confirmAsSlugAction}
            keepAsAccount={keepAsAccountAction}
            cancel={cancelRequestAction}
          />
        ) : (
          // Not slug-eligible (e.g. a future miin-only path) → keep-as-分身 / cancel only (§D.5).
          <SlugConfirm
            platform={platform}
            rid={req!.id}
            slugUrl=""
            taken={true}
            confirmAsSlug={confirmAsSlugAction}
            keepAsAccount={keepAsAccountAction}
            cancel={cancelRequestAction}
          />
        )}
      </div>
      )}
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
