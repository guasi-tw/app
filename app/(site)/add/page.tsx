// app/add/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { pickablePlatforms } from "@/lib/binding/platforms/catalog";
import { PlatformIcon } from "@/app/(site)/gua/[slug]/PlatformIcon";

// The picker lists the MVP platforms from the shared catalog. A platform is "active" iff the
// registry has an adapter (the rest render disabled with a 施工中 badge). Slug-INELIGIBLE platforms
// (miin) are HIDDEN ENTIRELY for a slug-less user — their first bind would become the main 分身,
// which must mint a slug. A provisioned user (has a slug) sees all platforms. Recover bypasses this
// page, so it's unaffected.
export default async function PlatformPickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const platforms = pickablePlatforms(!!user.slug);

  return (
    <main className="wrap">
      <h1 className="wordmark sm">選擇平台</h1>
      <p className="lede">選擇要驗證綁定的平台。</p>
      <div className="platform-list">
        {platforms.map((p) => {
          const active = !!getAdapter(p.key);
          return active ? (
            <a key={p.key} className="platform-tile" href={`/add/${p.key}`}>
              <span className="platform-name">
                <PlatformIcon platform={p.key} size={20} />
                {p.label}
              </span>
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <div key={p.key} className="platform-tile disabled" aria-disabled="true">
              <span className="platform-name">
                <PlatformIcon platform={p.key} size={20} />
                {p.label}
              </span>
              <span className="tag-wip">施工中</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
