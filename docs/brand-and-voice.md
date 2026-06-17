# Brand, Naming & Voice

The maintained home for guasi's **naming, language, voice, and marketing-copy** decisions. CLAUDE.md
carries the scannable quick-rules (Language / Brand & terminology / Copy clarity conventions); this
doc is the fuller version + rationale. Keep it current when a naming/voice/marketing decision changes.

## Names — brand vs tagline vs concept (don't mix these up)

| Term | Role | Use it for |
|------|------|-----------|
| **我是** | the **brand name** (paired with `guasi` / domain) | brand/identity fields — OG `siteName`, wordmark, "the 我是 service" |
| **我是正身** | the **tagline / slogan** only | where a slogan fits — headlines, the OG share card — **not** as the brand name |
| **正身** (*tsiànn-sin*) | the **product concept** | UI copy: "建立你的正身", the "驗明正身" public page. Not the brand. |
| **guasi** | romanization of 我是 = the **brand in Latin** + the domain | latin wordmark, URLs, code identifiers |

Quick rule: **brand → 我是 · slogan → 我是正身 · the thing a user creates → 正身.**
(This distinction is easy to get wrong — a wrong `siteName: "我是正身"` is what prompted writing it down.)

## Domain & handles

- **Domain:** `guasi.tw` — registered, live (the website).
- **Handle:** `@gua.si.tw` — registered on IG (also secures Threads). Also the `@gua.si.tw` tag used in
  verification posts.
- `guasi.com` is taken; `guasi.id` is available — both optional, later.
- The Japanese-pun alt `guatasi` / `guatashi` was **set aside** for coherence with 正身.

## Language

- **Traditional Chinese (繁體中文, zh-Hant / Taiwan) for ALL Chinese text** — every user-facing UI
  string, product copy, and doc. **Never** Simplified (简体).
- Use **Taiwan vocabulary**: 登入 (not 登录), 帳號 (not 账号), 驗證 (not 验证), 建置 (not 搭建),
  **施工中** (not 建置中, for under-construction UI).
- **Only exception:** user-supplied data we render verbatim (e.g. a person's Google display name).
  **"Verbatim" = don't *translate* it — not skip escaping.** Always escape user text against
  injection; reject SVG avatar uploads (a script vector).

## Voice

- **Make the actor unambiguous.** The **user** verifies their own accounts (we provide the mechanism).
  Prefer "驗證並串連你擁有的社群帳號" over "**主動**驗證…", which misreads as the site doing the
  verifying.
- **Wordplay / double meaning is welcomed** — puns that reinforce the 我是 / 正身 identity theme are
  on-brand and the user likes them. Live examples:
  - The global footer link **「關於，我是什麼」** → reads both as *"About — what is 我是?"* and
    *"what am I?"*.
  - The 我 gold-coin favicon / OG mark — 我 ("I / me") as the literal identity glyph.
  When copy can carry a second, identity-themed reading without hurting clarity, lean into it.
- **Clarity wins ties.** A pun that muddies what an actor/CTA does is not worth it (see actor rule).

## Marketing / promotional copy

- **Tagline:** **我是正身.**
- **Social share card** (`opengraph-image.png`): the 我 coin + **我是正身** + the actor-clear line
  「驗證並串連你擁有的社群帳號」 + `guasi.tw`.
- **The verification post is the growth engine** — it's public and links back to the 正身 page, so it
  doubles as marketing (the built-in answer to 行銷困難). Keep that post's copy clean and on-brand.
- When writing promo copy, keep the brand/tagline/concept distinction above, and the actor clear.
