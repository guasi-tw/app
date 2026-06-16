import { auth, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="wrap">
      <h1 className="wordmark">我是首頁</h1>
      <p className="lede">
        主動驗證並串連你擁有的社群帳號，讓某個帳號被封時，存活的帳號能為你證明 ——
        也讓任何人都能公開查證「這些帳號是同一個人」。
      </p>
      {session?.user ? (
        <div className="status">
          <span>已登入：{session.user.name ?? session.user.email}</span>
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
        <p className="status">
          <a href="/login">登入</a> · 建置中 · coming soon
        </p>
      )}
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
