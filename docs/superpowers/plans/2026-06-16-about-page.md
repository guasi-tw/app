# About Page (關於 guasi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, mobile-first `/about` page that introduces guasi, explains why it's needed, and ends with a register CTA — written in Traditional Chinese.

**Architecture:** One additive route `app/about/`. Copy lives in a typed `content.ts` data module (unit-tested for the locked accuracy constraints); `page.tsx` is a thin Server Component that maps the data into markup styled by a co-located CSS module. No shared files are edited (except one optional home-page link task), so this stays isolated from the parallel `slice2-add-account-binding` work.

**Tech Stack:** Next 16 App Router (Server Component, static), CSS Modules, Vitest (node env, logic-only).

**Spec:** `docs/superpowers/specs/2026-06-16-about-page-design.md`

**Working directory:** `~/Source/github/guasi-tw/about` (branch `about-page`). All paths below are relative to it.

---

## File Structure

- **Create** `app/about/content.ts` — typed, structured copy (single source of all strings). One responsibility: the page's content + the brand/accuracy contract.
- **Create** `app/about/content.test.ts` — node-env unit test asserting the accuracy constraints (CTA target, login method, platforms, no Email/snapshot claims) + key anchor strings.
- **Create** `app/about/about.module.css` — all page styling, scoped. Reuses `:root` tokens from `globals.css` (`--bg/--fg/--muted/--accent`); no edit to `globals.css`.
- **Create** `app/about/page.tsx` — Server Component + `metadata`; renders `content.ts` through the CSS module.
- **(Optional) Modify** `app/page.tsx` — add a small link to `/about`. The ONLY shared-file change; isolated into its own droppable task because slice2 may also touch this file.

**TDD note:** Real TDD applies to `content.ts` (Task 1) — it carries the testable contract. `page.tsx`/CSS (Task 2) are pure presentation with no logic; the established suite has no DOM renderer, so they're verified by `npm run build` (type-check + route build) + a visual check at `/about`, not a render test. This is deliberate, matching the repo's node-only test convention — do not add jsdom/testing-library.

---

## Task 1: Content module + accuracy contract test

**Files:**
- Create: `app/about/content.ts`
- Test: `app/about/content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/about/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { aboutContent } from "./content";

const blob = JSON.stringify(aboutContent);

describe("aboutContent — accuracy constraints", () => {
  it("CTA points to the login route", () => {
    expect(aboutContent.cta.href).toBe("/login");
  });

  it("CTA names Google as the login method", () => {
    expect(aboutContent.cta.buttonLabel).toContain("Google");
  });

  it("lists exactly the three MVP platforms plus a 'more' chip", () => {
    expect(aboutContent.platforms.items).toEqual([
      "Threads",
      "Instagram",
      "miin.cc",
    ]);
    expect(aboutContent.platforms.more).toContain("更多");
  });

  it("makes no Email / magic-link login claim (Google-only today)", () => {
    expect(blob).not.toMatch(/email/i);
    expect(blob).not.toContain("magic");
  });

  it("makes no snapshot / screenshot durability claim (link-only today)", () => {
    expect(blob).not.toContain("截圖");
    expect(blob).not.toContain("快照");
    expect(blob).not.toMatch(/snapshot/i);
  });

  it("has three how-it-works steps in order", () => {
    expect(aboutContent.how.steps.map((s) => s.title)).toEqual([
      "建立正身",
      "註冊分身",
      "驗明正身",
    ]);
  });

  it("has three trust points", () => {
    expect(aboutContent.trust.items).toHaveLength(3);
  });
});

describe("aboutContent — key anchor copy", () => {
  it("keeps the universal hook line", () => {
    expect(aboutContent.hook.title).toContain("這真的是我");
  });

  it("leads the brand as guasi", () => {
    expect(aboutContent.brand.wordmark).toBe("guasi");
  });

  it("introduces 正身 with its romanization only (no 本尊 gloss)", () => {
    expect(blob).toContain("(tsiànn-sin)");
    expect(blob).not.toContain("本尊");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- content`
Expected: FAIL — cannot resolve `./content` (module not created yet).

- [ ] **Step 3: Write the content module**

Create `app/about/content.ts`:

