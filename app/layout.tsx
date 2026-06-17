import type { Metadata } from "next";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import "./globals.css";

const title = "我是正身 · guasi";
const description =
  "正身 — 驗證並串連你擁有的社群帳號，讓帳號被封時，存活的帳號能為你證明。我是正身。";

export const metadata: Metadata = {
  // Resolves the file-convention opengraph-image/icon URLs to absolute URLs,
  // which social-platform crawlers require.
  metadataBase: new URL(SITE_ORIGIN),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "我是",
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
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
