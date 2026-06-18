import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { ProfileForm } from "@/app/(site)/ProfileForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="wrap onboarding">
      <h1 className="wordmark sm">建立你的正身</h1>
      <p className="lede">設定你的頭像、顯示名稱與簡介。</p>
      <ProfileForm
        variant="onboarding"
        initial={{
          displayName: user.displayName ?? "",
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl,
        }}
      />
    </main>
  );
}
