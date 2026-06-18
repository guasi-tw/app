import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { ownerHomePath } from "@/lib/identity/urls";
import { GoogleSignInButton } from "@/app/GoogleSignInButton";

export default async function LoginPage() {
  // Already logged in → no reason to be on the login page. Send them to their own 正身
  // (public card if a slug exists, else the short link). Logout/切換帳號 live in the
  // management view, so we don't show a login button to a signed-in user.
  const user = await getCurrentUser();
  if (user) redirect(ownerHomePath(user));

  return (
    <main className="wrap">
      <h1 className="wordmark">我是登入頁</h1>
      <GoogleSignInButton block />
    </main>
  );
}
