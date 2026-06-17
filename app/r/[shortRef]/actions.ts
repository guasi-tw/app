// app/r/[shortRef]/actions.ts
"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { provisionExistingAccount } from "@/lib/binding/repo";

/** §D.5: designate an already-verified account as 主要帳號 (mint slug + force public). */
export async function provisionExistingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const shortRef = String(formData.get("shortRef") ?? "");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? ""); // a LinkedAccount.id, not a platform handle
  if (user.shortRef !== shortRef) redirect("/"); // owner-scoped

  const res = await provisionExistingAccount(user.id, linkedAccountId);
  if (!res.ok) {
    redirect(`/r/${shortRef}?provision=${encodeURIComponent(linkedAccountId)}&err=${res.error}`);
  }
  redirect(`/gua/${res.slug}`);
}
