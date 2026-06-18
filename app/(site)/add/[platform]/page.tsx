// app/add/[platform]/page.tsx
import { notFound, redirect } from "next/navigation";
import type { Platform } from "@prisma/client";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { buildVerificationPost, profileUrlFor } from "@/lib/binding/template";
import { findLinkedAccount, findRequestById, isExpired } from "@/lib/binding/repo";
import { createRequestAction } from "./actions";
import { AddAccountWizard } from "./AddAccountWizard";

export default async function AddAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ rid?: string; recover?: string }>;
}) {
  const { platform } = await params;
  const { rid, recover } = await searchParams;

  // Unknown / not-yet-built platform (IG/miin in Slice 2) → generic 404 (the registry has no adapter).
  const adapter = getAdapter(platform);
  if (!adapter) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Recovery (§C.4): the flow is scoped to re-verifying ONE existing 分身. Resolve its real
  // handle (recover carries the platform accountId) so the copy can name the exact account the
  // proof post must come from — and fall back to the raw value if it's not a real binding.
  const recoverAccount = recover
    ? await findLinkedAccount(user.id, platform as Platform, recover)
    : null;
  const recoverHandle = recoverAccount?.handle ?? null;
  const heading = recover ? `重新驗證 · ${adapter.label}` : `註冊分身 · ${adapter.label}`;

  // A recover target that isn't one of the caller's own bindings (URL tampering / stale link) is
  // never recoverable — the commit-time guards would reject it anyway, so refuse it up front
  // rather than walk the user through posting toward a dead end.
  if (recover && !recoverAccount) {
    const backHref = user.slug ? `/gua/${user.slug}?view=manage` : `/r/${user.shortRef}`;
    return (
      <main className="wrap">
        <h1 className="wordmark sm">{heading}</h1>
        <p className="lede">找不到要恢復的帳號。請回到你的正身頁，從要恢復的分身點「恢復·重新驗證」。</p>
        <p className="id-foot"><a href={backHref}>← 返回我的正身</a></p>
      </main>
    );
  }

  // No active request yet → show the "produce the template" button (creates + reveals via ?rid=).
  const req = rid ? await findRequestById(rid) : null;
  const haveLiveReq = req && req.userId === user.id && req.platform === platform && req.status === "pending" && !isExpired(req);

  if (!haveLiveReq) {
    return (
      <main className="wrap">
        <h1 className="wordmark sm">{heading}</h1>
        {recover ? (
          <p className="lede">
            你正在恢復 <strong>@{recoverHandle}</strong> 的驗證。請務必用<strong>這個帳號本人</strong>發佈含驗證碼的貼文並貼回網址
            —— 系統會確認貼文作者就是這個帳號，再更新證明、恢復其信任狀態。
          </p>
        ) : (
          <p className="lede">產生一則含驗證碼的貼文範本，發佈後貼回網址即可完成綁定。</p>
        )}
        <form action={createRequestAction}>
          <input type="hidden" name="platform" value={platform} />
          {recover ? <input type="hidden" name="recover" value={recover} /> : null}
          <button type="submit" className="btn-primary">{recover ? "產生重新驗證貼文" : "產生驗證貼文"}</button>
        </form>
      </main>
    );
  }

  const template = buildVerificationPost({
    hashtag: adapter.hashtag, // null for Threads (no pasteable hashtags)
    serviceTag: adapter.serviceTag,
    profileUrl: profileUrlFor(user),
    code: req!.code,
  });

  return (
    <main className="wrap">
      <h1 className="wordmark sm">{heading}</h1>
      {recover ? (
        <p className="lede">
          正在恢復 <strong>@{recoverHandle}</strong>。請用<strong>這個帳號本人</strong>發佈下方貼文範本 ——
          必須由原帳號發佈，系統才能確認並恢復其信任狀態。
        </p>
      ) : null}
      <AddAccountWizard
        platform={platform}
        label={adapter.label}
        rid={req!.id}
        template={template}
        composeIntentUrl={adapter.composeIntentUrl ? adapter.composeIntentUrl(template) : null}
        igNote={platform === "instagram"}
        recover={recover ?? null}
      />
    </main>
  );
}
