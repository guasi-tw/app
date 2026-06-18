# Homepage (`/`) as the landing page — design

**Date:** 2026-06-18
**Status:** spec (pre-plan)
**Topic:** Turn the thin `/` stub into the real landing page, before MVP release.

## Problem

`/` is a stub: wordmark + one lede line + a Google sign-in button. It's the
front door (most-linked URL, the OG `siteName`) yet it neither demonstrates nor
explains the product — a logged-out first-time visitor gets a login wall.

Meanwhile **`/about` already contains a full landing page** in
`app/(site)/about/content.ts`: `hook`, `brand`, `how` (3 steps + 正身/分身
`gloss`), `examplePost`, `platforms`, `independence`, `exampleProfile` (a mock
card), `trust`, `whyNow`, `cta`, `contact`. So the landing copy already exists —
it's sitting at the wrong URL.

This is a pre-release priority. **Search is explicitly out of scope** (near-zero
value at launch with an empty index, and it collides with the anti-enumeration
decision; deferred until a corpus exists — see `docs/product-decisions.md` §404).

## Decisions (settled in brainstorm)

1. **`/` ↔ `/about`: curate onto `/`, slim `/about`.** Promote the selling
   sections (hero + how-it-works + demo card + CTA) to `/`. `/about` becomes the
   deeper "關於，我是什麼" read.
2. **Demo card: static preview → links to live.** Render a styled static preview
   (reuse `exampleProfile`, updated to 3 platforms) with a button linking to the
   real `/gua/gua.si.tw` card. No build dependency on the live card; ships now.
3. **Logged-in users: same landing page, CTA adapts.** Do **not** redirect them
   away and do **not** collapse the page. The global header `AccountMenu`
   (avatar → 正身頁面 / 切換帳號 / 登出, via `ownerHomePath`) already owns
   "get me to my page," so `/` stays a viewable landing page for everyone; only
   the CTA buttons branch on auth state.

## Design

### Content source — one source, two views

Promote `app/(site)/about/content.ts` to a **shared landing-content module**
(it is no longer about-only; relocate/rename so both pages import it). Same
object, same keys. **No marketing copy is rewritten for MVP** — both pages
render from this single source, so there is no duplicated string and no drift
(consistent with the project's single-source-of-truth convention).

`/` renders a curated subset; `/about` renders the full set.

### `/` — sections, top to bottom

1. **Hero** — `hook.title`（帳號被封了，你要怎麼說「這真的是我」？）as the
   emotional hook + `brand.body`（把那句你最想喊…變成任何人都能查證的事實）as the
   one-line value prop + **primary CTA** (see auth branch below).
2. **How-it-works** — `how` 3 steps（建立正身 → 綁定分身 → 驗明正身）+ the 正身/分身
   `gloss`.
3. **Demo preview** — the `exampleProfile` static card mock, **updated to 3
   platforms** (Threads + Instagram + miin.cc), with a button 「看一個真實的正身 →」
   linking to `/gua/gua.si.tw`.
4. **Closing CTA** — `cta.title`/`cta.subtitle`（趁現在，先驗明你的正身 /
   被封後就來不及了）+ CTA (auth branch).
5. Existing footer chrome (`guasi.tw · 關於，我是什麼`); 關於 points at the
   slimmed `/about`.

### Auth-state CTA branch (the only logged-in/out difference)

Page content (hero / how-it-works / demo) is **identical** for everyone. Only
the CTA buttons branch:

- **Logged out** → `GoogleSignInButton` (with `cta.note`「免費 · 無需密碼」).
- **Logged in** → a neutral affirming action 「前往我的正身頁 →」
  (`ownerHomePath(user)`). No "登入 / 建立正身" shown to an existing user.

Navigation to one's own page otherwise stays the header's job (`AccountMenu`).
No redirect of `/` for logged-in users.

### `/about` — slimmed to the deep read

Renders the **full** content set, anchored on the material that does not belong
on the punchy front door: the full origin story (`hook` long body),
`examplePost` anatomy, `independence`（平台中立）, `trust`（為什麼可信）, `whyNow`,
`contact`. Sections that also appear on `/` (how-it-works, example profile) may
still render here so `/about` stands alone — same content object, zero drift.

## Out of scope (MVP)

Search / public handle lookup, FAQ, blog, live-embedded card, and **any new copy
writing**. This is a restructure: relocate content source, render a curated `/`,
update the mock to 3 platforms, add the live-card link, branch the CTA.

## Testing

- `/` logged-out: hero + how-it-works + demo preview + closing CTA render; CTA is
  the Google sign-in button; demo links to `/gua/gua.si.tw`.
- `/` logged-in: same content renders; CTA is 「前往我的正身頁」 (not sign-in); no
  redirect occurs.
- `/about`: full content set renders.
- Existing `app/(site)/page.test.ts` patterns extend to cover both auth states.

## Docs to update on ship

- `docs/routes.md` — refresh the `/` and `/about` row descriptions.
- `docs/devlog.md` — new `vX.Y.0` entry + TL;DR row.
