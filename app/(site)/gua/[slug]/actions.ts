"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/identity/session";
import { discloseBinding, setMainBinding, reportCondition } from "@/lib/binding/repo";

/** Clear the client Router Cache so the just-mutated row re-renders in its new bucket (§L). */
function revalidateOwner(user: { slug: string | null; shortRef: string }) {
  if (user.slug) revalidatePath(`/gua/${user.slug}`);
  revalidatePath(`/r/${user.shortRef}`);
}

/** §C.1 disclose private → public. */
export async function discloseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
  await discloseBinding(user.id, linkedAccountId);
  revalidateOwner(user);
}

/** §C.2 set-as-main (re-point ★; forces public). */
export async function setMainAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
  await setMainBinding(user.id, linkedAccountId);
  revalidateOwner(user);
}

/** §C.3 condition flags (回報遭盜用 / 回報已被停權). */
export async function reportConditionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
  const raw = String(formData.get("condition") ?? "");
  if (raw !== "hacked" && raw !== "banned") return redirect("/");
  await reportCondition(user.id, linkedAccountId, raw);
  revalidateOwner(user);
}
