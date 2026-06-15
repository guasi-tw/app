# 我是 (guasi) · 正身

An identity-backup / alter-account verification service. Lets a person **proactively
verify and cross-link the social accounts they own**, so that when one account is banned,
their surviving verified accounts can vouch for a new one — and anyone can publicly
**驗明正身**: look up which accounts are the same person.

> Tagline: **我是正身.** · Domain: `guasi.tw` · Handle: `@gua.si.tw`

Status: **design phase** — not yet implemented. See the docs below.

## Docs

- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview (Traditional Chinese).
- [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](docs/superpowers/specs/2026-06-14-identity-backup-design.md) — full product + architecture spec (source of truth).
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings.
- [`CLAUDE.md`](CLAUDE.md) — project context and locked decisions.
- [`todo.md`](todo.md) — working list of next steps.

## Viewing the pitch deck

The slide deck lives in `pitch-deck/` (an [open-slide](https://github.com/1weiho/open-slide)
workspace). It is **local-only / not version-controlled** (gitignored).

```bash
cd pitch-deck
npm install      # first time only
npm run dev
```

Then open <http://localhost:5173/>, click **「我是 guasi — 產品概念」**, and press **`F`**
for fullscreen present mode (`→`/`←` to navigate). Stop the server with `Ctrl + C`.

To export a shareable static build instead: `npm run build` (from `pitch-deck/`).