```ts
export type AboutStep = { n: number; title: string; body: string };
export type AboutTrustItem = { title: string; body: string };
export type AboutAccount = { platform: string; handle: string; verified: string };

export const aboutContent = {
  topbar: { brand: "guasi", label: "關於" },

  hook: {
    title: "帳號被封了，你要怎麼說「這真的是我」？",
    body: "2026 年 6 月，Meta 一波大封號，許多人一夕失去經營多年的主帳號。新帳號沒有歷史，舊帳號已無法發聲；冒名者卻搶著喊「本尊回來了」。最該證明自己的那一刻，你反而最沒辦法證明。",
  },

  brand: {
    kicker: "一個字的答案",
    wordmark: "guasi",
    pronunciation: "guá-sī ·「我是」",
    body: "把那句你最想喊、卻沒人信的「我是本人」，變成任何人都能查證的事實。這就是 guasi（我是）。",
  },

  how: {
    title: "怎麼運作",
    body: "趁帳號還活著，在 guasi 把你散落各平台的帳號綁定、驗證、公開連結。被封時，存活的帳號就能替你的新帳號背書。",
    gloss: "（你的身分中樞，我們叫它「正身」(tsiànn-sin)；各平台帳號則是「分身」。）",
    steps: [
      { n: 1, title: "建立正身", body: "註冊一個帳號，當你所有分身的中樞。" },
      { n: 2, title: "註冊分身", body: "複製一段含驗證碼的文字，從該帳號發一篇公開貼文，貼回網址即完成。" },
      { n: 3, title: "驗明正身", body: "任何人免登入就能查：這個帳號，跟哪些帳號是同一個人。" },
    ] as AboutStep[],
  },

  examplePost: {
    badge: "範例貼文",
    author: "你的帳號",
    time: "剛剛",
    tag: "@gua.si.tw",
    headline: "我是分身認證貼文",
    linkIntro: "點此觀看此帳號的正身：",
    shortUrl: "guasi.tw/r/ABC…",
    codeLabel: "我是分身驗證碼：",
    code: "ABCDEF",
    previewDomain: "🌐 guasi.tw",
    previewTitle: "我是正身 · guasi",
    caption: "↑ 這篇公開貼文本身，就替你向所有看到的人驗明正身。",
  },

  platforms: {
    label: "目前支援",
    items: ["Threads", "Instagram", "miin.cc"],
    more: "更多陸續支援",
  },

  exampleProfile: {
    sectionTitle: "驗明正身的公開頁",
    sectionDesc: "任何人輸入帳號，就能看到這個人公開承認的其他帳號與驗證證據。",
    badge: "範例",
    avatarInitial: "美",
    name: "小美",
    handleUrl: "guasi.tw/gua/meimei",
    accounts: [
      { platform: "Threads", handle: "@meimei", verified: "✔ 已驗證 · 2026/05" },
      { platform: "Instagram", handle: "@meimei.ig", verified: "✔ 已驗證 · 2026/05" },
      { platform: "Threads · 新帳號", handle: "@meimei.new", verified: "✔ 已驗證 · 2026/06" },
    ] as AboutAccount[],
  },

  trust: {
    title: "為什麼可信",
    items: [
      { title: "驗證靠本人公開動作", body: "貼文必須從該帳號本人發出，冒名者沒有控制權就發不出來。" },
      { title: "證據是公開貼文，人人可查", body: "每筆綁定都附上原始驗證貼文連結，任何人都能點開核對，不必只相信我們。" },
      { title: "不靠平台授權", body: "畢竟會封人的正是平台；身分的可信度握在你自己手上。" },
    ] as AboutTrustItem[],
  },

  whyNow: {
    title: "為什麼是現在",
    body: "封號當下，被封的帳號已經發不出驗證貼文。guasi 的價值來自「事先」——趁帳號還活著就登記、串好，被封後才有存活的帳號替你的新帳號背書。",
  },

  cta: {
    title: "趁現在，先驗明你的正身",
    subtitle: "被封後就來不及了。建立正身只要幾分鐘。",
    buttonLabel: "以 Google 登入，建立我的正身 →",
    href: "/login",
    note: "免費 · 無需密碼",
  },

  footer: "guasi.tw　·　我是正身",
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- content`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add app/about/content.ts app/about/content.test.ts
git commit -m "feat(about): content module + accuracy-constraint tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Page component + scoped styles

**Files:**
- Create: `app/about/about.module.css`
- Create: `app/about/page.tsx`

- [ ] **Step 1: Create the CSS module**

