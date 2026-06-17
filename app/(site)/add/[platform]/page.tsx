// app/add/[platform]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { buildVerificationPost, profileUrlFor } from "@/lib/binding/template";
import { findRequestById, isExpired } from "@/lib/binding/repo";
import { createRequestAction } from "./actions";
import { AddAccountWizard } from "./AddAccountWizard";

export default async function AddAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ rid?: string }>;
}) {
  const { platform } = await params;
  const { rid } = await searchParams;

  // Unknown / not-yet-built platform (IG/miin in Slice 2) → generic 404 (the registry has no adapter).
  const adapter = getAdapter(platform);
  if (!adapter) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // No active request yet → show the "produce the template" button (creates + reveals via ?rid=).
  const req = rid ? await findRequestById(rid) : null;
  const haveLiveReq = req && req.userId === user.id && req.platform === platform && req.status === "pending" && !isExpired(req);

  if (!haveLiveReq) {
    return (
      <main className="wrap">
        <h1 className="wordmark sm">註冊分身 · {adapter.label}</h1>
        <p className="lede">產生一則含驗證碼的貼文範本，發佈後貼回網址即可完成綁定。</p>
        <form action={createRequestAction}>
          <input type="hidden" name="platform" value={platform} />
          <button type="submit" className="btn-primary">產生驗證貼文</button>
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
      <h1 className="wordmark sm">註冊分身 · {adapter.label}</h1>
      <AddAccountWizard
        platform={platform}
        label={adapter.label}
        rid={req!.id}
        template={template}
        composeIntentUrl={adapter.composeIntentUrl ? adapter.composeIntentUrl(template) : null}
        igNote={platform === "instagram"}
      />
    </main>
  );
}
