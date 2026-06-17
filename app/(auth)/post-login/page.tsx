import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";

/**
 * Post-login dispatcher. A static `redirectTo` on the Google button can't choose the
 * destination because the 正身's state isn't known until the session exists, so signIn
 * lands here and we branch on it:
 *   - provisioned 正身 (has a slug) → their public profile page `/gua/{slug}`
 *   - everyone else (brand-new, or onboarded-but-no-main-yet) → `/onboarding`
 * `slug` is the codebase's "this account exists / is provisioned" signal (minted at
 * main-account designation) — same branch `saveProfileAction` and `/r/{shortRef}` use.
 */
export default async function PostLoginPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  else if (user.slug) redirect(`/gua/${user.slug}`);
  else redirect("/onboarding");
}
