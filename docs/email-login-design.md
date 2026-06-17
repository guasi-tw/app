# Email Login (Magic-link + OTP) — Design

**Status:** 🔵 Deferred feature — **not** in the current Google-only auth MVP, but this is the
**maintained, authoritative design** for it (kept current — unlike the historical
`docs/superpowers/specs/*`). Pick it up when adding a passwordless email method; the Google-only MVP
is built so email is **additive** (see "Forward-compatibility" below).
**Origin:** migrated 2026-06-17 from `docs/superpowers/specs/2026-06-15-email-login-future-feature.md`.
**Context:** site login = **Google OAuth only today** (CLAUDE.md "Locked decisions"); stack = Auth.js
v5 + Resend (from `send.guasi.tw`) + Prisma adapter; `User` = 正身, joined to email login by verified
email.

> **Why deferred:** the MVP ships **Google OAuth only** for speed and minimal surface. Email login
> adds real complexity (email delivery, OTP brute-force/lockout-DoS, custom session minting). The
> MVP is built so email is **additive** — see "Forward-compatibility" below. The Resend side is
> already done (DNS-verified `send.guasi.tw` + API key, 2026-06-15), so the infra is ready when this
> milestone starts.

---

## 1. Goal

Add a second passwordless login method — **email** — that resolves to the **same 正身** as Google
when the verified email matches. Two ways in from one email: a **magic link** and a **6-digit OTP
code**. Sent via **Resend** from `send.guasi.tw`.

## 2. Forward-compatibility — what the Google-only MVP already guarantees

Adding email later is **additive (no migration of existing accounts)** because the MVP locks these:

1. **Auth.js + Prisma adapter** — the adapter schema (`User`/`Account`/`Session`/`VerificationToken`)
   is multi-provider by design. Adding email = register a provider + (for the `rid` model below) one
   new table; existing `User`/`Account` rows are untouched.
2. **`User.email` unique + populated from Google's *verified* email** — this is the join key email
   login resolves to → same 正身.
3. **DB sessions** — email login mints the same kind of session.
4. **`signIn` `email_verified` hardening kept even Google-only** — the same check the linking model
   (below) relies on.

So nothing in this doc requires reworking the MVP; it's a clean add-on.

## 3. Recommended design — opaque `rid` + 6-digit code

This is the **chosen** email-login model (it evolved through two simpler designs — see §7 for the
history and *why* this won).

A login request is one record:

```
LoginRequest { rid (random, high-entropy), email, codeHash (6-digit, hashed), expiresAt, attempts, consumedAt }
```

- **Magic link carries `rid` only** — `https://guasi.tw/login/verify?rid=<opaque>`. **No email in the
  URL.** The `rid` is the unguessable secret and exists only in the victim's inbox, so the link path
  is **untargetable** — an attacker can't address someone else's pending login.
- **6-digit code** is shown in the same email for manual entry.
- **OTP path knows the request via an httpOnly cookie:** `rid` is set as an httpOnly cookie on the
  **initiating device** when login is requested. The user reads the code (e.g. off their phone) and
  types it into the initiating device; the server matches `(rid-from-cookie, code)`. The cross-device
  case *finish-on-a-different-device-than-you-started* is covered by the **magic link** instead.
- On success: resolve/create the 正身 by email via the adapter, then **mint a DB session** (see §5).

### Why `rid` (the security win)
- **Lockout-DoS is eliminated by construction.** Verification is scoped to a `rid`, not to the email.
  Burning a `rid` (too many wrong guesses) never locks the human out — they just have their own
  `rid`/cookie or use the link. There is no email-level lock to weaponize. (This was the operator's
  specific worry: an attacker repeatedly failing codes to lock a victim's email out.)
- **The link path is untargetable** — no predictable identifier (email) in the URL to attack.

## 4. The surviving caveat — OTP path still needs throttling

The `rid` hardens the *link*; it does **not** fully protect the *manual OTP* path. Exact hole:

> An attacker visits the login page, types **the victim's** email, requests login. This mints `rid_A`
> in the *attacker's* cookie bound to the victim's email and emails the code **to the victim**. The
> attacker now holds a valid `rid_A` and can brute-force the 6-digit code via the OTP form.

So an attacker can always create *their own* request for any email. Required controls on the OTP
verify step (these are non-negotiable):

- **Per-`rid` attempt cap** — invalidate that `rid`'s code after ~5 wrong guesses (burn the code, not
  the account; user re-requests).
- **Per-email *send* throttle** — e.g. ≤3–5 login emails / hour / email. Double duty: caps how fast
  an attacker can cycle codes to brute-force **and** stops them email-bombing the victim.
- **Per-IP rate limit + backoff** on request and verify endpoints.
- **Short expiry** (~10 min) + **single active code per email** (new request invalidates the old).

