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
      <body>{children}</body>
    </html>
  );
}
