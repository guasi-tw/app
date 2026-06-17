// app/add/[platform]/confirm/actions.ts
"use server";

import { redirect } from "next/navigation";
import type { Visibility } from "@prisma/client";
import { getCurrentUser } from "@/lib/identity/session";
import { cancelRequest, commitBinding, findRequestById } from "@/lib/binding/repo";

async function ownedResolvedRequest(rid: string, platform: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const req = await findRequestById(rid);
  if (!req || req.userId !== user.id || req.platform !== platform) redirect("/");
  return { user, req: req! };
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
  // both mean "the binding is done", so land the user on their 正身.
  redirect(user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`);
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
  redirect(res.slug ? `/gua/${res.slug}` : `/r/${user.shortRef}`);
}

/** §D.3 wrong-account / §D.4 取消: a real cancel — commit nothing. */
export async function cancelRequestAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const { user, req } = await ownedResolvedRequest(rid, platform);
  await cancelRequest(req.id);
  redirect(user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`);
}