Create `app/about/about.module.css`:

```css
.page {
  min-height: 100dvh;
}

.inner {
  max-width: 30rem;
  margin: 0 auto;
}

/* top bar */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid #16161d;
}
.topbarBrand {
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.04em;
}
.topbarLabel {
  font-size: 0.8rem;
  color: var(--muted);
}

/* generic section */
.section {
  padding: 1.6rem 1.4rem;
  border-bottom: 1px solid #16161d;
}
.gold {
  background: linear-gradient(180deg, #15130a, #0b0b0f);
}
.center {
  text-align: center;
}
.kicker {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  color: var(--muted);
  text-transform: uppercase;
}
.h2 {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0 0 0.6rem;
}
.body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.85;
  color: #c8c8d0;
}
.strong {
  color: var(--fg);
}

/* hook */
.hookTitle {
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1.45;
  margin: 0 0 0.75rem;
}

/* brand */
.wordmark {
  font-size: 2.9rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.04em;
  margin: 0.85rem 0 0.35rem;
}
.pron {
  font-size: 0.95rem;
  color: #c8b06a;
  margin-bottom: 0.9rem;
}

/* gloss */
.gloss {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  line-height: 1.7;
  color: var(--muted);
}

/* steps */
.steps {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.1rem;
}
.step {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}
.stepNum {
  flex: 0 0 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: #1a160b;
  border: 1px solid var(--accent);
  color: var(--accent);
  font-weight: 800;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stepText {
  font-size: 0.85rem;
  line-height: 1.7;
  color: #c8c8d0;
}

/* example verification post */
.post {
  margin-top: 1.1rem;
  border: 1px solid #2a2a33;
  border-radius: 0.9rem;
  background: #0e0e13;
  padding: 1rem 1rem 0.9rem;
  position: relative;
}
.badge {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  border: 1px solid #2a2a33;
  border-radius: 0.4rem;
  padding: 0.1rem 0.45rem;
  background: #0b0b0f;
}
.postHead {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}
.postAvatar {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  background: #2a2a33;
}
.postAuthor {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--fg);
}
.postTime {
  font-weight: 400;
  color: var(--muted);
  font-size: 0.75rem;
}
.postBody {
  font-size: 0.8rem;
  line-height: 1.85;
  color: #e6e6ea;
}
.link {
  color: #5b9bf3;
}
.gap {
  margin-top: 0.5rem;
}
.preview {
  margin-top: 0.75rem;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
  padding: 0.6rem 0.75rem;
}
.previewDomain {
  font-size: 0.7rem;
  color: var(--muted);
}
.previewTitle {
  font-size: 0.8rem;
  color: var(--fg);
  margin-top: 0.1rem;
}
.postCaption {
  margin: 0.65rem 0 0;
  font-size: 0.7rem;
  line-height: 1.6;
  color: var(--muted);
}

/* platforms */
.plabel {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 0.65rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.chip {
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid #2a2a33;
  border-radius: 999px;
  background: #15151c;
  color: var(--fg);
}
.chipMore {
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  border: 1px dashed #34343f;
  border-radius: 999px;
  color: var(--muted);
}

/* example profile card */
.sectionDesc {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--muted);
}
.card {
  border: 1px solid #2a2a33;
  border-radius: 0.9rem;
  overflow: hidden;
  background: #101015;
  position: relative;
}
.cardHead {
  padding: 1.25rem 1.1rem 1rem;
  text-align: center;
  border-bottom: 1px solid #16161d;
}
.avatar {
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 50%;
  margin: 0 auto 0.6rem;
  background: linear-gradient(135deg, #e8b500, #7a5f00);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1500;
}
.pname {
  font-size: 1.05rem;
  font-weight: 800;
}
.purl {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.2rem;
}
.accounts {
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.account {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.acctPlatform {
  font-size: 0.7rem;
  color: var(--muted);
}
.acctHandle {
  font-size: 0.85rem;
  color: var(--fg);
}
.acctVerified {
  font-size: 0.7rem;
  color: #7bd88f;
}

/* trust */
.trustList {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.7;
  color: #c8c8d0;
}

/* cta */
.ctaTitle {
  font-size: 1.25rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}
.ctaSub {
  margin: 0 0 1.1rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--muted);
}
.ctaButton {
  display: block;
  background: var(--accent);
  color: #1a1500;
  font-weight: 700;
  text-align: center;
  padding: 0.875rem;
  border-radius: 0.625rem;
  font-size: 0.95rem;
  text-decoration: none;
}
.ctaNote {
  margin-top: 0.9rem;
  font-size: 0.75rem;
  color: var(--muted);
}

/* footer */
.footer {
  padding: 1.1rem 1.4rem 1.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  letter-spacing: 0.1em;
}
```

