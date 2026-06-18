"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/identity/session";
import { processAvatar, storeAvatar, AvatarError } from "@/lib/identity/avatar";
import { updateUserAvatar } from "@/lib/identity/repo";

export type AvatarState = { error?: string };

export async function saveAvatarAction(_prev: AvatarState, formData: FormData): Promise<AvatarState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "請選擇圖片" };

  let avatarUrl: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const processed = await processAvatar(buf, file.type);
    const stored = await storeAvatar(user.id, processed.data, processed.contentType);
    // §L cache-busting: storeAvatar overwrites a stable Blob key, so append a version to
    // force <img> to refetch the changed bytes.
    avatarUrl = `${stored}?v=${Date.now()}`;
  } catch (e) {
    if (e instanceof AvatarError) return { error: e.message };
    console.error("[settings/avatar] avatar processing failed", e);
    return { error: "頭像處理失敗，請再試一次" };
  }

  await updateUserAvatar(user.id, avatarUrl);
  if (user.slug) revalidatePath(`/gua/${user.slug}`);
  revalidatePath(`/r/${user.shortRef}`);
  revalidatePath("/settings");
  redirect("/settings");
}
