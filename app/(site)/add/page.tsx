// app/add/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";

// Display list of the MVP platforms. A platform is "active" iff the registry has an adapter
// (Slice 2: threads only); the rest render disabled with a 施工中 badge. Generic picker — no
// primary/non-primary framing here, so it's reusable for future non-primary binding.
const PLATFORMS = [
  { key: "threads", label: "Threads" },
  { key: "instagram", label: "Instagram" },
  { key: "miin", label: "miin.cc" },
] as const;

export default async function PlatformPickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="wrap">
      <h1 className="wordmark sm">選擇平台</h1>
      <p className="lede">選擇要驗證綁定的平台。</p>
      <div className="platform-list">
        {PLATFORMS.map((p) => {
          const active = !!getAdapter(p.key);
          return active ? (
            <a key={p.key} className="platform-tile" href={`/add/${p.key}`}>
              <span>{p.label}</span>
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <div key={p.key} className="platform-tile disabled" aria-disabled="true">
              <span>{p.label}</span>
              <span className="tag-wip">施工中</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