- [ ] **Step 2: Create the page**

Create `app/about/page.tsx`:

```tsx
import type { Metadata } from "next";
import { aboutContent as c } from "./content";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "關於 guasi · 我是正身",
  description:
    "帳號被封時，怎麼證明「這真的是我」？guasi（我是）讓你趁帳號還活著，事先驗證並串連各平台帳號，被封後存活的帳號能替你背書。",
};

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* top bar */}
        <div className={styles.topbar}>
          <span className={styles.topbarBrand}>{c.topbar.brand}</span>
          <span className={styles.topbarLabel}>{c.topbar.label}</span>
        </div>

        {/* 1 hook */}
        <section className={styles.section}>
          <h1 className={styles.hookTitle}>{c.hook.title}</h1>
          <p className={styles.body}>{c.hook.body}</p>
        </section>

        {/* 2 brand answer */}
        <section className={`${styles.section} ${styles.gold} ${styles.center}`}>
          <div className={styles.kicker}>{c.brand.kicker}</div>
          <div className={styles.wordmark}>{c.brand.wordmark}</div>
          <div className={styles.pron}>{c.brand.pronunciation}</div>
          <p className={styles.body}>{c.brand.body}</p>
        </section>

        {/* 3 how it works + example post */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.how.title}</h2>
          <p className={styles.body}>{c.how.body}</p>
          <p className={styles.gloss}>{c.how.gloss}</p>

          <div className={styles.steps}>
            {c.how.steps.map((s) => (
              <div className={styles.step} key={s.n}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepText}>
                  <strong className={styles.strong}>{s.title}</strong>　{s.body}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.post}>
            <span className={styles.badge}>{c.examplePost.badge}</span>
            <div className={styles.postHead}>
              <div className={styles.postAvatar} />
              <div className={styles.postAuthor}>
                {c.examplePost.author}{" "}
                <span className={styles.postTime}>· {c.examplePost.time}</span>
              </div>
            </div>
            <div className={styles.postBody}>
              <div className={styles.link}>{c.examplePost.tag}</div>
              <div>{c.examplePost.headline}</div>
              <div className={styles.gap}>{c.examplePost.linkIntro}</div>
              <div className={styles.link}>{c.examplePost.shortUrl}</div>
              <div className={styles.gap}>
                {c.examplePost.codeLabel}
                <strong className={styles.strong}>{c.examplePost.code}</strong>
              </div>
            </div>
            <div className={styles.preview}>
              <div className={styles.previewDomain}>{c.examplePost.previewDomain}</div>
              <div className={styles.previewTitle}>{c.examplePost.previewTitle}</div>
            </div>
            <p className={styles.postCaption}>{c.examplePost.caption}</p>
          </div>
        </section>

        {/* platforms */}
        <section className={styles.section}>
          <div className={styles.plabel}>{c.platforms.label}</div>
          <div className={styles.chips}>
            {c.platforms.items.map((p) => (
              <span className={styles.chip} key={p}>
                {p}
              </span>
            ))}
            <span className={styles.chipMore}>{c.platforms.more}</span>
          </div>
        </section>

        {/* 4 example profile card */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.exampleProfile.sectionTitle}</h2>
          <p className={styles.sectionDesc}>{c.exampleProfile.sectionDesc}</p>

          <div className={styles.card}>
            <span className={styles.badge}>{c.exampleProfile.badge}</span>
            <div className={styles.cardHead}>
              <div className={styles.avatar}>{c.exampleProfile.avatarInitial}</div>
              <div className={styles.pname}>{c.exampleProfile.name}</div>
              <div className={styles.purl}>{c.exampleProfile.handleUrl}</div>
            </div>
            <div className={styles.accounts}>
              {c.exampleProfile.accounts.map((a) => (
                <div className={styles.account} key={a.handle}>
                  <div>
                    <span className={styles.acctPlatform}>{a.platform}</span>
                    <div className={styles.acctHandle}>{a.handle}</div>
                  </div>
                  <span className={styles.acctVerified}>{a.verified}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 why trustworthy */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.trust.title}</h2>
          <div className={styles.trustList}>
            {c.trust.items.map((t) => (
              <div key={t.title}>
                ✔　<strong className={styles.strong}>{t.title}</strong>——{t.body}
              </div>
            ))}
          </div>
        </section>

        {/* 6 why now */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.whyNow.title}</h2>
          <p className={styles.body}>{c.whyNow.body}</p>
        </section>

        {/* 7 CTA */}
        <section className={`${styles.section} ${styles.gold} ${styles.center}`}>
          <div className={styles.ctaTitle}>{c.cta.title}</div>
          <p className={styles.ctaSub}>{c.cta.subtitle}</p>
          <a className={styles.ctaButton} href={c.cta.href}>
            {c.cta.buttonLabel}
          </a>
          <div className={styles.ctaNote}>{c.cta.note}</div>
        </section>

        <div className={styles.footer}>{c.footer}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the build (type-check + route build)**

Run: `npm run build`
Expected: build succeeds and the output route list includes `/about`. (Note: `build` runs `prisma migrate deploy` first; if no DB is configured locally it may fail before compiling — if so, run `npx next build` directly to compile/type-check the route, which is the part this task needs.)

- [ ] **Step 4: Visual check**

Run: `npm run dev`, open `http://localhost:3000/about`, and verify at 375px width (DevTools device toolbar):
- single column, no horizontal scroll;
- all 7 sections render top-to-bottom (hook → guasi → how+steps+範例貼文 → platforms → 範例公開頁 → 可信 → 現在 → CTA);
- the gold `guasi` wordmark and gold CTA button show;
- clicking the CTA navigates to `/login`.

