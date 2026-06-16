# 正身 — MVP Wireframes & Page Flows

**Status:** design / discussion (v0.7.0-design). Implementation NOT started.
**Date:** 2026-06-16.
**Parent specs:**
- [`2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — product + architecture source of truth (esp. §6 flows).
- [`2026-06-15-routing-and-identity-design.md`](2026-06-15-routing-and-identity-design.md) — URL routing, slug provisioning, squatting protection.
- [`../../platform-verification.md`](../../platform-verification.md) — empirical platform read-mechanics.

This doc specifies the **page-level wireframes and flows** for the MVP UI. It does not restate the
parent specs; it resolves several of their open UX questions and records two decisions that **change**
prior locked decisions (§A). Mockups produced during brainstorming live under
`.superpowers/brainstorm/` (gitignored).

> **Legend:** **[DECIDED]** locked this session · **[OPEN]** still pending · **[REC]** my recommendation.

---

## A. Decisions that change / resolve prior specs

1. **[DECIDED] Proof snapshots are DROPPED from the MVP.** Instead of capturing a self-contained
   snapshot (content + screenshot + third-party archive), the MVP **links to the live verification
   post URL**. A dead link (banned/deleted post) is **acceptable for MVP**.
   - This **reverses** the parent spec §6.4 + the CLAUDE.md "Proof snapshot" locked decision (which
     existed precisely because a banned account's post vanishes when proof matters most).
   - **Kept additive:** the data model retains room for snapshots so Phase 2 can add them without
     migration pain (`proof_records` stays, snapshot columns simply unused/nullable in MVP).
   - **Consequence for UX:** "view proof" becomes **"查看貼文 ↗"** pointing at the live URL. Credibility
     now depends on the user *keeping the post live* — surfaced as copy in the flow (§D, §E).

2. **[DECIDED] Slug provisioning = a deliberate "set 主要帳號" action, not silent on first bind.**
   Binding an account proves ownership; **minting the public URL is separate.** The slug is minted when
   the user designates their **主要帳號 (main account)** and confirms the permanent URL. This resolves
   the routing-spec open questions on slug-setup UX (§3/§6: "auto-take vs confirm/choose") → **confirm/
   choose with an explicit permanence gate.** It also operationalizes §2.3 (slug vs `is_main`): the
   main-account designation is *what triggers* slug minting; the slug is then frozen, `is_main` stays
   changeable.

3. **[DECIDED] English page names** (for routes/code; UI text stays 繁中):

   | Chinese (UI) | English (page) | Route |
   |---|---|---|
   | Home | **Home** | `/` (search box = placeholder; feature deferred — §C) |
   | 建立正身 | **Create Identity** | onboarding after Google login |
   | 註冊分身 | **Add Account** | `/add/{platform}` (per-platform) |
   | 驗明正身 | **Identity Card** | `/gua/{slug}` |
   | 分身管理 | **Manage** | owner tab on `/gua/{slug}` |

4. **[DECIDED] MVP slug sources = Instagram + Threads only.** A slug may be minted **only** from a
   handle proven on **IG or Threads**. **miin.cc remains a full verification/binding platform** (you can
   bind a miin 分身 and show it on your profile) but is **NOT slug-eligible in MVP** — whether to allow
   miin as a slug source is **deferred** (decide later).
   - **Why:** avoid letting a **low-authority platform mint a permanent public ID** — this *closes* the
     weak-platform-squatting vector (routing-spec §4.2) for MVP rather than merely mitigating it, and
     narrows the §5.1 "all three platforms are live handle sources at launch" claim.
   - **Consequence:** a user whose only verified 分身 is on miin **stays pre-provisioned** (no public
     URL) until they verify an IG or Threads account to mint the slug (§D.5).

5. **[DECIDED] No self-service unbinding in MVP.** Users **cannot 解除綁定** their own bindings. Once a
   binding is committed it is **permanent**; the only owner-initiated state changes are the
   trust-*lowering* condition flags (回報遭盜用 / 回報已被停權, §6.8) and the trust-restoring **恢復 ·
   重新驗證**. This narrows parent **§6.5** (which allowed self-service unbind with 不需要/已售出/其他).
   - **Why it's safe / coherent:** matches the append-only, permanent ethos — you can warn on an account
     but not silently disavow it; the **§D.3 wrong-account discard** (pre-commit) is the back-out for
     mistakes, so nothing forces a post-commit removal.
   - **Consequence — deferred:** the parent §6.5 **unbind action** is **deferred to Phase 2** (or
     admin-side — not self-service). An `unbound` ledger event type may still exist in the model for that
     future/admin path, but **no MVP UI creates it**. (The "已售出 → release the uniqueness lock" part of
     §6.5 is now **moot** — there is no uniqueness lock, §A.6 — so a new owner can bind the account
     independently without anything being released.)

6. **[DECIDED] No binding uniqueness lock.** The same platform account `(platform, account_id)` may be
   bound by **more than one 正身 at the same time**, provided **each independently proves ownership** (its
   own verification post + author resolution). This **removes parent §8's** "only one current verified
   binding per `(platform, account_id)`" rule.
   - **Uniqueness becomes per-正身:** unique on **`(user_id, platform, account_id)`** (a 正身 can't
     double-bind the same account), **not** globally on `(platform, account_id)`.
   - **Why:** ownership can legitimately be shared or transferred; the proof attests "controlled this
     account at verification time," and the **timeline/recency** (§6.7) lets viewers judge competing
     claims. A new owner can bind a transferred account with no lock to clear.
   - **[note] Accepted trade-off:** combined with §A.5 (no unbind), a transferred account can linger on
     the seller's profile (a stale claim) while the new owner also binds it. Viewers disambiguate by
     **驗證時間** (newer = current owner). A "已售出 / 不再擁有" disposition for the seller is **deferred**
     with the rest of the unbind flow (§A.5).

---

## B. Global design principles

- **[DECIDED] Mobile-first, responsive to desktop.** Mobile is the **primary** experience; desktop is
  the same layout, centered and widened. Design and review at phone width first.
- **Language:** all UI strings in **Traditional Chinese (zh-Hant, Taiwan vocab)**; English only for
  page/route names in code and user-supplied data rendered verbatim.
- **Auth:** Google login is already shipped/live; these pages assume an authenticated 正身 where noted.
- **[DECIDED] Untrusted input — sanitize on input, escape on output, keep it small.** The profile fields
  (`display_name`, `bio`, `avatar`) **and** platform-supplied strings (resolved handle / display name)
  are all untrusted and render on the **public** 驗明正身 page — a stored-XSS surface.
  - **Text fields are plain text only** — strip/reject HTML, scripts, and control chars; store plain;
    **always HTML-escape on render.** (The CLAUDE.md "render verbatim" exception means *don't translate*
    the text — **not** skip escaping.)
  - **Length-capped** and **avatars re-encoded** — limits in §D.1.
  - Threats addressed: stored XSS, oversized/malicious payloads. (Parent §9 threats.)

---

## C. Page: Home (`/`)

Public landing. Minimal.

- Brand lockup: **我是 · guasi**, tagline **我是正身 — 驗證並串連你擁有的帳號**.
- **Search box** — kept as a **visual placeholder** in its current position/design (see §C note).
- **「建立你的正身」 CTA** + **登入** link.
- Register CTA lives **only here** (routing-spec §1.3 anti-enumeration; no register CTA on 404s).
- **[OPEN]** whether to add featured/example profiles on the landing for social proof. **[REC]** defer;
  keep minimal for MVP.

> **[DECIDED] Search box stays on Home as a non-functional placeholder; the search *feature* is
> DEFERRED.** The box is part of the MVP visual design — keep its placement and styling — but it is
> **inert** (blank with placeholder text, e.g. disabled / no results). The actual search behavior
> (what's queryable — by account/URL/name — ranking, results UI) needs more discussion and gets its
> **own brainstorm → spec → plan cycle**. Lookup-by-direct-URL (`/gua/{slug}`) works regardless.
>
> **Motivating use-case to carry into the search design:** because the same platform account can be
> bound by multiple 正身 (no uniqueness lock, §A.6), searching a handle (e.g. `@sansword` on Threads)
> should surface **all** claims and let the viewer judge via each one's **timeline + condition** — e.g.
> "this account was **hacked**, and is now bound to a **different user**." `updated_at` (§H.2) supports
> recency ranking here. (Design later; recorded so the data model is search-ready now.)

---

## D. Flow: Create Identity (建立正身) → Add Account (註冊分身) → provisioning

### D.1 Onboarding (after Google login)
- Set **avatar + 顯示名稱 (display_name) + 一句話簡介 (bio)** — all **plain-text / script-free and
  length-capped** (the §B input-safety rule). **[DECIDED]** constraints (limits tunable; the point is
  *small + safe*):
  - **display_name:** plain text, trimmed; no HTML/markup/control chars; **max ~50 chars**; non-empty.
  - **bio:** plain text (line breaks allowed but HTML-escaped); no markup/scripts; **max ~160 chars**;
    optional.
  - **avatar:** image upload validated by **MIME type — JPEG/PNG/WebP only, reject SVG** (SVG can carry
    scripts); **max ~2 MB**; **re-encoded + resized server-side** (strips EXIF / any embedded payload,
    normalizes dimensions) before storing in Blob. A safe default avatar if none uploaded.
  - These fields are editable later on **Manage** (§E.3) under the same validation.
- **Expectation-setting copy (shown before binding):** "接下來你會驗證**主要帳號**，它的帳號名稱會成為你的
  **永久公開網址** `guasi.tw/gua/…` — **之後無法更改**。"
- CTA: **「下一步：驗證主要帳號 →」** (wording is **主要帳號**, not "第一個分身").
- **The main-account verification offers IG/Threads only** (the slug source must be IG/Threads — §A.4).
  Binding a miin 分身 is a secondary action available later from Manage, not part of minting the slug.

### D.2 Add Account — per-platform wizard
- **[DECIDED] Pick platform → redirect to a platform-specific page** (`/add/instagram`,
  `/add/threads`, `/add/miin`). Each carries its **own instructions** and a **"how to get your post
  URL" guide** tailored to that app.
- The §6.2 mechanics are unchanged: copy a template (the **6-digit code + per-platform service tag +
  the user's profile URL + a line of copy**, §D.2.1) → post publicly → paste the post URL back → verify
  (author resolved from platform authority becomes the bound 分身).
- **[DECIDED] No pre-declared handle.** The optional "pre-declare the handle you're about to verify"
  field from parent §6.2 is **removed** — there is no handle input in the wizard. The handle is
  **resolved from the post author** after the user pastes the URL, and **shown at the confirm/success
  step** ("✓ @resolved_handle 已綁定"). This simplifies Step 1 (platform pick only) and relies wholly on
  platform-authority author resolution (which was always the real security gate, §6.3).
- **[DECIDED] Validate the pasted post URL against the SELECTED platform — a security gate (§6.3), not
  just UX.** Before any fetch, require a **canonical URL for the chosen platform**: the `PlatformAdapter`
  declares the accepted pattern(s) and parses out **platform + post-id** (e.g. IG `instagram.com/p/{id}`
  or `/reel/{id}`; Threads `threads.net/@{handle}/post/{id}`; miin its canonical story URL). **Reject**
  wrong-platform domains, look-alike/non-canonical hosts, non-HTTPS, and arbitrary redirects — the author
  must be read from the **real platform domain**, never a user-controlled page (parent §6.3 spoof
  defense; the author-match is only as trustworthy as *who told us the author*). On mismatch show a clear
  error, e.g. "這不是有效的 Instagram 貼文網址".

- **[DECIDED] Publish affordance differs per platform** — the `PlatformAdapter` declares whether it has
  a prefilled compose intent:
  - **Threads:** one-click **「在 Threads 發佈」** (web compose intent `threads.net/intent/post?text=…`,
    deep-links to the app on mobile) + copy fallback.
  - **Instagram:** **copy-to-clipboard + "打開 Instagram"** only. IG cannot prefill a feed-post caption
    and requires an attached image — manual post. IG-specific notes: image required, caption links are
    not clickable (also encourage putting the URL in the bio link).
  - **miin.cc:** copy-paste (no known compose intent; revisit).
  - **[note]** these platform capabilities should be **confirmed empirically** (per
    `platform-verification.md`) before implementation relies on them — esp. the Threads intent URL.

- **[DECIDED] Credibility hint in the wizard (before posting):** "💡 這則貼文就是你的**公開證明**…
  保留它能讓你的正身更可信 — 任何人都能點進去親自查證。" Motivates a good public post (growth loop).

#### D.2.1 Verification-post template (the growth engine)

**[DECIDED]** The copy-able template doubles as guasi promotion (parent §6.2). Shape:

```
#guasi

{service_tag}
我是分身認證貼文

點此觀看此帳號的正身：
{profile_url}

我是分身驗證碼：{DIGITS}
```

- **[DECIDED] `#guasi` leading hashtag** — a real, clickable hashtag for discovery/growth (works on
  Threads/IG). Distinct from the code (below), which is plain labeled text.
