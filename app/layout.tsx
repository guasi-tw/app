import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "我是正身 · guasi",
  description:
    "正身 — 主動驗證並串連你擁有的社群帳號，讓帳號被封時，存活的帳號能為你證明。我是正身。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      {/* Browser extensions (e.g. Feedly) inject attributes like `data-feedly-mini`
          onto <body> before React hydrates; suppress the resulting attribute-mismatch
          warning. Our own render of <body> is deterministic. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