- [ ] **Step 5: Commit**

```bash
git add app/about/page.tsx app/about/about.module.css
git commit -m "feat(about): /about page + scoped styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 (OPTIONAL): Home-page entry link

> Skip this task to keep the change 100% additive. It is the only task that edits a shared file (`app/page.tsx`), which the parallel slice2 branch may also touch — merge-conflict risk. Do it only if you want a discoverable entry point now; otherwise the `/about` URL stands alone.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the link**

In `app/page.tsx`, add an About link inside the existing `<main className="wrap">`, immediately before the closing `<footer className="foot">guasi.tw</footer>`:

```tsx
        <p className="status">
          <a href="/about">關於 guasi</a>
        </p>
```

(If a `.status` element already sits there for a logged-in/out state, place this as an additional sibling line above the footer — do not remove existing markup.)

- [ ] **Step 2: Verify**

Run: `npm run dev`, open `http://localhost:3000/`, confirm a "關於 guasi" link appears and navigates to `/about`.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(about): link to /about from home

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (the previously-green baseline of 37 passing / 3 skipped, plus the new `content.test.ts` cases).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors for `app/about/*`.

- [ ] **Step 3: Build**

Run: `npm run build` (or `npx next build` if no local DB — see Task 2 Step 3).
Expected: success; `/about` present in the route output.

- [ ] **Step 4: Confirm isolation**

Run: `git log --oneline main..about-page` and confirm only About-related commits are present, and `git status` is clean.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §1 purpose → whole page; §2 naming strategy → Task 1 content + `content.test.ts` (guasi-first, 正身 romanization-only, no 本尊); §3 structure (7 sections + platform strip) → Task 2 `page.tsx`; §4 final copy → verbatim in `content.ts`; §5 accuracy constraints → enforced by `content.test.ts` (Google-only, no snapshot, example labelled 範例); §6 technical (single additive route, reuse tokens, no new deps, metadata, optional home link) → Tasks 2 & 3; §7 YAGNI (no i18n/animation/real data) → nothing in plan adds them; §8 acceptance → Task 4 + Task 2 visual check.
- **Placeholder scan:** none — all code is complete and inline.
- **Type consistency:** `aboutContent` shape defined in Task 1 is consumed field-for-field in Task 2 (`c.hook.title`, `c.brand.wordmark`, `c.how.steps[].n/title/body`, `c.examplePost.*`, `c.platforms.items/more`, `c.exampleProfile.accounts[].platform/handle/verified`, `c.trust.items[].title/body`, `c.cta.href/buttonLabel/note`, `c.footer`); all names match.
