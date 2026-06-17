# Slice 5 — Manage tab (分身管理) · design

**Status:** design / discussion (v0.14.0-design). Implementation NOT started.
**Date:** 2026-06-17.
**Parent specs (historical — defer to this doc + CLAUDE.md where they conflict):**
- [`2026-06-16-mvp-wireframes-design.md`](2026-06-16-mvp-wireframes-design.md) — §E.3 Manage tab, §D.5
  pre-provisioned state, §H data model. This doc **resolves** its open Manage-tab UX and refines two
  of its decisions (the §D.5 picker is dropped; disclose/set-main now emit ledger events).
- [`2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — §6.6/§6.7/§6.8
  ledger, status management.

> **Legend:** **[DECIDED]** locked this session · **[OPEN]** still pending · **[REC]** recommendation.
> Mockups from this brainstorm live under the gitignored `.superpowers/brainstorm/`.

---

## A. Scope

Wire up the four owner controls on the `/gua/{slug}` **管理** tab — today stubbed as disabled chips in
`app/(site)/gua/[slug]/AccountRow.tsx` (`ManageChips`) — plus build the profile-edit surface and ship
the re-verify commit path Slice 2 deferred. **Threads-only** (the only live platform).

The four controls (per wireframes §E.3): **disclose** (private → public, one-way), **set-as-main**
(switch the featured ★), **condition flags** (回報遭盜用 / 回報已被停權), and **恢復·重新驗證**
(trust-restoring re-proof). Plus: the **編輯個人資料** surface, the slug-less owner state, and bio
multi-line support.

---

## B. Data-model deltas

A single small migration — everything else (`Visibility`, `AccountCondition`, `ProofRecord`,
`updatedAt`, the per-owner `@@unique([userId, platform, accountId])`) already exists from Slice 2.
**This migration ships FIRST, as its own release, ahead of the feature code — see §M.**

1. **[DECIDED] `User.onboardedAt DateTime?`** (nullable). Set **once**, when the onboarding profile
   form is first saved (in `saveProfileAction`, only if currently null). Distinguishes a brand-new 正身
   from a returning-but-unprovisioned one — see §F routing. **Backfilled** to `createdAt` for existing
   rows in the Release-1 migration (§M) so current users are never re-routed to the first-time wizard.
2. **[DECIDED] Two new `BindingEventType` values** (additive enum): **`disclosed`** and **`set_main`**.
   The timeline (§E.2 / Slice 4) is the append-only public ledger, and visibility/main changes are now
   recorded there (§C.1, §C.2).

```prisma
enum BindingEventType {
  bound
  unbound
  reported_banned
  reported_hacked
  re_verified
  disclosed   // NEW — account went private → public (one-way)
  set_main     // NEW — account designated the main 分身
}

model User {
  // …existing…
  onboardedAt DateTime?   // NEW — first onboarding completion (§F)
}
```

No other schema change. `BindingEvent` already carries `(userId, platform, accountId, eventType,
reason?, proofRecordId?, createdAt)` — enough for all new events.

---

## C. Manage-tab actions

**[DECIDED] Confirmation pattern = inline expand (pattern A).** Tapping an action chip expands a
confirm panel **in place** within the row — no modal/overlay component, no extra route. The confirm
button fires a server action; cancel collapses the panel. The **same** pattern is reused by all four
controls, so the tab has one consistent interaction. Permanent actions carry a strong (orange/red)
warning style in the panel. Implemented as client state in `AccountRow` (or a small `ManageChips`
client subcomponent); the server actions live on `app/(site)/gua/[slug]/actions.ts`.

All actions re-read auth + ownership server-side (the row's account must belong to the current user).

### C.1 Disclose — private → public (one-way)
- **[DECIDED]** Confirm copy: "公開後將永久顯示在你的正身頁，無法再次隱藏。" → set `visibility: "public"`.
- **[DECIDED]** Writes a **`disclosed`** `BindingEvent` (newly required this session). One-way: no
  hide-again control (public = permanent, §6.6).

### C.2 Set-as-main — switch the featured ★ (re-point only)
- **[DECIDED] Re-point only.** In MVP a set-as-main target always already has a slug (see §F — a
  slug-less user has no non-main accounts to promote). So set-as-main **never mints a slug**; it only
  moves the ★. **The slug never changes** (§A.2 of wireframes).
- **[DECIDED] One main at a time.** Reuse the existing clear-then-set logic from `commitBinding`:
  `updateMany({ where: { userId, isMain: true }, data: { isMain: false } })` then set the new row
  `isMain: true`. The previous main **stays public** (permanence) but loses its ★.
- **[DECIDED] Forces the new main public.** If it was private, the action **first discloses it** — the
  confirm panel carries the same permanent-disclosure warning as §C.1, and a **`disclosed`** event is
  written in addition to **`set_main`**. Promoting an already-public account needs no disclosure warning.
- **[DECIDED]** Writes a **`set_main`** `BindingEvent`.
- **[DECIDED] Provisioning also emits `set_main`.** Slice 2's `commitBinding({ mintSlug: true })` (the
  first/main bind) gets one extra `set_main` event inside its existing transaction, so the timeline
  shows the *original* main designation, not just later switches. Small additive change to
  `lib/binding/repo.ts`.

### C.3 Condition flags — 回報遭盜用 / 回報已被停權
- **[DECIDED] Two distinct pills**, not one combined chip: 回報遭盜用 → `condition: "hacked"` +
  **`reported_hacked`** event; 回報已被停權 → `condition: "banned"` + **`reported_banned`** event.
- **[DECIDED]** Each fires an inline confirm — it publicly lowers trust. Confirm copy makes clear it's
  recoverable only by re-verifying, e.g. "將公開標記此帳號遭盜用，降低其信任。僅能透過重新驗證恢復。"
- **[DECIDED] No quick undo** (locked §6.8): a hijacker must not be able to clear a flag. The inline
  confirm is the misclick guard; the only way back is §C.4.
- A flagged row renders the public anti-impersonation warning ("⚠ 已回報遭盜用 · 此帳號已非本人") and
  **no click-out** — already handled by the public-card code; Manage view swaps its pills for §C.4.

### C.4 恢復·重新驗證 — trust-restoring re-proof (flagged rows only)
- **[DECIDED]** A flagged row's pills are replaced by a single **「恢復 · 重新驗證 →」** that re-enters
  the Add flow **scoped to that platform** (carries the target `(platform, accountId)`).
- **[DECIDED] Must resolve to the SAME account.** On paste-back, if the platform-resolved author's
  `accountId` ≠ the bound row's `accountId`, **reject** ("這則貼文不是這個帳號發的"). You cannot swap a
  different account onto an existing row via recovery.
- **[DECIDED] Append-only refresh — one row.** On success, in one transaction: create a new
  `ProofRecord`, write a **`re_verified`** `BindingEvent`, flip `condition → "active"`, bump
  `updatedAt`. **Never a duplicate row** — the `(userId, platform, accountId)` unique holds. New repo fn
  **`reverifyBinding({ requestId, linkedAccountId })`** — the commit path Slice 2 deferred (Slice 2's
  confirm page only *notifies* "已綁定" and writes nothing).
- **[DECIDED] Flagged rows only in MVP.** "Re-verify an already-active account" (fresh proof, no
  condition change) is the same code path but gets **no button** yet — defer (YAGNI).

---

## D. Profile-edit surface (編輯個人資料)

- **[DECIDED] Dedicated page, not an inline section.** The 管理 tab's **編輯個人資料** button (today
  `disabled` in `IdentityCard`) becomes a link to a dedicated edit page. The Manage tab stays scoped to
  **bound 分身**; the profile form is a separate concern. This **refines** wireframes §E.3 ("profile
  edit at the top"). Routes are an implementation detail (e.g. `/settings` → `/settings/avatar`) —
  settle in the plan; UI strings stay 繁中.
- **[DECIDED] Reuse the shipped form.** The edit page reuses `saveProfileAction` (already an UPDATE) +
  the onboarding form, **reframed**: title/CTA → 儲存 (drop 「下一步」 and the first-time permanence copy).
- **[DECIDED] Avatar is one more click away.** The edit page shows name + bio inline (instant text
  save) and a **「更換頭像 ↗」** button → a **separate** avatar page that reuses the existing
  `lib/identity/avatar.ts` pipeline (sharp re-decode → WebP 512² → Blob; MIME-validated, reject SVG,
  ≤ 2 MB). Keeps the file-picker + native image module out of the text-edit path.
- **[DECIDED] Char counters + disabled save.** Both fields show a live `current/max` hint (e.g. `30/50`,
  `135/200`). **儲存 is disabled** when: name is empty, name > 50, bio > 200, or bio > 8 lines (§E). The
  counter measures length **the same way the server validates** (JS `String.length`) so the hint can
  never disagree with the save result. Lives in the shared form component → onboarding inherits it.

---

## E. Bio multi-line + limits

- **[DECIDED] Limits:** display name **50** (keep, single-line); bio **160 → 200**, **multi-line,
  ≤ 8 lines**.
- **[DECIDED] `sanitizeBio` changes** (`lib/identity/profile.ts`): keep the existing `\n` preservation;
  **collapse 3+ consecutive newlines → 2** (allow a blank-line separator, block tall empty stacks);
  **enforce the 8-line cap** (reject with a clear message). Bump `BIO_MAX` to 200. `sanitizeDisplayName`
  unchanged (still strips all control chars → single line).
- **[DECIDED] Render:** add `white-space: pre-line` to `.id-bio` (and the edit preview) so line breaks
  actually display. Edit field becomes a **`<textarea>`**.

---

## F. Slug-less owner state + `onboardedAt` routing

- **[DECIDED] One state only — zero accounts.** Proven invariant (verified in
  `app/(site)/add/[platform]/confirm/page.tsx`): a slug-less user can **only** reach `SlugConfirm`,
  whose sole commit is `commitBinding({ asMain: true, mintSlug: true })`. The non-main path
  (`confirmOrdinaryAction`, `asMain: false`) is gated behind `user.slug` existing. Therefore **no slug
  ⟹ zero verified accounts**, and **any non-main/private account ⟹ a slug already exists**. The first
  successful binding is always the public main and mints the slug.
- **[DECIDED] Reuse `IdentityCard` locked-manage** (today's behaviour) — **no dedicated layout**
  (YAGNI). The slug-less `/r/{shortRef}` card shows only: the 🔒 尚未公開 banner, a gray dashed
  「主要帳號 · 尚未設定」 box with the **「驗證主要帳號並開通公開網址 →」** CTA, and 編輯個人資料 / 登出 /
  切換帳號. No account rows are possible.
- **[DECIDED] `/post-login` routing with `onboardedAt`:**
  - has `slug` → `/gua/{slug}`
  - no slug **+ `onboardedAt` set** → `/r/{shortRef}` (their pre-provisioned card — **not** the wizard)
  - no slug **+ `onboardedAt` null** → `/onboarding` (genuine first-timer)
- **[note] MVP caveat:** the wireframes §D.5 "miin-only user stays pre-provisioned with a private 分身"
  scenario would create a slug-less-with-accounts state — but the current code gives non-slug-eligible
  bindings **cancel-only** while slug-less, so it isn't buildable today. Revisit if/when miin ships.

---

## G. Cleanup

- **[DECIDED] Remove dead code:** `provisionExistingAccount` and `listProvisionCandidates` in
  `lib/binding/repo.ts` (+ their tests). The §F invariant proves they're unreachable — their only
  trigger was promoting an existing non-main account while slug-less, which cannot occur. (The §D.5
  promote-existing picker was already removed from the UI in v0.12.1.)

---

## H. Timeline (Slice 4) constraints recorded here

Slice 5 only **writes** the new events; Slice 4 renders them. Two constraints the Timeline must honor:

- **[DECIDED] Filter to currently-public accounts.** `bound` (and now `disclosed`/`set_main`) events
  exist for private accounts too. The public timeline read model must join to the account's **current
  visibility** and only show events for accounts that are currently public — otherwise private bindings
  leak.
- **[OPEN → Slice 4] Disclosed-account history.** Once a previously-private account is disclosed, its
  earlier `bound` event becomes visible ("bound on X, made public on Y"). [REC] show it — older binding
  = more credible (§6.7) — but it's a product call to confirm when building Slice 4.

---

## L. Rendering & revalidation

- **[DECIDED] `/gua/{slug}` is already dynamically rendered.** `page.tsx` calls `getCurrentUser()` →
  `auth()`, which reads the session cookie on every request, so the route opts out of the Full Route
  Cache (and is not CDN-cached). Every load — owner *or* logged-out visitor — re-queries the live DB
  (`findUserBySlug` + `buildAccountGroups`), so any Slice 5 mutation is reflected on the **next page
  load, for everyone**. No data-layer staleness to design around.
- **[DECIDED] Every mutating server action calls `revalidatePath`** before returning, to clear the
  **client-side Router Cache** (otherwise the owner who just acted, or soft-navigates back, can see the
  pre-mutation render):
  - Manage actions (disclose / set-main / condition flags / re-verify) → `revalidatePath(\`/gua/${slug}\`)`
    and, for the slug-less card, `revalidatePath(\`/r/${shortRef}\`)`.
  - Profile edits (name / bio / avatar) → also `revalidatePath(\`/gua/${slug}\`)` (those fields render on
    the public card) plus the edit page itself.
  - With the pattern-A inline confirm (a form submission), the post-`revalidatePath` re-render moves the
    row to its new bucket automatically (disclosed row leaves the private group; flagged row swaps to the
    recovery pill) — no manual client state-sync beyond collapsing the confirm panel.
- **[DECIDED] Avatar cache-busting.** `<img src={avatarUrl}>` will serve a stale image if a new upload
  overwrites the same Blob URL. The avatar step must write a **unique path per upload** (or append
  `?v={updatedAt}`) so a changed avatar shows immediately.

---

## M. Release phasing (two-phase — schema first)

**[DECIDED] Ship the §B schema delta to production FIRST, ahead of the feature code.** The migration is
purely additive and backward-compatible (a nullable column + two *unused* enum values), so deploying it
alone changes no behavior but makes the **production DB forward-compatible**. Feature work then develops
and tests on Vercel previews (each branches the Neon DB from prod) against a schema prod already has —
**no migration racing with feature merges**, and a compatible prod DB throughout testing.

- **Release 1 — schema only (its own PR → merge → prod):**
  - `prisma/schema.prisma`: add `User.onboardedAt DateTime?`; add `disclosed` + `set_main` to
    `BindingEventType`. New migration.
  - **Backfill** `onboardedAt = createdAt` for all existing users (so returning users skip the wizard
    once Release 2's routing goes live; new users get it stamped on onboarding completion in Release 2).
  - **[note] Enum adds belong in this release**, where nothing consumes them yet — sidesteps the
    Postgres "can't use a new enum value in the same transaction that adds it" restriction at feature time.
  - **[note] No app code** reads/writes the new column or enum values in Release 1 — it is behavior-inert.
  - **Verify:** `prisma migrate deploy` runs clean in the Vercel build; prod DB shows the column + enum
    values; the existing app still behaves identically.
- **Release 2 — features (one or more PRs):** everything in §C–§L, built on the already-migrated schema.
  Can be sliced further (e.g. Manage actions → edit surface) since the DB no longer moves.
  - **[note]** Stamp `onboardedAt` on onboarding completion; optionally re-backfill any rows still null
    that clearly onboarded (has slug / linked accounts) — covers the small Release-1→2 window.

---

## I. Out of scope (unchanged)

Self-service unbind (§A.5), proof snapshots / archive (Phase 2), `@gua.si.tw` auto-capture (Phase 2),
IG / miin adapters, the search feature, re-verify of already-*active* accounts (no button), and the
Timeline tab itself (Slice 4 — Slice 5 only writes its events).

---

## J. Surface / file inventory (what to touch)

| Area | Files (representative) |
|---|---|
| **Schema + migration — RELEASE 1 (§M)** | `prisma/schema.prisma` (`onboardedAt`, 2 enum values) + new migration (incl. `onboardedAt = createdAt` backfill) — **ships alone, first** |
| Manage actions + inline confirm | `app/(site)/gua/[slug]/AccountRow.tsx` (un-stub `ManageChips`, add inline-confirm client state), `app/(site)/gua/[slug]/actions.ts` (disclose / set-main / flag server actions) |
| Repo | `lib/binding/repo.ts` — new `discloseBinding`, `setMainBinding`, `reportCondition`, `reverifyBinding`; add `set_main` to `commitBinding`; **remove** `provisionExistingAccount` + `listProvisionCandidates` |
| Re-verify entry | scoped Add-flow entry from a flagged row → `/add/{platform}` carrying the target account; same-account guard in the confirm/commit |
| Edit surface | new edit page + avatar page (routes TBD), reuse `saveProfileAction` + `lib/identity/avatar.ts`; shared form gains counters + disabled-save; enable the 編輯個人資料 link in `IdentityCard` |
| Bio multi-line | `lib/identity/profile.ts` (`BIO_MAX`, newline-collapse, line cap), `.id-bio` CSS (`white-space: pre-line`), bio `<textarea>` |
| Routing | `app/(auth)/post-login/page.tsx` (`onboardedAt` branch), `saveProfileAction` (stamp `onboardedAt` once) |

---

## K. Build & verification notes

- **Gates:** `npx tsc --noEmit` clean + `npx vitest run` green before the PR (CLAUDE.md ship flow).
- **Tests to add:** repo-level — disclose writes `disclosed` + flips visibility; set-main clears the old
  main, forces public, writes `set_main` (+ `disclosed` when promoting a private row); condition flags
  write the right event + condition; `reverifyBinding` rejects a mismatched author, and on match writes a
  new `ProofRecord` + `re_verified`, restores `active`, keeps one row; `commitBinding(mintSlug)` now
  writes `set_main`; `sanitizeBio` newline-collapse + line-cap + 200 cap. Routing — `/post-login` three
  branches by `slug`/`onboardedAt`.
- **Manual (Vercel preview):** as owner — disclose a private row (confirm permanence, verify it's
  public + on no-hide), switch main between two accounts (old loses ★, stays public; new is featured +
  public), flag → recover an account (recovery rejects a wrong-account post, accepts the right one),
  edit name/bio (counters + disabled save; multi-line bio renders with line breaks), change avatar on
  its own page. Slug-less account → only the gray 主要帳號 box; first bind mints slug.
