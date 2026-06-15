# 正身 — Routing, ID Provisioning & Platform Author-Resolution

**Status:** design / discussion (v0.3.0-design). Implementation NOT started.
**Date:** 2026-06-15.
**Parent spec:** [`2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — the source of truth for the overall product + architecture. This doc **does not restate** it; it goes deep on three coupled concerns that were getting buried in the parent:

1. **URL & routing structure** — the public surface.
2. **Public ID provisioning & squatting protection** — how a 正身 gets its permanent URL slug, and how KOL handles are protected.
3. **Platform-adapter author-resolution** — the §6.3 gate that decides whether a platform (notably **miin.cc**) can actually verify, which in turn gates what can mint an ID.

These three are causally linked: *the author-resolution capability of a platform gates whether it can prove ownership → proof-of-ownership gates ID provisioning → ID provisioning defines the routing namespace.* Hence one doc.

> **Legend:** **[DECIDED]** locked this session · **[OPEN]** genuine decision still pending · **[REC]** my recommendation on an open point.

---

## 1. URL & routing structure

### 1.1 Route table

| URL | Anonymous | Logged-in (non-owner of profile) | Logged-in (owner of profile) |
|---|---|---|---|
| `/` | Index: search + "create your own" CTA | Same | Same |
| `/gua/` (bare) | Redirect → `/` | Redirect → own profile | Redirect → own profile |
| `/gua/{id}` | Public profile | Public profile | Public profile **+ management tab** |
| `/gua/{id}` (not found) | Generic 404 "user not found" | Same | Same |
| `/register` | Email signup | — | — |
| `/login` | Login page | — | — |
| `/logout` | Logout action | — | — |
| `/api/auth/*` | Auth.js callbacks (owned by Auth.js) | — | — |

> `/tsui/{id}` was considered and **dropped** — merged into `/gua/{id}`.

**Corrections applied vs. the brainstorm tables:**
- The old "Visitor" and "Not Logged In" columns were **redundant** (both = anonymous). Collapsed to three honest states: anonymous / logged-in-non-owner / logged-in-owner.
- "owner vs non-owner" is **meaningless on the bare `/gua/`** (no profile in the URL → every logged-in user is their own owner). The rule there is simply: logged-in → own profile, anonymous → `/`.

### 1.2 Slug location — `/gua/{id}` **[DECIDED]**

The parent spec originally placed the public profile at **root level** (`guasi.tw/{handle}`); this session's tables use **`guasi.tw/gua/{id}`**. They conflicted; resolved below (the parent spec's examples are now updated to `/gua/<handle>`).

| | Root `guasi.tw/{handle}` | Prefixed `guasi.tw/gua/{id}` |
|---|---|---|
| **Verification-post length** (§6.2 — the URL is typed by hand into IG captions, which aren't clickable) | ✅ shortest | ❌ +4 chars on the one string you most want short |
| **Linktree parity** (the profile *is* a Linktree-like page) | ✅ `linktr.ee/alice` shape | ➖ |
| **Namespace collision** with `/login`, `/register`, `/api` | ❌ needs a **reserved-word list** | ✅ isolated under `/gua/` |
| **Brand-in-URL feel** | ➖ | ✅ `gua` reinforces brand |

**[DECIDED] `/gua/{id}`** (the prefixed form). The `/gua/` prefix **isolates the profile namespace** from `/login`, `/register`, `/api`, so **no reserved-word list is needed**, and `gua` reinforces the brand. Accepted cost: the verification-post URL is `guasi.tw/gua/{id}` (~4 chars longer than root), which is typed by hand into IG captions (§6.2) — keep handles short to offset. **This supersedes the parent spec's root-level `guasi.tw/{handle}` examples (lines 126/168/194).** `{id}` is the handle-derived slug (§3).

### 1.3 404 & anti-enumeration **[DECIDED]**

- Generic **"user not found"** for any missing/unprovisioned/released slug — never reveal availability.
- **No register CTA on the 404 page** (prevents ID-enumeration/availability probing). Register CTA lives **only on `/`**.
- Caveat (not a blocker): if IDs are real platform handles, the handles aren't secret anyway — what 404-genericness hides is *who is registered on guasi*, which is still worth hiding.

### 1.4 Internal UUID → permanent redirect **[DECIDED]**

A freshly-registered account lives at an internal, non-indexable `/gua/{uuid}` until first bind. After provisioning, `/gua/{uuid}` issues a **permanent redirect (308)** to the public slug — not a dead link — consistent with the product's append-only / permanence ethos (any link someone already grabbed must survive).

### 1.5 Released-slug tombstone **[OPEN]**

A *sold/released* account (parent spec §unbind releases the uniqueness lock) raises: does its slug 404, or show a "this identity was released" tombstone? Different from a never-existed slug. **[REC]** tombstone for released, generic 404 for never-existed — but low priority; revisit with traction.

---

## 2. ID provisioning lifecycle

### 2.1 Registration → provisioning flow **[DECIDED]**

```
email signup
   → account created at internal /gua/{uuid}  (private, noindex, not public)
   → user prompted to bind first 分身
   → first 分身 verified
   → permanent public slug provisioned, profile goes live
   → /gua/{uuid} 308-redirects to the public slug
```

- Binding can be **completed later** — the user may log out and return; the account persists in a pre-provisioned state.
- **Proof-gated provisioning is the core virtue here:** the public profile only exists *after* a real verification. No empty ghost profiles, and it enforces the product's one principle — *verify while alive* (parent spec).

### 2.2 Abandoned-account cleanup **[OPEN — new gap]**

Accounts that register but never bind sit in limbo. Needs a TTL policy. **[REC]** soft-delete an unbound account after N days (e.g. 30) with an email warning first. Low stakes, easy; just needs a number.

### 2.3 `is_main` 分身 vs the permanent public slug — resolve the overlap **[OPEN]**

There are now **two "primary" concepts** and they must not be conflated:

- **`is_main` 分身** (parent spec, locked): a *changeable* flag picking which bound account is featured atop the profile; defaults to the first verified 分身.
- **Public slug** (this session's proposal): the *permanent, unchangeable* URL identity.

If the slug were literally "the main 分身's handle," then making `is_main` changeable would **break every permalink and every verification post that linked back**. So they must be **separate fields**: the slug is frozen at provisioning; `is_main` stays a free, changeable "which account to feature." The UI must explain why one is frozen and one isn't. With the handle-derived model now locked (§3), the slug **is** a proven handle frozen at provisioning — still a *separate field* from `is_main`, which stays changeable.

---

## 3. The ID model — handle-derived, multi-platform, immutable **[DECIDED]**

**Decision:** the public slug `{id}` is **handle-derived** — it must equal a handle the user has **proven ownership of** — sourced from **any of the three platforms (Threads, IG, miin)** — and is **immutable once set**.

**Rules:**
- **Provenance:** to hold `/gua/alice` you must have verified a 分身 whose handle is `alice` on Threads, IG, *or* miin. The slug is minted from that proof. ✅ **Squatting is structurally impossible** for unique names — you can't claim a name you can't prove (§4).
- **When it's set:** at slug provisioning (first bind, §2.1), behind a **permanent-confirmation warning** — `"Your public ID will be set to {handle} permanently. This cannot be changed."` `[REC]` because immutability is high-stakes, let the user **confirm/choose** at the setup moment rather than silently auto-taking the first handle (see §6 open item).
- **Immutable:** never changeable afterward — so every permalink and every verification post that linked back stays valid forever.
- **Decoupled from the live handle after minting:** if the user later renames or sells the source account, the slug is frozen and **stays** (the proof record captured the binding at the time). The slug stops tracking the live handle — intended.

**Why handle-derived and not guasi-native free-choice:** anti-squatting is the priority. Free-choice naming would let anyone who proves *any* account grab *any* free name, reopening squatting and forcing reactive impersonation takedowns. The accepted costs of handle-derived are **cross-platform same-name collisions** (§4.3) and **slug rigidity** — both bounded.

**Interactions:**
- **Slug ≠ `is_main`** (§2.3): the slug is the frozen handle-derived ID; `is_main` stays a changeable "which account to feature." Distinct fields.
- **Three platforms as sources** heightens the weak-platform-squatting concern — miin is the lowest-authority source (§4.2).

---

## 4. Squatting & collision protection

The user's worry: *when guasi.tw launches, a squatter grabs `guasi.tw/{famous-handle}` before the real KOL.* Resolution below.

### 4.1 Core mechanism — proof-gated claiming (delegate to the platforms) **[DECIDED — basis of the §3 ID model]**

> Don't protect KOL IDs with a list **you** maintain. **Delegate** to the platforms that already authenticated the KOL.

To claim `guasi.tw/taylorswift` you must **prove control of `@taylorswift` on a supported platform** (Threads/IG/miin). A squatter can't; the real owner can, trivially. Threads/IG already solved "who is the real Taylor Swift" — guasi **inherits** that answer for free. **No reserved celebrity database to maintain.** This is the elegant form of the user's first-binding instinct.

### 4.2 Residual hole — weak-platform collision

The real attack isn't "no proof," it's proof via a **low-barrier platform**:

> Real Taylor owns `@taylorswift` on IG, but a random person grabbed `taylorswift` on miin.cc first → binds miin → claims the slug → blocks the real Taylor.

Mitigations, in order of reliance:
1. **Platform priority / challenge:** a slug backed only by a low-authority platform can be **challenged and reassigned** by someone proving the same handle on a higher-authority platform (IG/Threads with their own verification).
2. **Transparency does most of the work:** the public profile shows *all* bound accounts and *which* platforms back the slug. `guasi.tw/taylorswift` backed by **miin.cc only**, no IG/Threads, reads as suspicious on its face. The append-only proof ledger (parent §6.6) makes this visible by design.
3. **Optional pre-launch reserved list:** hold a *small* set of ultra-high-value names for manual review at launch. With 1+2, needed for very few names — not a maintained database.

> **Note:** **all three platforms are live handle sources at MVP launch** (§5.1), including **miin — the lowest-authority source**. So this hole is present **from day one**: a squatter could register a KOL's handle on miin and claim the slug. **MVP minimum:** ship the transparency mitigation (#2 — the public page shows which platform backs the slug). The challenge/priority mechanism (#1) should follow close behind.

### 4.3 Genuine same-name collision (the honest edge case)

Two *different real people* each legitimately own "alice" on different platforms and both want `/gua/alice`. **Unavoidable** when handles are only unique per-platform. **[DECIDED] first-claim-wins** on the slug string. Because the slug must equal a handle you proved (§3), the loser can't take `/gua/alice` — they instead **claim a slug from another handle they can prove** (multi-platform sourcing helps; they likely own a distinct handle elsewhere) or accept a **disambiguated variant** (`/gua/alice-ig`, `/gua/alice2`). `[open]` the exact disambiguation rule (§6). Only bites *common* names — unique KOL names have one owner across platforms and are fully protected by §4.1–4.2.

### 4.4 "Popular IDs require binding proof" is redundant — note

Under §2.1, **every** slug already requires binding proof (it's provisioned only on first bind). So there's no unprotected path to harden. The only *extra* mechanism worth having is the §4.2.3 pre-launch reserved list — different thing, named explicitly so it isn't conflated with "all IDs need proof."

---

## 5. Platform-adapter author-resolution (§6.3 gate)

A platform can be a verification adapter only if guasi can **resolve a post/profile's author from platform authority** (the platform's own SSR / API / canonical URL) — **never** from user-supplied content (§6.3).

> **The full, empirically-verified read mechanics for all three platforms** — post & bio methods, copy-paste recipes, the URL-handle spoof proof, Vercel render weights, and the evidence log — **now live in their own doc: [`../../platform-verification.md`](../../platform-verification.md).** That doc is the source of truth and **supersedes** the platform mechanics previously detailed in this section. What's kept here is the bottom line + the miin scope decision.

**Bottom line (verified 2026-06-15):**
- **Threads** — crawler-UA SSR of the canonical URL gives author (`og:title`) + content (`og:description`), **tokenless**; both post & bio.
- **Instagram** — same crawler-UA SSR: **post** author + caption tokenless (retry-on-miss); **bio** text is *not* in the OG tags → needs a Meta token or headless. **Use the post method on IG.**
- **miin.cc** — the page is an empty SPA shell, **but** a **public, unauthenticated JSON API** (`api.miin.cc/web/story/v3/story?storyId=…`, `…/web/v2/user/page?userId=…`) returns author + full untruncated text (post) and bio — the **lightest** path of the three, no browser. Headless render is a proven fallback.
- **Author authority [proven]:** never trust the handle in the pasted URL — the platform serves a post under *any* path handle (HTTP 200) but canonicalizes to the **true author** (spoof test: verification doc §4). Read the author from the authoritative response/field only.

### 5.1 miin.cc scope — **in MVP via its public API [DECIDED]**

**[DECIDED] MVP platforms = Threads + IG + miin.cc.** miin is verified via its **public, unauthenticated JSON API** ([`../../platform-verification.md`](../../platform-verification.md) §3.3) — a pure `fetch()`, the **lightest** of the three (no crawler-UA scraping, no browser). The earlier deferral was premised on miin having no author-resolution path; that premise is now false.

What remains:
- `[gotcha]` **Risk:** the API is **unofficial** — could add auth, rate-limit, or change shape without notice. Monitor it.
- **De-risk:** still pitch miin's team for an **official endpoint/blessing** — now from "we already integrate, please bless it" rather than "please build us something."
- **Fallback if locked down:** **headless render** (proven to extract author + content + bio), reusing the §12 screenshot infra.
- **Bio on miin:** works via the API (`user/page.intro`) but needs a **username→userId resolver** (unresolved — verification doc §7). The post method needs no lookup.

**Consequence:** all three platforms are **live handle sources at launch**, so the weak-platform-squatting mitigation (§4.2) must ship **with MVP**, not later.

**Keep the `PlatformAdapter` interface honest** so each platform's read shape (Meta crawler-SSR, miin JSON API, headless) slots in without rework.

---

## 6. Consolidated open questions

- [x] **Slug location:** → **`/gua/{id}`** decided (§1.2).
- [x] **ID model:** → **handle-derived, 3-platform, immutable** decided (§3).
- [ ] **Disambiguation rule** for same-handle cross-platform collisions: suffix vs platform-qualified vs free-choice-among-proven-handles (§4.3).
- [ ] **Slug setup UX:** auto-take the first handle vs let the user confirm/choose among proven handles at the (immutable) setup moment (§3).
- [ ] **Abandoned-account TTL:** pick N days (§2.2).
- [ ] **Released-slug behavior:** tombstone vs 404 (§1.5).
- [ ] **Weak-platform squatting (now an MVP concern):** ship the transparency mitigation with MVP; define the platform-priority/challenge mechanism (§4.2) — miin is a **live** low-authority source at launch.
- [x] **miin.cc MVP-or-not:** → **in MVP** via its public API (§5.1). Follow-ups: monitor the unofficial API / pursue an official blessing; resolve the **username→userId** lookup for the bio method (verification doc §7).

## 7. Cross-references to the parent spec

- §6.2 binding flow / verification-post growth engine · §6.3 author integrity · §6.4 proof snapshot + archive · §6.6 append-only ledger · §6.8 status management · line 491 bio-link complementary method · §12 stack (Vercel/Neon/headless screenshot API).
