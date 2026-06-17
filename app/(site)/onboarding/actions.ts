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
      avatarUrl = await storeAvatar(user.id, processed.data, processed.contentType);
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
  });

  // New 正身 (no main yet) → pick a platform to set their main; a provisioned user
  // re-editing their profile → back to their public page.
  redirect(user.slug ? `/gua/${user.slug}` : "/add");
}
