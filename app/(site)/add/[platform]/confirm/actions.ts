// app/add/[platform]/confirm/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Platform, Visibility } from "@prisma/client";
import { getCurrentUser } from "@/lib/identity/session";
import { cancelRequest, commitBinding, findLinkedAccount, findRequestById, reverifyBinding } from "@/lib/binding/repo";

async function ownedResolvedRequest(rid: string, platform: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const req = await findRequestById(rid);
  if (!req || req.userId !== user.id || req.platform !== platform) redirect("/");
  return { user, req: req! };
}

/**
 * Where to land an owner after a bind/cancel/recover: their **management tab**, so they return to
 * the surface they manage 分身 from (not the public card). A provisioned owner → `/gua/{slug}?view=manage`;
 * a slug-less owner → `/r/{shortRef}` (which already renders the manage view inline).
 */
function manageHref(user: { slug: string | null; shortRef: string }): string {
  return user.slug ? `/gua/${user.slug}?view=manage` : `/r/${user.shortRef}`;
}

/** §D.3 ordinary bind (owner already provisioned): commit non-main with the chosen visibility. */
export async function confirmOrdinaryAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const visibility = (formData.get("visibility") === "public" ? "public" : "private") as Visibility;
  const { user, req } = await ownedResolvedRequest(rid, platform);

  const res = await commitBinding({ requestId: req.id, asMain: false, visibility, mintSlug: false });
  if (!res.ok && res.error === "duplicate_binding") {
    redirect(`/add/${platform}/confirm?rid=${rid}&err=dup`);
  }
  // Falls through here on success AND on not_resolvable (double-submit after a prior commit) —
  // both mean "the binding is done", so land the user on their 正身 management tab.
  redirect(manageHref(user));
}

/** §D.4 confirm-as-slug: commit as main + force public + mint slug. */
export async function confirmAsSlugAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const { user, req } = await ownedResolvedRequest(rid, platform);

  const res = await commitBinding({ requestId: req.id, asMain: true, visibility: "public", mintSlug: true });
  if (!res.ok) {
    redirect(`/add/${platform}/confirm?rid=${rid}&err=${res.error}`); // slug_taken | duplicate_binding
  }
  // mintSlug:true always derives a slug on success; fall back to the short ref if somehow null.
  // Land on the management tab so the new owner can keep adding/managing 分身.
  redirect(res.slug ? `/gua/${res.slug}?view=manage` : `/r/${user.shortRef}`);
}

/** §D.3 wrong-account / §D.4 取消: a real cancel — commit nothing. */
export async function cancelRequestAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const { user, req } = await ownedResolvedRequest(rid, platform);
  await cancelRequest(req.id);
  redirect(manageHref(user));
}

/** §C.4 confirm recovery: re-verify the SAME account (guarded), then return to the 正身 page. */
export async function recoverAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const recover = String(formData.get("recover") ?? "");
  const { user, req } = await ownedResolvedRequest(rid, platform);

  // Defense in depth: the page already guards this, but never trust the round-trip.
  if (req.resolvedAccountId !== recover) {
    redirect(`/add/${platform}/confirm?rid=${rid}&recover=${encodeURIComponent(recover)}`);
  }
  const linked = await findLinkedAccount(user.id, platform as Platform, recover);
  if (!linked) {
    redirect(manageHref(user));
  }
  const res = await reverifyBinding({ requestId: req.id, linkedAccountId: linked!.id });
  if (!res.ok) {
    redirect(`/add/${platform}/confirm?rid=${rid}&recover=${encodeURIComponent(recover)}&err=${res.error}`);
  }
  if (user.slug) revalidatePath(`/gua/${user.slug}`);
  redirect(manageHref(user));
}
