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
      errors.avatar = e instanceof AvatarError ? e.message : "頭像處理失敗，請再試一次";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  // Both results are ok here (errors empty); narrow for TS.
  await updateUserProfile(user.id, {
    displayName: nameRes.ok ? nameRes.value : "",
    bio: bioRes.ok ? bioRes.value : null,
    ...(avatarUrl ? { avatarUrl } : {}),
  });

  redirect(`/r/${user.shortRef}`);
}
