# Walking Skeleton — Scaffold, Vercel CI/CD & Domain (Milestone 1)

**Date:** 2026-06-15
**Status:** In progress
**Type:** Execution spec (per-session tracker), not a product design spec.
**North star:** [`docs/deployment.md`](../../deployment.md) — the *principle & goal* this milestone
executes against. Where this spec and `deployment.md` ever disagree, `deployment.md` is the
intent and this doc is the running record; reconcile by updating both.

> **Legend:** **[DECIDED]** · **[REC]** recommendation, operator's final call · **[OPEN]** TBD ·
> `[ ]` / `[x]` execution checkboxes.

---

## 1. Purpose

Stand up the **walking skeleton** from `deployment.md` §5: the minimal end-to-end pipeline that
proves CI/CD, domain binding, and (later) migrations on an otherwise-empty app — so the first
real feature deploys with **zero infra unknowns**.

This spec exists so each work session has a single place to see **what's done, what's next, and
why** — without re-deriving decisions from the design docs every time. `deployment.md` says
*what we're aiming at*; this doc tracks *how far we've walked*.

## 2. Scope

### In scope (this milestone)
- A minimal **Next.js hello-world** app — the deployable shell only.
- **Vercel CI/CD** via the GitHub integration: `push main` → production, PR/branch → preview.
- **Custom domain** `guasi.tw` bound to the Vercel project (DNS + SSL), plus `www`.

### Deferred to later milestones (explicitly NOT this session)
- **Neon** Postgres provisioning, Prisma schema + a trivial migration via `prisma migrate deploy`.
- **Neon database branching** for preview deploys.
- `/api/health` route hitting the DB (app→Neon proof).
- **Auth.js** (Google OAuth + email magic-link/OTP), Vercel Blob, screenshot/archive pipeline.
- Any product feature (verification, ledger, lookup) — those follow the MVP spec + writing-plans.

## 3. Repo structure — flat modular monolith **[DECIDED 2026-06-15]**

One Next.js app at the repo root, one `package.json`, one Vercel project. Matches
`deployment.md` §3 as written.

```
app/            Next.js routes (UI + API)        ← the deployable
lib/            adapters/ verification/ db/ storage/   ← created when product code lands, not now
prisma/         schema.prisma + migrations/      ← created with the DB milestone, not now
package.json    one package, root
```

**Alternatives considered and rejected (2026-06-15):**
- **Lightweight workspaces monorepo** (`apps/web` + `packages/db` via pnpm/npm workspaces, no
  Turborepo) — a real monorepo with `db` as a shared package. Rejected: only one deployable
  exists today; the DB schema + migrations already live in-repo under `prisma/` either way, so
  the monorepo buys structure we don't yet need.
- **Full Turborepo monorepo** (`apps/web` + `packages/{db,core,adapters}` + build pipeline) —
  rejected as premature; splitting `core`/`adapters` before a second consumer exists is churn.

**Escape hatch (unchanged from `deployment.md` §3):** keep `lib/*` boundaries clean so promoting
them to `packages/*` later is mechanical. Trigger to split: a genuinely separate deployable
(e.g. the heavy screenshot/archive worker — `deployment.md` §3, `platform-verification.md` §5).

## 4. Stack choices for the scaffold **[DECIDED]**

- **Package manager: npm** — already in use; `package-lock.json` is what Vercel auto-detects.
  No pnpm, no Turborepo.
- **Next.js 16 + React 19 + TypeScript**, **App Router** (Turbopack build).
- **No Tailwind yet** — add when real UI work begins; a hello-world doesn't need it.
- **No `src/` dir** — `app/` lives at the repo root (matches §3).

## 5. The landing page (hello-world) **[DECIDED]**

Minimal but on-brand. Operator-only traffic (not advertised), so it does not need to be polished
marketing — but it shouldn't be an embarrassing default page either.

- `lang="zh-Hant"`; metadata title `我是正身 · guasi`.
- Content: the **「我是正身」** wordmark, a one-line description of what 正身 is, and a
  **「建置中 / coming soon」** note.
- No external assets, no analytics yet (Vercel Web Analytics is its own deferred todo).