- **[DECIDED] `service_tag` is per-platform.** The official guasi handle differs by platform, so the
  **`PlatformAdapter` declares the tag** for its platform rather than one hardcoded string. It's a
  growth/discoverability tag, **not** a security check (parent §6.2).
- **[DECIDED] `profile_url` — first post vs later posts (a short-URL design):**
  - **First (provisioning) post:** the slug doesn't exist yet (derived from the not-yet-resolved author),
    so use a **short redirect link `guasi.tw/r/{ref}`** — a short opaque token minted at account creation
    that **308-redirects to `/gua/{slug}` once provisioned**. The link in that post stays valid forever.
  - **[DECIDED] Short links live in their OWN path (`/r/{ref}`), separate from `/gua/{slug}`**, so refs
    and handle-derived slugs **cannot collide** (see §H.2). This *refines* routing §1.4 (which put the
    redirect in the `/gua/` namespace via a UUID) — a separate short path keeps the URL short **and**
    collision-free.
    - **Caveat:** until provisioned, `/r/{ref}` is the owner's pre-provisioned page (access-controlled)
      and a **generic 404 to non-owners** (§D.5/§1.3) — so if the user posts but then chooses *keep-as-分身*
      or cancels (no slug minted), the first post's link 404s for visitors until they later provision. On
      the happy path provisioning completes seconds later, so the window is negligible.
  - **Later posts** (slug already exists): use the clean **`guasi.tw/gua/{slug}`** directly.
