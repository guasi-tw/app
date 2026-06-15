# DB Skeleton — Neon + Prisma + Migrations + `/api/health` (Milestone 2)

**Date:** 2026-06-15
**Status:** ✅ Complete (2026-06-15, v0.5.0) — all phases done; done-definition met
**Type:** Execution spec (per-session tracker), not a product design spec.
**North star:** [`docs/deployment.md`](../../deployment.md) §5 (the unchecked scaffold items) — the
*principle & goal* this milestone executes against. Where this spec and `deployment.md` ever
disagree, `deployment.md` is the intent and this doc is the running record; reconcile by updating
both. Data-model intent comes from the design spec
[`2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) §8 (real schema) +
§12 (stack lock).

> **Legend:** **[DECIDED]** · **[REC]** recommendation, operator's final call · **[OPEN]** TBD ·
> `[ ]` / `[x]` execution checkboxes.

---

## 1. Purpose

Prove the **app→DB** half of the pipeline end-to-end on an otherwise-empty app — the second and
final part of the `deployment.md` §5 walking skeleton (Milestone 1 proved `git push → Vercel →
guasi.tw`; this proves `Vercel build → migrate → Neon`, read back through a live route).

Concretely: provision **Neon Postgres**, wire **Prisma** into the Next.js app, ship **one trivial
migration** through the deploy pipeline via `prisma migrate deploy`, set up **Neon database
branching for preview deploys** (so previews never touch prod data), and add a **`/api/health`**
route that reads the DB. After this, the first real feature (§8 schema) deploys with **zero infra
unknowns** — only product modelling remains.

This milestone is deliberately **trivial on the data side**: the real §8 schema (`users`,
`linked_accounts`, `binding_events`, `binding_requests`, `proof_records`, …) lands with feature
work, not here. We are testing the *plumbing*, not the model.

## 2. Scope

### In scope (this milestone)
- **Neon** project provisioned; pooled + direct connection strings wired into Vercel env.
- **Prisma** added to the repo: `prisma/schema.prisma` (datasource + generator + one trivial model)
  and a generated migration committed under `prisma/migrations/`.
- **`lib/db/`** — a Prisma client singleton (the `lib/*` seam from `deployment.md` §3 opens here).
- **Migrations in the pipeline** — `prisma migrate deploy` runs as the Vercel build/release step
  (direct URL), for both production and preview builds.
- **Neon database branching for previews** — every Vercel preview deploy gets its own branched
  Neon DB; production builds hit the production branch. Previews must **never** mutate prod data.
- **`/api/health`** — a **token-gated** route handler that reads the DB through Prisma and returns
  JSON, proving app→Neon live on both production and a preview.
- **Post-deploy smoke test** — a portable script + the repo's **first GitHub Action**, run after
  every Vercel deploy, that pokes the deployed URL and asserts: `/api/health` (with token) → 200,
  `/api/health` (no token) → 401, and — for production — `https://guasi.tw` + `https://www.guasi.tw`
  → 200.

### Deferred to later milestones (explicitly NOT this session)
- The real **§8 data model** and any product table beyond the throwaway health model (§5 here).
- **Auth.js** (Google OAuth + email magic-link/OTP) and its Prisma-adapter tables / Resend email.
- **Vercel Blob** (snapshots + avatars), the screenshot/archive pipeline, repositories in
  `lib/db/` beyond the client singleton.
- Promoting the migration from **build command → dedicated release step** (`deployment.md` §6 OPEN);
  build command is the accepted MVP placement.
- Any product UI. The hello-world landing page stays as-is.

## 3. Decisions

### 3.1 Two connection strings — pooled for queries, direct for migrations **[DECIDED — `deployment.md` §1/§2]**
We **adopt the integration's native env-var names** (Option 1, decided 2026-06-15 — see §3.4):
- **`DATABASE_URL`** — Neon's **pooled** (PgBouncer, `-pooler` host) string. Used by Prisma
  **Client** at runtime in serverless functions. Datasource `url`.
- **`DATABASE_URL_UNPOOLED`** — Neon's **direct/non-pooled** string. Used by **migrations**
  (`migrate deploy` / `migrate dev`) and Prisma introspection. Datasource `directUrl`.
- `[gotcha]` Mixing them up exhausts connections (pooled at runtime is mandatory on serverless) or
  breaks migrations (a pooled connection can't run DDL/advisory locks cleanly). Sanity check:
  `DATABASE_URL`'s host must contain **`-pooler`**; `DATABASE_URL_UNPOOLED`'s must **not**.
- These are exactly the names the integration injects, so preview-branch URLs flow in with **zero
  glue** (§3.4). The local `.env` (dev branch) must use the **same** two names (§3.5).

### 3.2 Migration runs as the build step **[DECIDED — `deployment.md` §2, MVP]**
- Build command becomes **`prisma migrate deploy && next build`**; `prisma generate` runs via a
  **`postinstall`** script (Vercel caches `node_modules`, so the generated client otherwise goes
  stale — a Prisma-on-Vercel gotcha).
- `migrate deploy` is idempotent (applies only un-applied migrations), so it's safe to run on every
  build, including previews. Promotion to a dedicated release job is deferred (§2).
- `[insight]` Because the build command runs for **both** prod and preview, the *only* thing that
  makes a preview safe is that its env vars point at a **branched** DB (§3.3). The migration step
  and the branching decision are coupled — neither is optional.

### 3.3 Preview deploys use Neon branching **[DECIDED — `deployment.md` §2 gotcha]**
- Each Vercel **preview** deployment must run against its own **Neon branch**, not production.
- A Neon branch is a copy-on-write clone of the parent at branch time, so it already carries every
  migration the parent had — `migrate deploy` on it is a near-no-op (applies only migrations newer
  than the branch point). Previews get a real, isolated, schema-current DB for free.

### 3.4 Provisioning + branching mechanism: the native Neon–Vercel integration **[REC]**
- Use the **official Neon–Vercel integration** to (a) inject the pooled + direct connection strings
  into the `guasi-app` Vercel project's **Production** (and Development) environments, and (b)
  **auto-create a Neon branch per preview deployment** with branched env vars injected into that
  preview. This is the lowest-effort path that satisfies §3.1 + §3.3 with no custom CI.
- **Alternative considered:** a GitHub Action that creates/deletes a Neon branch per PR and sets
  preview env vars manually. Rejected for MVP as more moving parts than the native integration; we
  have no other GitHub Actions yet (`deployment.md` §2). Revisit only if the integration's
  branch naming / cleanup proves limiting.
- **Env-var names — DECIDED 2026-06-15 (Option 1, native names):** the app reads the integration's
  own names **`DATABASE_URL`** (pooled) + **`DATABASE_URL_UNPOOLED`** (direct) directly — no custom
  names, no aliasing. This is what lets the dynamic per-preview-branch URLs flow in untouched.
- `[insight]` **Preview vars are injected per-deployment, not as static project env vars.** With
  branching on, the integration sets `DATABASE_URL` / `DATABASE_URL_UNPOOLED` on *each preview
  deployment at deploy time* (pointed at that deploy's branch) — so they correctly **do not appear**
  under the Preview column in Settings → Environment Variables. Empty-Preview-column is *expected*
  **iff** preview branching is enabled; if branching is off, Preview genuinely has no DB and breaks.

### 3.5 Local dev DB **[REC — revised 2026-06-15]**
- Develop against a **dedicated Neon dev branch** (no local Postgres / Docker). `.env` (gitignored)
  holds the two strings; commit a **`.env.example`** documenting both. Generate the first migration
  locally with `prisma migrate dev` against this branch, then commit `prisma/migrations/`.
- **Use the integration's `vercel-dev` branch, not a hand-made one.** The Neon–Vercel integration
  auto-creates **`vercel-dev`** and wires Vercel's **Development** environment to it — so pointing
  local `.env` at `vercel-dev` keeps local + Vercel-Development consistent and avoids two drifting
  dev DBs. The manually-created `dev` branch (Phase A) is therefore **redundant and deleted**; do
  **not** delete `vercel-dev` (integration-owned; backs Development env, gets recreated if removed).

### 3.6 `lib/db/` client singleton **[DECIDED — standard Prisma+Next pattern]**
- `lib/db/client.ts` exports a single `prisma` instance, cached on `globalThis` in dev to survive
  Next's hot-reload (otherwise every reload opens a new pool). This is the first occupant of the
  `lib/*` modular-monolith seam (`deployment.md` §3); repositories arrive with feature work.

### 3.7 `/api/health` is token-gated — reject before touching the DB **[DECIDED]**
- The endpoint requires an **`x-health-token`** header matching a **`HEALTH_CHECK_SECRET`** env var
  and returns **401 *before* any Prisma call** when it's missing/wrong. Auth.js does not exist yet
  (a deferred milestone), so a **shared secret is the right-sized gate** — no auth infra, one env var.
- `[insight]` The point of the gate is **cost/abuse control, not authzn**: a `count()` on an empty
  table is ~free, but every anonymous hit is a billed **Vercel invocation** and would **keep Neon's
  compute warm** (defeating scale-to-zero, the real free-tier cost). Rejecting *before* the DB read
  is what neutralises both — an auth wall wouldn't, and isn't available pre-auth anyway.
- **Deferred (not now):** a separate **public no-DB liveness** route (for an external uptime monitor)
  and **rate-limiting** (needs an Upstash store we haven't added). The single token-gated endpoint is
  enough for MVP; the README status badge pings `guasi.tw` root, not this route, so it's unaffected.

### 3.8 Post-deploy smoke test — script + first GitHub Action **[REC]**
- **Portable core: `scripts/smoke.mjs`** — a zero-dependency Node ESM script that takes a base URL
  (+ the health token) and asserts a list of `(url, expected-status)` checks, exiting non-zero on
  any mismatch. Runnable by hand (`node scripts/smoke.mjs …`) *and* from CI — the assertions live in
  the repo, not in YAML.
- **CI wiring: `.github/workflows/smoke.yml`** — triggers on the **`deployment_status`** event
  (fires when Vercel finishes a deploy and reports it to GitHub), runs only on
  `state == 'success'`, and tests the deploy's **`target_url`**:
  - **Production** deploy → assert `https://guasi.tw` 200, `https://www.guasi.tw` 200 (following the
    308→apex redirect — see note), `https://guasi.tw/api/health` **200 with token** + **401 without**.
  - **Preview** deploy → assert `<target_url>/api/health` **200 with token** + **401 without** (apex/
    www are production-only, so they're skipped). This makes the smoke test a **PR gate** — a broken
    preview shows a red check *before* merge.
- `[note]` **`www` is a 308 redirect to the apex** (`deployment.md` / Milestone 1 §C). "Expect 200"
  means **follow redirects** (`curl -L` / `redirect: 'follow'`) and assert the final 200; the script
  notes this so the redirect isn't mistaken for a failure.
- `[insight]` For **production** this is a **detector, not a gate**: Vercel's git integration has
  already promoted the deploy live by the time `deployment_status: success` fires, so a red smoke
  test *signals* a broken prod (red commit check / notification) but can't auto-roll-back. For
  **previews** it *is* a pre-merge gate. (A true prod gate would need Vercel deployment Checks /
  promotion gating — deferred.)
- `[note]` **Correction (observed 2026-06-15):** `deployment_status` workflows fire from the
  **deployed ref's** `smoke.yml`, *not* only the default branch — the workflow ran on this PR's own
  preview deploys *before* merge (the pre-bypass ones failed on the SSO wall, then went green). So
  there's **no chicken-and-egg**: the smoke test gates previews from the feature branch immediately.
  (Earlier assumption that it only runs from `main` was wrong.)
- **Secret:** add **`HEALTH_CHECK_SECRET`** as a **GitHub Actions secret** (matches the Vercel
  prod+preview value, §3.7) so the workflow can hit the gated endpoint.
- **Alternative considered:** run the smoke test as the last Vercel **build** step — rejected: at
  build time the deployment isn't aliased/live yet, so it can't curl the final URL. Post-deploy via
  `deployment_status` is the correct hook. This is the **first GitHub Action** in the repo and is
  exactly the "tests on deploy — what Vercel doesn't do" case `deployment.md` §2 anticipated.

### 3.9 Preview Deployment Protection — bypass for automation **[DECIDED 2026-06-15]**
- `[gotcha]` **Preview `*.vercel.app` URLs sit behind Vercel Authentication** (SSO) — discovered when
  the PR-1 preview returned `401` with a `_vercel_sso_nonce` cookie + "Authentication Required" page
  *before* reaching our app. So both a manual `curl` and the smoke Action would get a **false 401**
  from Vercel's wall, not our token gate. The **production custom domain `guasi.tw` is exempt** (only
  preview + the generated prod `*.vercel.app` URLs are protected), so prod smoke checks are unaffected.
- **Decision: keep protection ON, use Vercel "Protection Bypass for Automation."** Previews can hold
  test data for an identity product — keeping them private is the right posture. The smoke test sends
  the **`x-vercel-protection-bypass`** header (value = `VERCEL_AUTOMATION_BYPASS_SECRET`) on every
  request; harmless on the public prod domain, required for previews. *Rejected:* disabling preview
  protection (makes previews public) — simpler but exposes preview URLs + data.
- **Operator step:** Vercel → `guasi-app` → Settings → **Deployment Protection → Protection Bypass
  for Automation** → generate the secret → add it as a **GitHub Actions repo secret**
  **`VERCEL_AUTOMATION_BYPASS_SECRET`**. (Same value works for local `curl` against a preview.)

## 4. Stack / versions **[DECIDED]**
- **Prisma pinned to `6.19.3`** — `prisma` (devDep) + `@prisma/client` (dep), PostgreSQL provider,
  `prisma-client-js` generator. `[gotcha]` `prisma@latest` now resolves to **7.8.0**; we
  deliberately pin **6.x** because (a) the spec targeted 6.x, (b) Prisma 7 ships a new dev tool
  `@prisma/dev` whose bundled `@hono/node-server` carries 3 moderate advisories — `npm audit fix`
  *downgrades to 6 anyway* — and we keep the v0.4.0 clean-audit norm, and (c) Prisma 7's new
  mandatory-custom-output / ESM generator is churn a trivial skeleton doesn't need. Revisit the 7
  upgrade as its own task. `npm audit` → **0 vulnerabilities** on 6.19.3.
- **Node.js runtime** for the DB route — Prisma can't run on the Edge runtime, so `/api/health`
  declares `export const runtime = 'nodejs'`. `[gotcha]`
- **Build wiring:** `postinstall: prisma generate` (Vercel-cache gotcha) + `build: prisma migrate
  deploy && next build` — both in `package.json` (version-controlled, no Vercel dashboard override).

## 5. The trivial first model **[DECIDED]**

A single throwaway table, named so it's obviously not product data:

```prisma
model HealthCheck {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
}
```

`/api/health` proves app→DB by doing a **real Prisma read against a migrated table** (e.g.
`prisma.healthCheck.count()`), not a raw `SELECT 1` — that way a green health check also proves the
*migration* ran, not just that a connection opened. The read only happens **after** the
`x-health-token` check passes (§3.7); a missing/wrong token returns 401 with no DB call. This model
is **disposable**: when the §8 schema lands it can be dropped (its own migration) or left as a
liveness probe — decided then, not now (**[OPEN]**).

## 6. Execution phases (the per-session tracker)

### Phase A — Provision Neon (operator drives dashboard; agent guides) — ✅ done 2026-06-15
- [x] Created the Neon **project**; default branch is **`production`**. (Region: operator's choice.)
- [x] Captured the **pooled** (`-pooler`) and **direct** strings for the default branch.
- [x] ~~Created a `dev` branch for local development~~ → superseded: the integration auto-creates
      **`vercel-dev`** (backs Vercel's Development env); we use that for local dev and **delete the
      redundant manual `dev`** (§3.5 revised).
- [ ] Update [`services.md`](../../services.md) (Neon → **Active**) and confirm
      [`operating-costs.md`](../../operating-costs.md) (free tier; note the paid tier trigger). *(in-repo; Phase C)*

### Phase B — Wire Neon ↔ Vercel + preview branching (operator drives; agent guides) — ✅ done 2026-06-15
- [x] Connected the **Neon-managed Vercel integration** (from the Neon side) to the existing
      standalone Neon project ↔ **`guasi-app`** Vercel project — keeps the project portable (§12) *and*
      gets branching. *(The Vercel-side "Storage → Create" flow only makes a new Vercel-managed DB;
      the connect-existing path lives on the Neon side.)*
- [x] Integration injects **`DATABASE_URL`** (pooled) + **`DATABASE_URL_UNPOOLED`** (direct) — native
      names adopted (§3.1/§3.4). Confirmed in **Production** + **Development**. **Preview is injected
      per-deploy by the branching feature** (so it's blank in static settings — `[insight]` §3.4).
- [x] **Preview branching is automatic** (always-on for this integration: *"preview deployment
      branches are created automatically by branching off of production"*) — no toggle. **Auto-delete
      obsolete Neon branches** is ON (cleans up merged preview branches; never touches `dev`/`production`).
- [x] Set **`HEALTH_CHECK_SECRET`** in Vercel for **Production + Preview + Development** (§3.7).
- [x] Added the **same `HEALTH_CHECK_SECRET`** as a **repository** Actions secret on `guasi-tw/app` (§3.8).
- [ ] **TODO (operator):** enable Vercel **Protection Bypass for Automation** + add the secret as a
      GitHub repo secret **`VERCEL_AUTOMATION_BYPASS_SECRET`** (§3.9) — needed for the smoke test to
      pass through preview Deployment Protection. *(Discovered during Phase D; see §3.9.)*

### Phase C — Prisma in the repo (in-repo; agent does, on a branch) — ✅ done 2026-06-15
- [x] Deps: `prisma` (dev) + `@prisma/client` **pinned 6.19.3** (§4); `postinstall: prisma generate`;
      build = `prisma migrate deploy && next build`. `npm audit` → 0.
- [x] `prisma/schema.prisma` — datasource (`url` = `env("DATABASE_URL")`, `directUrl` =
      `env("DATABASE_URL_UNPOOLED")`), `generator client`, the `HealthCheck` model (§5).
- [x] `lib/db/client.ts` — Prisma client singleton (§3.6).
- [x] `.env.example` (`DATABASE_URL`, `DATABASE_URL_UNPOOLED` + `HEALTH_CHECK_SECRET`); `.env`
      gitignored, points at the **`vercel-dev`** branch (§3.5 revised).
- [x] First migration `20260615213935_init_health_check` generated + applied to `vercel-dev`;
      `prisma/migrations/` committed.
- [x] `app/api/health/route.ts` — `nodejs` runtime, `force-dynamic`; token check first → 401 with no
      DB call; else `healthCheck.count()` → `{status,db,rows,time}` (`rows` = count, differs per
      branch → isolation visible in the response; 500 on error).
- [x] `scripts/smoke.mjs` (zero-dep) + `.github/workflows/smoke.yml` (`deployment_status`).
- [x] `npm run build` green locally (full `migrate deploy && next build`); local smoke **2/2 pass**
      (200 with token `{db:up}`, 401 without/wrong).
- [x] README + `services.md` + `operating-costs.md` updated.
- [ ] Commit on `milestone/db-skeleton`, push, open PR. *(in progress)*

### Phase D — Verify the pipeline end-to-end (operator + agent)
- [ ] **Preview (branch-isolation proof):**
      1. **Neon shows a new branch** — open the PR; after the preview builds, a `preview/<git-branch>`
         branch (parent `production`) appears in Neon with fresh activity.
      2. **Vercel injected the vars per-deploy** — the preview deployment's build log shows
         `migrate deploy` connecting to a **non-production** host (static Preview column stays blank).
      3. **Airtight isolation (Neon SQL Editor):** `INSERT INTO "HealthCheck" DEFAULT VALUES;` ×N on
         the **preview** branch → its `count(*)` = N, while **`production`**'s `count(*)` is unchanged
         → two separate DBs; previews can't touch prod.
      4. **Functional + isolation in one shot:** `curl -H "x-health-token: <secret>"
         -H "x-vercel-protection-bypass: <bypass>" <preview-url>/api/health` → 200
         `{db:up, rows:N}` (matches the rows you inserted on the preview branch), while
         `https://guasi.tw/api/health` shows `rows:0` — the `rows` field exposes the per-branch DB
         directly. Without `x-health-token` → 401. *(`x-vercel-protection-bypass` required — previews
         sit behind Vercel Auth, §3.9; or verify in-browser while logged into Vercel.)*
      5. **Cleanup:** after merge/close, the `preview/<git-branch>` branch is auto-deleted in Neon.
- [x] **Production:** squash-merge → `main` build ran `migrate deploy` against the production branch;
      **`https://guasi.tw/api/health`** returns 200 **with token** / **401 without** (`{"status":
      "unauthorized"}`); apex + `www` 200. Verified via the prod smoke run (4/4) + independent probes.
- [x] **Smoke test:** `smoke.yml` ran **green on the production deploy** (4/4, run `27579356946`) and
      fired on preview deploys too (pre-bypass ones failed correctly, then green) — §3.8 note.
- [ ] Tick the `deployment.md` §5 DB checkboxes; add a **devlog** entry for the session.

## 7. Done-definition (acceptance)

Complete when **all** hold:
1. `prisma migrate deploy` runs inside the Vercel build (prod + preview) using the **direct** URL.
2. **`https://guasi.tw/api/health`** returns `ok` (DB read through Prisma against the **production**
   Neon branch) **when sent the `x-health-token`**, and **401 without it** (no DB call).
3. A **PR preview**'s `/api/health` returns `ok` against a **branched** Neon DB (with the token) —
   verified by the branch existing in Neon and prod data being unaffected.
4. The **post-deploy smoke test** (`smoke.yml`) passes on a production deploy and on a PR preview —
   asserting `/api/health` 200-with-token / 401-without, and (prod) apex + `www` 200.
5. `deployment.md` §5 DB/migration/branching/`/api/health` checkboxes are ticked, and the **devlog**
   has an entry for the session.

**✅ Met 2026-06-15** — (1) build runs `migrate deploy`; (2) prod `/api/health` 200-with-token /
401-without; (3) preview ran against its own auto-branched Neon DB (smoke green post-bypass; `rows`
exposes per-branch isolation); (4) prod smoke **4/4** + preview smoke green; (5) `deployment.md` §5
ticked + devlog entry. **Remaining manual confirm:** preview branch auto-deletes after merge (Neon
dashboard).

## 8. Open questions

- **[DECIDED 2026-06-15]** Adopt the integration's **native** env-var names **`DATABASE_URL`** +
  **`DATABASE_URL_UNPOOLED`** (§3.1, Option 1) — no custom names, no aliasing; preview-branch URLs
  flow in untouched.
- **[OPEN]** Fate of the `HealthCheck` model once the §8 schema lands — drop it or keep it as a
  liveness probe (§5).
- **[OPEN]** Migration step placement: build command (MVP, here) vs a dedicated release job at
  scale (`deployment.md` §2/§6).
- **[DECIDED 2026-06-15]** `/api/health` is **token-gated** (single endpoint, 401 before the DB
  read — §3.7), not behind an auth wall (no auth exists yet) and not public. A separate public
  no-DB liveness route + rate-limiting are **deferred** until an external uptime monitor or real
  abuse warrants them.

## 9. Session log

| Date | What happened | Devlog |
|------|---------------|--------|
| 2026-06-15 | Milestone spec drafted (Neon + Prisma + migration-in-build + preview branching + `/api/health`); decisions recorded; awaiting approval. | — |
| 2026-06-15 | Refined pre-approval: `/api/health` token-gated (§3.7); env-var names (later revised); added post-deploy smoke test as first GitHub Action (§3.8). **Spec approved**; starting Phase A–B (operator-driven). | — |
| 2026-06-15 | Phase A–B: Neon project (default branch `production`) + `dev` branch created; **Neon-managed Vercel integration** connected to the existing standalone project (connect-existing lives on the Neon side; Vercel's "Storage→Create" only makes a *new* managed DB). **Adopted native env names `DATABASE_URL`/`DATABASE_URL_UNPOOLED`** (Option 1). Confirmed: Prod+Dev have vars; **preview branching is automatic** (always-on, no toggle) + obsolete-branch auto-delete ON. **A–B done.** Remaining operator TODO: set `HEALTH_CHECK_SECRET` in Vercel + GitHub. Starting Phase C. | — |
| 2026-06-15 | Learned the integration auto-creates a **`vercel-dev`** branch (backs Vercel Development env) → use it for local dev, delete redundant manual `dev` (§3.5 revised). `prisma@latest`=7.8.0 but **pinned 6.19.3** (clean audit, spec-aligned — §4). **Phase C done:** schema + `HealthCheck` model + first migration (applied to `vercel-dev`), `lib/db` client, token-gated `/api/health`, smoke script + GitHub Action; full build green; **local smoke 2/2**. `HEALTH_CHECK_SECRET` set in Vercel (3 envs) + GitHub repo secret. Opening PR → Phase D. | — |
| 2026-06-15 | PR #3 (3 commits). Discovered **preview Deployment Protection** (Vercel SSO) → added `x-vercel-protection-bypass` to smoke (§3.9). Added `rows` (HealthCheck count) to `/api/health` so per-branch isolation shows in the response. Merged. **Phase D done:** prod smoke **4/4** + independent probes (`guasi.tw` 200, `/api/health` 401-without-token); preview smoke green post-bypass. Corrected the `deployment_status`-only-on-`main` gotcha (it fires per deployed ref — §3.8). **Milestone 2 complete.** | v0.5.0 |

## Cross-references
- [`docs/deployment.md`](../../deployment.md) — north-star (§1 model, §2 CI/CD + branching gotcha, §5 checklist).
- [`docs/superpowers/specs/2026-06-15-walking-skeleton-design.md`](2026-06-15-walking-skeleton-design.md) — Milestone 1 (the tracker pattern this follows).
- [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — §8 real data model, §12 stack lock.
- [`docs/services.md`](../../services.md) · [`docs/operating-costs.md`](../../operating-costs.md) — service + cost ledgers (Neon row).