## 6. Execution phases (the per-session tracker)

### Phase A — Scaffold the shell (in-repo; agent does) — ✅ done 2026-06-15
- [x] `package.json` (name `guasi-app`, scripts: dev/build/start/lint) + `package-lock.json`.
- [x] `tsconfig.json`, `next.config.ts` (`next-env.d.ts` is generated + gitignored; so is `.next/`, `.vercel/`).
- [x] `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (the §5 landing page).
- [x] `README.md` — local-dev steps + a **Deployment & CI/CD** section.
- [x] Excluded the gitignored `pitch-deck/` workspace from root `tsconfig` (it has its own deps).
- [x] `npm run build` passes locally (Next 16, static `/`).
- [x] Commit on branch `milestone/walking-skeleton`, push, open PR.

### Phase B — Vercel CI/CD (operator drives dashboard; agent guides)
- [ ] Install the **Vercel GitHub app** on the `guasi-tw` org (grant access to `app` repo).
- [ ] Import `guasi-tw/app` → Vercel project **`guasi-web`** (Root Directory = repo root,
      framework auto-detected as Next.js).
- [ ] **Production deploy** from `main` succeeds → reachable on the `*.vercel.app` URL.
- [ ] **Preview deploy** from the PR branch succeeds → its own preview URL.

> **Bootstrap ordering (chicken-and-egg):** importing the repo makes Vercel immediately deploy
> the production branch (`main`). Until this scaffold reaches `main`, that deploy has nothing to
> build. So **merge the scaffold PR to `main` first, then import to Vercel** — production deploy
> + domain then succeed against a real app. Verify the **preview** path on the *next* change/PR.

### Phase C — Bind `guasi.tw` (operator drives DNS; agent gives exact records)
- [ ] Add domain **`guasi.tw`** (apex) + **`www.guasi.tw`** to the `guasi-web` project.
- [ ] Configure DNS at the registrar/DNS host per Vercel's instructions (apex A/ALIAS +
      `www` CNAME, or Vercel nameservers — **[OPEN]** depends on where `guasi.tw` DNS lives).
- [ ] Domain verified + **SSL issued**; `https://guasi.tw` serves the landing page.
- [ ] Decide apex-vs-`www` canonical redirect (Vercel handles the redirect either way).

## 7. Done-definition (acceptance)

This milestone is complete when **all** hold:
1. `git push` to `main` automatically ships production; a PR automatically ships a preview.
2. `https://guasi.tw` loads the hello-world over valid TLS.
3. `deployment.md` §5 checkboxes for repo/Vercel/domain are ticked, and the **devlog** has an
   entry for the session(s).

(Neon, migrations, and `/api/health` are part of §5 too but are **deferred** here — they get
their own milestone spec.)

## 8. Open questions

- **[OPEN]** Where is `guasi.tw` DNS managed (registrar default DNS / Cloudflare / other)? Decides
  the exact DNS records in Phase C.
- **[OPEN]** Vercel plan: Hobby is non-commercial; move to **Pro** before commercial launch
  (`deployment.md` §6) — not blocking this milestone.
- **[OPEN]** Canonical host: `guasi.tw` vs `www.guasi.tw` (cosmetic; redirect is automatic).

## 9. Session log

| Date | What happened | Devlog |
|------|---------------|--------|
| 2026-06-15 | Milestone spec written; structure decided (flat monolith). | TBD |
| 2026-06-15 | Phase A done: Next 16 scaffold + landing page, README CI/CD section, build green, PR opened. Phase B/C (Vercel + domain) next. | TBD |
| 2026-06-15 | Resolved transitive `postcss` advisory (GHSA-qx2v-qp2m-jg93) via an `overrides` pin to `^8.5.15` (Next stays on 16); `npm audit` → 0 vulnerabilities. | TBD |

## Cross-references
- [`docs/deployment.md`](../../deployment.md) — north-star principle (§5 scaffold checklist).
- [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — product/architecture source of truth.
- [`todo.md`](../../../todo.md) — the "hello-world landing page on Vercel" + "Vercel Web Analytics" todos.
