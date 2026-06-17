# Preview environment isolation — `preview.guasi.tw` (idea, not yet decided)

**Status:** idea / parked for later (2026-06-17). Captures options for giving Vercel **preview**
deployments their own subdomain (`preview.guasi.tw`) isolated from production `guasi.tw`. No work
done; decide when convenient. Raised because preview OAuth + preview-DB resets have been the main
friction during Slice 2 manual testing.

## Why consider it

- A stable, shareable preview/staging URL on our own domain (vs the rotating `*.vercel.app` hashes).
- It can also be the lever that **fixes preview OAuth** (see §OAuth) and gives a **persistent preview
  DB** (see §Database) — so it's not just cosmetic.

## Two patterns

### Pattern 1 — one stable staging URL (recommended)
Point `preview.guasi.tw` at a single long-lived branch (e.g. `staging`):
- Vercel → project `guasi-app` → **Settings → Domains** → add `preview.guasi.tw`, set its **Git
  Branch** to `staging` (NOT Production).
- GoDaddy DNS: one **CNAME** record — host `preview` → `cname.vercel-dns.com`.
- Result: pushes to `staging` publish to `https://preview.guasi.tw`. One clean, isolated environment
  to smoke-test before merging to `main`/prod.

### Pattern 2 — per-PR previews under our domain (wildcard)
Give each branch its own `*.preview.guasi.tw`:
- Vercel: add the **wildcard domain** `*.preview.guasi.tw`.
- GoDaddy DNS: wildcard **CNAME** — host `*.preview` → `cname.vercel-dns.com`.
- Requires **Pro** (we have it); Vercel issues a wildcard TLS cert. More moving parts than Pattern 1.

## Caveats / things that matter for *our* setup

### Database — a preview domain is NOT DB isolation (but can be paired with it)
The domain only changes the URL/cookies; the preview still uses whatever `DATABASE_URL` the **Preview**
environment provides. To give `preview.guasi.tw` its own stable schema/data, pair it with a
**branch-scoped env var** pointing at a *persistent* Neon branch:

```bash
vercel env add DATABASE_URL preview staging        # + DATABASE_URL_UNPOOLED preview staging
```

This is much nicer than the ephemeral per-PR Neon branches that bit us — "reset branch from
production" strips an unmerged migration, so a stable persistent staging branch avoids that whole class
of problem. (Background: `docs/deployment.md` §line ~40 "preview deploys hit prod DB by default".)

### OAuth — same-parent-domain previews can fix the PKCE failure
Our documented preview-login failure was `InvalidCheck: pkceCodeVerifier could not be parsed`
(see commit `f171272` / devlog v0.8.1), caused by previews on `*.vercel.app` being a *different site*
than the production OAuth callback, so the PKCE/state cookie wasn't present. If previews live on a
**subdomain of guasi.tw**, the Auth.js session/PKCE cookies can be **scoped to the parent domain
(`.guasi.tw`)** and shared between `preview.guasi.tw` and `guasi.tw`. That can make preview login work
robustly — **but it is not automatic**:
- Needs deliberate Auth.js **cookie-domain** config (set the cookie `domain` to `.guasi.tw`).
- Re-check the interaction with `AUTH_REDIRECT_PROXY_URL` (currently required on BOTH prod + preview;
  `AUTH_SECRET` must be identical across them).
- May need the new callback URL added to Google's **Authorized redirect URIs**.
- **Test on the staging branch before trusting it.**

### Don't touch the email DNS
Adding a `preview` / `*.preview` CNAME is safe — it does NOT affect the root `guasi.tw`
MX/SPF/DKIM/DMARC (iCloud Custom Email Domain). Only add the new subdomain record(s).

### Deployment protection
Decide whether `preview.guasi.tw` should be public or gated behind Vercel's preview protection
(Vercel Authentication / password). A custom preview domain still respects whatever is configured.

## Recommendation

**Pattern 1 (`preview.guasi.tw` → a `staging` branch) + a persistent Neon staging branch via
branch-scoped env.** Isolates URL *and* DB, gives one stable place to smoke-test before prod, and sets
up the clean fix for preview OAuth via the shared `.guasi.tw` cookie.

## Next steps (when picked up)

1. Decide Pattern 1 vs 2.
2. Add the domain in Vercel + the GoDaddy CNAME (leave email records untouched).
3. Create a persistent Neon `staging` branch; set branch-scoped `DATABASE_URL`(+`_UNPOOLED`).
4. (Optional) Set the Auth.js cookie domain to `.guasi.tw` and re-verify OAuth on the staging URL;
   add the Google redirect URI if needed.
5. Update `docs/deployment.md` once the model is chosen.
