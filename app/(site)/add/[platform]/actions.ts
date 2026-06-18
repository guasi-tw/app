// app/add/[platform]/actions.ts
"use server";

import { redirect } from "next/navigation";
import type { Platform } from "@prisma/client";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { generateCode } from "@/lib/binding/code";
import {
  createBindingRequest,
  findActiveRequest,
  findRequestById,
  isExpired,
  markResolved,
} from "@/lib/binding/repo";

/** Create (or reuse) a pending request, then reveal the template via ?rid= (§D.2). */
export async function createRequestAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const platform = String(formData.get("platform") ?? "");
  const adapter = getAdapter(platform);
  if (!adapter) redirect("/");

  const recover = String(formData.get("recover") ?? "");
  const existing = await findActiveRequest(user.id, platform as Platform);
  const req = existing ?? (await createBindingRequest({ userId: user.id, platform: platform as Platform, code: generateCode() }));
  redirect(`/add/${platform}?rid=${req.id}${recover ? `&recover=${encodeURIComponent(recover)}` : ""}`);
}

export type SubmitState = {
  error?: string;
  /** True when the request expired — the wizard renders a clickable 重新產生貼文範本 regenerate action. */
  expired?: boolean;
};

/** Resolve the pasted post URL through platform authority + match the code (§6.3 / §D.2). */
export async function submitProofUrlAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const recover = String(formData.get("recover") ?? "");

  const adapter = getAdapter(platform);
  if (!adapter) return { error: "不支援的平台" };

  const req = await findRequestById(rid);
  if (!req || req.userId !== user.id || req.platform !== platform) return { error: "找不到驗證請求，請重新開始" };
  if (req.status !== "pending" || isExpired(req)) return { error: "驗證碼已過期", expired: true };

  // Security gate: validate URL against THIS platform BEFORE any fetch (§D.2). (`platform` arrives via
  // FormData, but it's already cross-checked against the authoritative req.platform DB row above.)
  const parsed = adapter.parsePostUrl(url);
  if (!parsed) return { error: `這不是有效的 ${adapter.label} 貼文網址` };

  // One fetch resolves author + checks the code + returns the clean canonical URL (§6.3).
  let resolved;
  try {
    resolved = await adapter.resolvePost(parsed, req.code);
  } catch {
    return { error: "無法讀取該貼文，請確認貼文為公開並再試一次" };
  }
  if (!resolved.codePresent) {
    return { error: "貼文中找不到正確的驗證碼，請確認你貼上的是剛剛發佈的那則貼文" };
  }

  await markResolved(req.id, {
    resolvedAccountId: resolved.accountId,
    resolvedHandle: resolved.handle,
    resolvedDisplayName: resolved.displayName,
    proofPostUrl: resolved.canonicalUrl, // query-free canonical, not the pasted ?xmt=… URL
  });
  redirect(`/add/${platform}/confirm?rid=${req.id}${recover ? `&recover=${encodeURIComponent(recover)}` : ""}`);
}
