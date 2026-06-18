import { signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/identity/session";
import { GoogleSignInButton } from "@/app/GoogleSignInButton";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="wrap">
      <h1 className="wordmark">我是 · guasi</h1>
      <p className="lede">
        我是 —— 驗證並串連你擁有的社群帳號，讓某個帳號被封時，存活的帳號能為你證明。
      </p>
      {user ? (
        <div className="status">
          <a href={`/r/${user.shortRef}`}>前往我的正身頁 →</a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit">登出</button>
          </form>
        </div>
      ) : (
        <div className="status">
          <GoogleSignInButton label="以 Google 建立正身" className="btn-cta" />
        </div>
      )}
    </main>
  );
}
