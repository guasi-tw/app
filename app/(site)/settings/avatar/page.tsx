import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { AvatarForm } from "./AvatarForm";

export default async function AvatarSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="wrap">
      <h1 className="wordmark sm">更換頭像</h1>
      <AvatarForm currentUrl={user.avatarUrl} />
      <p className="id-foot"><a href="/settings">← 返回編輯個人資料</a></p>
    </main>
  );
}
