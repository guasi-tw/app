"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { sanitizeDisplayName, sanitizeBio } from "@/lib/identity/profile";
import { processAvatar, storeAvatar, AvatarError } from "@/lib/identity/avatar";
import { updateUserProfile } from "@/lib/identity/repo";

export type OnboardingState = {
  errors?: { displayName?: string; bio?: string; avatar?: string };
};

export async function saveProfileAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const nameRes = sanitizeDisplayName(String(formData.get("displayName") ?? ""));
  const bioRes = sanitizeBio(String(formData.get("bio") ?? ""));
  const errors: NonNullable<OnboardingState["errors"]> = {};
  if (!nameRes.ok) errors.displayName = nameRes.error;
  if (!bioRes.ok) errors.bio = bioRes.error;

  let avatarUrl: string | undefined;
  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const processed = await processAvatar(buf, file.type);
      avatarUrl = `${await storeAvatar(user.id, processed.data, processed.contentType)}?v=${Date.now()}`;
    } catch (e) {
      if (e instanceof AvatarError) {
        errors.avatar = e.message;
      } else {
        // Unexpected (non-validation) failure — e.g. sharp's native module
        // failing to load, or a Blob upload error. Log it: swallowing it
        // silently makes the generic message un-diagnosable in production.
        console.error("[onboarding] avatar processing failed", e);
        errors.avatar = "頭像處理失敗，請再試一次";
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  // Both results are ok here (errors empty); narrow for TS.
  await updateUserProfile(user.id, {
    displayName: nameRes.ok ? nameRes.value : "",
    bio: bioRes.ok ? bioRes.value : null,
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(user.onboardedAt ? {} : { onboardedAt: new Date() }), // stamp once, on first completion (§F)
  });

  // Destination depends on context (§F): a provisioned user → their own page's 管理檢視
  // (where they edit from); a returning slug-less owner editing via /settings → their /r
  // card (already locked to manage); only a genuine first-timer (no slug, not yet onboarded)
  // → the platform picker to set their main. `user.onboardedAt` is read pre-stamp, so a
  // first completion still falls through to /add.
  if (user.slug) redirect(`/gua/${user.slug}?view=manage`);
  else if (user.onboardedAt) redirect(`/r/${user.shortRef}`);
  else redirect("/add");
}