- **[DECIDED] Code format `我是分身驗證碼：{DIGITS}`** — the Chinese label **namespaces the 6-digit code**
  so the verifier matches `我是分身驗證碼：` + digits and never false-matches an arbitrary 6-digit number
  elsewhere in the post. (Since users copy the template verbatim, the label is reliably present.)

### D.3 Success page (after verification)
Shown in order:
1. **Resolved-account confirmation** — "✓ @{resolved_handle} · 作者由平台確認 · {date}", presented as
   **verified and pending your confirmation** (the durable binding is *not* committed yet — it's written
   only at the flow's terminal confirm, per §H). Because there's no pre-declared handle (§D.2), **this is
   the first time the user sees which account was resolved** — so it must be confirmable/undoable.
2. **[DECIDED] Wrong-account escape = discard the pending request.** A secondary action
   **「這不是我要綁的帳號 · 取消」** abandons the resolved `binding_request` (→ `cancelled`). Per
   commit-on-confirm (§H), **nothing durable was written yet — there is no `linked_account` to delete**;
   the request is simply discarded. (Distinct from §D.4's *keep-as-分身*, which **commits** a non-main
   binding, and from §D.4's *取消*, which likewise commits nothing.) Rationale: a mis-resolved account is
   a genuine mistake, not an account the user wants.
3. **[DECIDED] Deletion guidance** (about the *post*, not the binding): "你可以隨時刪除那則貼文，**綁定不會
   因此解除**。但保留它能讓你的證明**可被點開查證**，正身更可信。" (Reassure + warn; the "can I delete the
   post now?" question only arises post-verification.)
4. **Visibility choice — [DECIDED] default 私密.** Options: **私密（預設）** / **公開**. The 公開 option
   carries a permanent warning: "⚠ 一旦公開將**永久顯示，無法改回私密**。" (Matches §6.6 public=permanent.)
   - **Provisioning-bind override:** if this same flow proceeds to make the account the 主要帳號 (§D.4
     confirm-as-slug), this choice is **overridden to 公開** (the main 分身 can't be private). Record the
     choice, but expect it to be forced public for a provisioning bind.

### D.4 Slug provisioning (main-account confirm)
- Triggered when the user designates their **主要帳號** (during onboarding's first bind, or later from
  the pre-provisioned state — §D.5).
- **[DECIDED] Only IG/Threads handles are eligible** as the slug source (§A.4). A miin-only user can't
  reach this step until they verify an IG or Threads account.
- **[DECIDED] Check slug availability BEFORE offering it.** When suggesting the handle as the slug,
  first check `users.slug` for a case-insensitive collision (§4.3 first-claim-wins):
  - **Available** → show the confirm screen below.
  - **Taken** → don't offer it. **[DECIDED] No synthetic/disambiguated variant** (`{handle}-ig`,
    `{handle}2`, …) is offered — a made-up name is **not a handle the user proved**, so minting it would
    break the handle-derived anti-squatting invariant (§3) — *every slug is exactly a proven handle,
    never a guasi-synthesized string.* Instead, surface "guasi.tw/gua/{handle} 已被使用" and the **only
    two honest paths**:
    1. **Keep this account as a 分身** — the binding is still valid (proof of ownership stands); it just
       can't be the slug source. (= the §D.4 *keep-as-分身* action.)
    2. **Verify another account — ideally on another platform — whose handle is free**, and use *that*
       as the 主要帳號/slug source. Until then the 正身 stays **pre-provisioned** (§D.5).
    The binding itself is unaffected; only this *slug string* is unavailable (first-claim-wins, §4.3).
    (The kept account stays bound permanently — there's no self-service unbind, §A.5.)
  - **Race guard:** the pre-check is for UX only. The real guarantee is the **`users.slug` unique index**
    (§H.2) at commit — if two users confirm the same slug concurrently, the second commit hits a
    unique-violation and is handled gracefully (re-surface the "taken" state), so first-claim-wins holds.
- **Confirm screen:** shows the resolved handle → the resulting URL (`guasi.tw/gua/alice`), a permanent
  warning (**"此網址永久固定，無法更改。"** — permanence only; **do not** mention renaming or selling), an
  **"我了解此網址無法更改"** checkbox gate, and **[DECIDED] three explicit actions**:
  1. **「確認，建立正身頁」** (primary) — use this handle as the permanent public URL. **Commits the
     binding as the main 分身 + mints the slug + provisions the page.** **[DECIDED] This forces the
     account to 公開 (and `is_main`)** regardless of the §D.3 visibility choice — the main 分身 is the
     public face of the 正身, so it cannot be private. Being public, it follows public-permanence (§6.6:
     can't be hidden again). (For a provisioning bind, the §D.3 visibility toggle is therefore moot.)
  2. **「保留為分身，綁定其他帳號作為主要帳號」** (secondary) — **keep this verified account as a
     (non-main) 分身** (per the §D.3 visibility choice — default 私密), then go bind/choose a *different*
     account as the 主要帳號. **Commits this binding (non-main, permanent — no self-service unbind, §A.5);
     the 正身 stays pre-provisioned** (no slug yet, §D.5) until a main is set.
  3. **「取消」** (tertiary — a *real* cancel) — **abort and do NOT add this binding at all**: discard the
     pending request, nothing is committed (same disposition as the §D.3 wrong-account discard).
- **[DECIDED] The three differ by what they commit** — confirm-as-slug → commit as **main** + provision;
  keep-as-分身 → commit as a **non-main 分身**, stay pre-provisioned; cancel → **commit nothing**. This
  replaces the earlier single "取消，改綁其他帳號", whose wording wrongly implied discarding when it
  actually kept the binding. "Keep" and "cancel" are now separate, explicitly-labeled paths.

### D.5 Pre-provisioned owner state (verified 分身 but no public URL)
Reached when the user has verified accounts but cancelled / not yet set a 主要帳號.
- **No public slug exists** → there is **no public URL** to visit or guess; the account lives only at
  the access-controlled short path `/r/{short_ref}`, reachable by the **logged-in owner**. (The
  routing-spec §1.3 generic-404 applies only to *public* slugs that are released/never-existed — not
  this state.)
- **Owner's own view shows:**
  - A **"🔒 你的正身頁尚未公開（只有你看得到）"** banner.
  - A **gray "主要帳號 · 尚未設定"** slot with CTA **「設定主要帳號並開通公開網址 →」**.
  - Already-verified 分身 listed below as **private**.
- **Setup picker** (what the CTA opens): pick an existing **IG/Threads** verified account **or** **「＋
  驗證另一個帳號當主要帳號」** → then the §D.4 permanent slug-confirm. **miin 分身 are shown but not
  selectable as 主要帳號** (§A.4), with a short note that miin can't yet be used to open the public URL.

---

## E. Page: Identity Card (驗明正身) — `/gua/{slug}`

The public, Linktree-like profile for a *provisioned* identity. Three tabs: **帳號 / 時間軸 / 管理**
(管理 owner-only). Visitors see 帳號 + 時間軸; owner additionally sees 管理.

### E.1 帳號 / Accounts tab (default — the Linktree)
- **Identity header:** avatar, 顯示名稱, the slug (`guasi.tw/gua/alice`), bio, and a verified badge
  ("✓ 已驗明正身 · N 個分身").
- **[DECIDED] Main 分身 featured separately** — boxed/highlighted on top, marked **★ 主要**.
- **Other bound accounts** as Linktree-style rows below.
- **[DECIDED] Row tap → opens the live platform profile** (↗). Pure Linktree behavior; proof lives in
  the Timeline tab. Each row shows platform, handle, and **驗證於 {date}** (older = more credible, §6.7).
- **Hacked/banned accounts stay visible as rows** (still claimed/bound) with a warning and no click-out
  ("⚠ 已回報遭盜用 · 此帳號已非本人") — the anti-impersonation warning must remain public.
- **Unbound accounts** (a deferred/admin-only case in MVP — self-service unbind is gone, §A.5) are **not
  active rows here**, but nothing is hidden or deleted — any bound→unbound history stays permanent in the
  **Timeline** (§E.2). (Contrast banned/hacked, which *remain* as rows above.)
- **Private accounts are not shown** to visitors.
- **Growth footer:** "建立你的正身 →" (the §6.2 acquisition loop).

### E.2 時間軸 / Timeline tab
- The append-only ledger (§6.6/§6.7), **[DECIDED] newest-first**.
- Events (MVP, user-initiated): 建立正身 → 綁定 (each platform) → status changes (回報遭盜用/停權) →
  恢復(重新驗證). **解除綁定 is NOT a user action in MVP** (§A.5) — so it normally won't appear; if an
  `unbound` event ever exists (future/admin path), the timeline still renders it (append-only).
- **[DECIDED] Nothing is ever deleted (parent §6.6).** All events are append-only; the `linked_accounts`
  row is a current-state projection that is **updated, never deleted**. Even the deferred unbind (§A.5)
  would only *add* an `unbound` event + flip `status`, never remove the row or its history.
- **[DECIDED] Condition flags ≠ removal.** **banned/hacked** (§6.8) keep the account **claimed and
  visible** with a trust-lowering warning — they do not release the claim. (This is now the *only*
  trust-lowering action a user has, since self-service unbind is gone — §A.5.)
- **[DECIDED] Proof lives here:** each `bound` / `re_verified` event shows **「查看貼文 ↗」** → the live
  post URL (no snapshot, per §A.1).
- **Status events shown inline**, labeled **owner-reported** vs **re-verified** so viewers can weigh
  them (§6.8).

### E.3 管理 / Manage tab (owner-only)
- **Profile edit** (name / avatar / bio) at the top.
- **「＋ 註冊分身」** CTA (→ Add Account flow).
- **Per-account rows showing ALL bindings (incl. private):**
  - **Public rows:** "🔒 已公開（永久）" — cannot be hidden again.
  - **Private rows:** dashed/tinted, "👁 私密", with a one-way **「公開 →」** disclose button carrying
    the warning "公開後將永久顯示在你的正身頁，無法再次隱藏。" **[DECIDED] disclosure is one-way.**
  - **Set-as-main:** per-row **★ 設為主要分身** action; current main shows "已是主要分身". (Changing main
    does **not** change the slug — §A.2.) **[DECIDED] Setting an account as main forces it 公開** (the
    main 分身 is the public face — same rule as §D.4); if it was private, promoting it to main discloses
    it permanently (§6.6). The previous main stays public (permanence) but is no longer featured.
    - **[DECIDED] Promoting a *private* account to main fires the same permanent-disclosure confirmation
      as the 公開 → button** ("公開後將永久顯示在你的正身頁，無法再次隱藏。") before it takes effect.
      Promoting an already-public account needs no extra confirm.
  - **Status actions (inline pills):** **回報遭盜用 / 回報已被停權** are one-click self-service (lower
    trust only, §6.8).
  - **[DECIDED] A flagged (banned/hacked) row swaps its pills for 「恢復 · 重新驗證 →」**, which re-enters
    the Add Account flow and writes a fresh `re_verified` event (trust-restoring requires re-proof).
  - **[DECIDED] No 解除綁定 (unbind) action** on these rows (§A.5) — bindings are permanent in MVP. The
    only owner controls are: disclose (private→public, one-way), set-as-main, condition flags
    (banned/hacked), and 恢復·重新驗證. (The parent §6.5 unbind/sold flow is deferred — §A.5.)

---

## F. Open questions (carried forward)

- ~~**Disambiguation rule** for same-handle slug collisions~~ — **[RESOLVED] no disambiguation/synthetic
  variants** (§D.4). A slug is always exactly a proven handle; if it's taken, the loser keeps the account
  as a 分身 and mints a slug from another proven handle (routing-spec §4.3's "disambiguated variant"
  option is **dropped** as it would violate the handle-derived invariant, §3).
- **Weak-platform squatting** — **closed for MVP** by restricting slug sources to IG/Threads (§A.4);
  miin can't mint a slug, so the routing-spec §4.2 vector doesn't apply at launch. Re-opens **only if/
  when miin becomes slug-eligible** — at which point the transparency mitigation (show which platform
  backs the slug) and/or a challenge mechanism must ship alongside.
- **Abandoned-account TTL** (routing-spec §2.2) — unchanged, still needs a number.
- **Released-slug tombstone vs 404** (routing-spec §1.5) — unchanged.
- **Featured/example profiles on Home** (§C) — deferred.
- **Empirical confirmation** of the Threads compose intent + IG/miin publish affordances before build.

---

## G. Surface inventory (what to build)

| # | Surface | Route | Auth | Notes |
|---|---|---|---|---|
| 1 | Home | `/` | public | brand + create CTA + login; search box is a non-functional placeholder (§C) |
| 2 | Create Identity (onboarding) | post-login | owner | avatar/name/bio + slug expectation copy |
| 3 | Add Account wizard | `/add/{platform}` | owner | per-platform; publish affordance varies |
| 4 | Success / visibility | (in flow) | owner | bound account + delete guidance + visibility |
| 5 | Slug confirm | (in flow) | owner | permanent gate + cancel-keeps-binding |
| 6 | Pre-provisioned owner view | `/r/{short_ref}` | owner | gray main-account slot + setup picker |
| 7 | Identity Card — Accounts | `/gua/{slug}` | public | Linktree; main featured; rows → live profile |
| 8 | Identity Card — Timeline | `/gua/{slug}` | public | append-only, newest-first; 查看貼文 ↗ |
| 9 | Identity Card — Manage | `/gua/{slug}` | owner | disclose (one-way), status, set-main, re-verify |

---

## H. Binding-request lifecycle & data-model delta

The no-pre-declared-handle (§D.2) and wrong-account-delete (§D.3) decisions require **commit-on-confirm**
rather than the parent spec's commit-on-resolution (§6.2 step 6). The `binding_requests` row holds all
pending state — including the **6-digit code** — and the durable artifacts (`linked_account`, proof
record, ledger `bound` event, and — for a provisioning bind — the slug) are written **only at the flow's
terminal confirm action**:
- **Ordinary bind** (slug already exists): commit at the **§D.3 success confirm**.
- **Provisioning bind** (designating the 主要帳號): commit at the **§D.4 slug-confirm** — either
  *confirm-as-slug* (commit as main + mint slug) or *keep-as-分身* (commit non-main, no slug).
- A **real cancel** (§D.3 wrong-account or §D.4 取消) commits **nothing**.

### H.1 State machine

| State | Meaning | Durable artifacts? |
|---|---|---|
| `pending` | request created, code issued, awaiting post + URL paste-back | none |
| `resolved` | code matched + author resolved from platform authority; awaiting user confirm | none (resolved author stored on the request only) |
| `verified` | user **committed** the binding → `linked_account` + proof record + `bound` ledger event; `consumed_at` set. Slug is minted **only** if they chose "confirm-as-slug" (main); "keep-as-分身" commits a **non-main** binding with **no slug** (stays pre-provisioned) | yes |
| `cancelled` | user hit a **real cancel** — "wrong account → 取消並刪除綁定" (§D.3) *or* the slug-confirm "取消" (§D.4) — request discarded | none (nothing to reverse) |
| `expired` | TTL passed with no confirm/cancel | none |

- **Synchronous verification is unchanged** — the code+author check still runs in seconds on paste-back;
  only the *commit* is one click later (the confirm). Security still rests on author-match + scope +
  expiry (§6.3), not on the commit timing.
- **Exit without confirm or cancel** (the asked case): the row stays `pending`/`resolved`; **no
  `linked_account`, no ledger event, no slug**. It flips to `expired` at `expires_at` (lazily on next
  touch or via the abandoned-cleanup job, routing-spec §2.2). The code is never `consumed` and is useless
  after expiry. The user can start a fresh request (new code) anytime.
- `cancelled`/`expired` rows are retained briefly for audit, then purged by the cleanup job.

### H.2 Data-model deltas vs parent §8

**`users` (正身) — add the slug.** Parent §8 has no slug column (it predates the routing spec); the
public URL has nowhere to live. Add **`users.slug`**:
- **unique + indexed** — `/gua/{slug}` is the hottest read path on the site, so the slug must back a
  unique index (the index *is* the lookup index). Because slug uniqueness/lookup is **case-insensitive**
  (§A.2), index the case-folded form — either a **`citext` column** or a **unique index on
  `lower(slug)`** (Prisma: a `citext` field with `@unique`, or a raw-migration functional unique index)
  — so the visit query hits the index, not a sequential scan.
- **nullable** while pre-provisioned (§D.5); **set once** at main-account designation (§A.2/§D.4) and
  **immutable** thereafter (enforced in app logic).
- A **frozen string** copy of the proven handle — **not** an FK to a `linked_account`, so changing
  `is_main`, renaming, or selling the source account never alters it (§2.3).
- Public URL = `guasi.tw/gua/` + `slug`. We store the slug, not the full URL.

**`users.short_ref` — short opaque redirect token at its OWN path (refines routing §1.4).** A **short,
opaque, non-enumerable** token (e.g. base62, not a sequential int) served at the dedicated short path
**`guasi.tw/r/{short_ref}`** and embedded in the **first verification post** (§D.2.1). Once the slug is
minted, `/r/{short_ref}` **308-redirects** to `/gua/{slug}`; before that it's the owner's pre-provisioned
page (404 to non-owners). **Permanent and immutable**, so links grabbed pre-provisioning survive forever.
- **[DECIDED] Created with the account, NOT NULL from the start.** `short_ref` is generated **when the
  `users` row is created** — i.e. in the existing **Auth.js adapter `createUser` wrapper** (the
  already-shipped Google-login path that seeds the 正身), with a unique-index + retry on the rare clash.
  Every 正身 therefore has a working `/r/{short_ref}` from the moment it exists — before any binding —
  which is exactly why the first verification post can carry it. Contrast `slug`, which is **nullable**
  until provisioning.
- **Why a separate `/r/` path (the collision answer):** slugs are **handle-derived**, so a short token
  in the `/gua/{…}` namespace could collide with a handle someone later proves — blocking a legitimate
  owner from minting their slug. Putting short tokens under their **own path** makes refs and slugs
  **structurally unable to collide**. Within `/r/`, ref uniqueness is trivial (we mint them: random token
  + unique index + retry on the rare clash). `/r/{ref}` stays short for plain-text platforms (IG).
- §1.4 placed the redirect in `/gua/` via a UUID (disjoint-by-format, but long); the `/r/` short path is
  disjoint-by-namespace **and** short. *(Exact prefix — `/r/` vs `/g/` etc. — and token length are
  implementation choices for the plan.)*

**`binding_requests` —**
- **Remove** `expected_handle` (no pre-declared handle — §D.2).
- **Add** resolved-author fields, set when `status=resolved`: `resolved_account_id`, `resolved_handle`,
  `resolved_display_name`, `proof_post_url`.
- **Extend** `status` enum: `pending` | `resolved` | `verified` | `cancelled` | `expired`
  (parent had `pending` | `verified` | `expired`).
- `code`, `expires_at`, `consumed_at`, `user_id`, `platform`, `created_at` unchanged.

**`linked_accounts` — uniqueness change (§A.6).** **Drop** parent §8's global `(platform, account_id)`
uniqueness (the "one current verified binding per account" lock). The same account may be bound by
multiple 正身; enforce uniqueness on **`(user_id, platform, account_id)`** instead (a 正身 binds a given
account at most once). No self-service `unbound` write occurs here in MVP (§A.5).
- **[DECIDED] One binding = one per-owner row; `users` → `linked_accounts` is one-to-many.** When an
  account is bound by two 正身, there are **two separate `linked_accounts` rows** (one per `user_id`),
  each with its **own** proof record, `visibility`, `is_main`, `condition`, and `verified_at`. There is
  **no shared "platform account" entity** in MVP — bindings are never merged across users.
- **[DECIDED] Timeline source = the append-only `binding_events` ledger.** The 驗明正身 Timeline (§E.2)
  is built from the ledger — each event (`bound`, `reported_banned`, `reported_hacked`, `re_verified`,
  and any future/admin `unbound`) carries its own **immutable `created_at`** = one timeline entry — plus
  **`users.created_at`** for the **建立正身** anchor. This is the additive history; a single mutable
  timestamp could never represent a multi-event history (banned → recovered → banned), which is exactly
  why the ledger is the source.
- **[DECIDED] Add `updated_at` for the FUTURE search feature (§C), not the timeline.** Both
  `linked_accounts` and `users` get an **`updated_at`** (Prisma `@updatedAt`), alongside the existing
  `created_at` / `verified_at` (parent §8). It supports **search** recency/ranking and "recently changed"
  — see the search use-case in §C. It is **not** a timeline source (the ledger is).

**Link-out & proof URLs are not stored as full URLs** — a 分身's profile URL is derived from
`linked_accounts (platform, account_id)` via the `PlatformAdapter`; the proof-post URL lives on
`proof_records.proof_post_url` (the "查看貼文 ↗" target).

> This is the UI-driven refinement to parent §8; the implementation plan should reconcile the parent
> `binding_requests` definition with this delta. `proof_records` retains its snapshot columns (unused/
> nullable in MVP, §A.1) so Phase 2 snapshots stay additive.

---

## I. Build sequence & next-session instructions

**Status:** design **reviewed + approved** (2026-06-16). This is the **build doc** for the next several
implementation tasks. Build **incrementally — one slice at a time**, NOT a single one-shot plan: for each
slice, run **superpowers:writing-plans** against *just that slice* of this spec → execute → review →
merge, then start the next slice in a fresh session.

### Recommended slice order (rationale in parens)

1. **Foundation + Create Identity onboarding (§D.1, §D.5 shell)** — builds on shipped Google auth; the
   smallest coherent vertical slice. Establishes the `users` model the rest depends on.
2. **Add Account + binding model (§D.2–D.4, §H)** — the core: `binding_requests` (commit-on-confirm),
   `linked_accounts` (per-owner rows), `binding_events`, `proof_records`; per-platform wizard; slug
   provisioning. **Start with ONE platform (Threads)** to prove the `PlatformAdapter` seam.
3. **Identity Card — Accounts tab (§E.1)** — the public Linktree; now there's data to show.
4. **Timeline tab (§E.2)** — render the append-only ledger.
5. **Manage tab (§E.3)** — disclose / set-main / condition flags / re-verify.
6. **Later platforms** — IG + miin adapters once Threads proves the seam.

### ⬅️ First thing to build (Slice 1) — scope for next session

> **Prompt to open the next session:** *"Write an implementation plan for Slice 1 (Foundation + Create
> Identity onboarding) from `docs/superpowers/specs/2026-06-16-mvp-wireframes-design.md` — see §I."*

**In scope for Slice 1:**
- **`users` model extension** (Prisma migration): `slug` (nullable, unique, **case-insensitive index** —
  §H.2), `short_ref` (**NOT NULL**, unique, short opaque — §H.2), `bio`, `avatar_url`, `updated_at`
  (`@updatedAt`). (`display_name`/`email` already exist from the v0.6.0 Google login.)
- **`short_ref` generation** in the **existing Auth.js `createUser` wrapper** (v0.6.0) — every new 正身
  gets one at creation (§H.2).
- **建立正身 onboarding UI** (§D.1): avatar + display_name + bio editing, with **input sanitization +
  caps** (§B / §D.1), and the slug-permanence expectation copy.
- **Pre-provisioned owner-view shell** (§D.5): the `/r/{short_ref}` access-controlled page with the
  "尚未公開" banner + gray "主要帳號 · 尚未設定" slot (the setup CTA can be a stub that Slice 2 wires up).
- **Routing:** `/r/{short_ref}` (owner-only pre-provisioning) + the `/gua/{slug}` resolver shell
  (slug + short_ref namespace check → generic 404, §1.3) — full profile rendering lands in Slice 3.

**Explicitly OUT of scope for Slice 1** (later slices): any binding/verification logic, the Add Account
wizard, platform adapters, slug *minting* (no main account can be set until Slice 2 brings binding), the
public Identity Card tabs, search behavior.

**Mockups** from this brainstorm live under `.superpowers/brainstorm/` (gitignored) for visual reference.
