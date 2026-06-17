import { notFound } from "next/navigation";
import { findUserBySlug } from "@/lib/identity/repo";

export default async function IdentityCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Case-insensitive lookup via the citext slug column. In Slice 1 no slug is ever
  // minted (binding lands in Slice 2), so this always 404s today — the lookup wiring
  // is here so Slice 3 only has to fill in the Identity Card render.
  const user = await findUserBySlug(slug);
  if (!user) notFound();

  return (
    <main className="wrap">
      <h1 className="wordmark sm">{user.displayName ?? slug}</h1>
      <p className="lede">正身頁施工中（Slice 3）。</p>
      <footer className="foot">guasi.tw/gua/{slug}</footer>
    </main>
  );
}