Math: covering 10⁶ with ~5 guesses/code needs ~200k fresh code-sends to the victim — rate-limited
into infeasibility, and the victim would see the spam (also throttled). Safe.

## 5. Integration cost — custom verify + DB-session minting

Auth.js's **stock email provider always puts `email` in the callback URL** and keys the token by
email — there's no config to drop it. So the `rid`-only link means **leaving the stock email
provider**:

- A **custom `LoginRequest` table + custom verify route** (not Auth.js's native `VerificationToken`).
- On success, **mint an Auth.js-compatible DB session via the Prisma adapter** ourselves
  (find-or-create 正身 by email → `adapter.createSession` + set the Auth.js session cookie).
- **Google OAuth stays 100% stock Auth.js** — only the email path is custom.

**Key plan question:** the cleanest way to mint a DB session from custom code in Auth.js v5. Note the
trap: a **Credentials provider forces JWT sessions**, which conflicts with our DB-session choice — so
email login must **not** be a Credentials provider; it mints the DB session directly via the adapter.

## 6. Account linking — same-email convergence (safe here)

When email is added, Google + email resolve to **one 正身** by **matching verified email** (not "is
it a Gmail address" — Google accounts exist on non-Gmail domains too).

- **Google email == existing login email** → ✅ auto-link, either order.
- **Google email ≠ existing login email** → ❌ not merged; that needs a separate logged-in
  "connect method" flow (you must be authed as A and prove control of B — unsafe at the login screen).

**Why same-email auto-link is secure:** every path to a `User`-with-email-X already proves control of
X — Google always returns `email_verified: true` (nobody gets a Google token for an email they don't
own), and magic-link/OTP requires *receiving* mail at X. So the second method only succeeds if its
user also controls the same inbox; linking never hands an account to an unproven party.

**Hardening:** (1) `signIn` rejects Google if `profile.email_verified !== true`; (2) normalize email
(lowercase + trim) at the adapter boundary; (3) `allowDangerousEmailAccountLinking: true` on Google
(and on the email provider if the pinned version gates it there); (4) DB sessions for revocation.

**Accepted non-security caveat:** Gmail treats `a@gmail.com` / `a+x@gmail.com` / `a.b@gmail.com` as
one inbox but Auth.js matches the literal string → a user mixing aliases could get two 正身. Accept
exact-string match; don't build Gmail-canonicalization.

## 7. Design history — why `rid` (so we don't relitigate)

The email design moved through three shapes; later ones fixed concrete problems in earlier ones:

1. **Dual token** — high-entropy magic-link token *plus* a separate 6-digit OTP in a custom store.
   Rejected: the separate OTP couldn't ride Auth.js's native callback, forcing custom session
   plumbing anyway — complexity with no payoff over option 3.
2. **Single shared 6-digit code as the native `VerificationToken`** — simplest; both link and OTP ride
   Auth.js's native callback (free DB session, no custom plumbing). Rejected on a security/privacy
   concern: a 6-digit token isn't globally unique, so Auth.js *must* put the **email in the URL**, and
   the email-keyed verify endpoint invites targeted brute-force + lockout-DoS.
3. **Opaque `rid` + 6-digit code (this doc)** — `rid` is the unguessable link secret (no email in
   URL, untargetable link, no email-level lock → no lockout-DoS). Costs a custom verify path + DB
   session minting, but that cost is justified by the security/privacy gain. **Chosen.**

## 8. Components (when built)

- `lib/email/` — Resend client + the verification email template (code + `rid` link).
- `lib/auth/email/` — `LoginRequest` issue/verify, throttle/lockout, session minting.
- `app/(auth)/login/` — add the email input + "enter code" affordance.
- `app/(auth)/otp/` — OTP entry (reads `rid` from cookie; user types code).
- `app/login/verify` — magic-link landing (`?rid=…`).
- New Prisma model `LoginRequest` (+ migration). Reconcile with §8's `email_tokens` intent.

## 9. Config / env (when built)

- `RESEND_API_KEY` — already obtained (2026-06-15); wire into Vercel Prod/Preview/Dev + local `.env`.
- `AUTH_EMAIL_FROM` — a from-address on `send.guasi.tw` (e.g. `login@send.guasi.tw`).
- (Non-secret tunables like `otpExpiryMinutes`, `otpMaxAttempts`, send-cap may move to a config file
  later; env is fine to start.)

## 10. Testing (when built)

- Unit: email normalization; `rid` generation/entropy; code hashing; per-`rid` lockout; send-throttle.
- Integration: link login; OTP login (cookie `rid` + typed code); same-email convergence with Google
  (both orders); wrong-code lockout; expired `rid`; attacker-initiates-victim-email brute-force is
  throttled; cross-email Google does **not** merge.
- Manual smoke: real Resend email — click the link **and**, separately, type the code.
