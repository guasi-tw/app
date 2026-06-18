import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { ProfileForm } from "@/app/(site)/ProfileForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Back to the management view they came from (slug-less /r is already locked to manage).
  const backHref = user.slug ? `/gua/${user.slug}?view=manage` : `/r/${user.shortRef}`;
  return (
    <main className="wrap">
      <h1 className="wordmark sm">編輯個人資料</h1>
      <ProfileForm
        variant="edit"
        initial={{ displayName: user.displayName ?? "", bio: user.bio ?? "", avatarUrl: user.avatarUrl }}
      />
      <p className="id-foot"><a href={backHref}>← 返回我的正身</a></p>
    </main>
  );
}
