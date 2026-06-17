import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="wrap">
      <h1 className="wordmark">我是登入頁</h1>
      <form
        action={async () => {
          "use server";
          // Land on the post-login dispatcher, which routes returning (provisioned)
          // 正身 to their /gua page and new users to onboarding.
          await signIn("google", { redirectTo: "/post-login" });
        }}
      >
        <button type="submit">使用 Google 登入</button>
      </form>
    </main>
  );
}
