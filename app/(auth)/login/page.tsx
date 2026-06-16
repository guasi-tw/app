import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="wrap">
      <h1 className="wordmark">登入我是正身</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit">使用 Google 登入</button>
      </form>
    </main>
  );
}
