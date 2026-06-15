# 我是 (guasi) · TODO

Working list of next steps. See [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](docs/superpowers/specs/2026-06-14-identity-backup-design.md) for the full design.

- [ ] **Auto-capture validation posts via `@gua.si.tw`** — figure out how to detect the
  verification posts that tag the account, so users can skip pasting the URL. Needs the
  platform mention/tag API (business account + app review); paste-URL stays the fallback.
  (Spec §6.2)
- [ ] **Decide hosting platform (GCP vs Vercel)** and wire it to the `guasi.tw` domain.
  (Spec §12 / §13)
- [ ] **Detailed wireframes for each page** — 建立正身 (register), 註冊分身 (bind),
  驗明正身 (public profile + timeline), 分身管理 (manage), and the home / lookup pages.
- [ ] **Implement the MVP** — after hosting + wireframes are settled. (Use the
  writing-plans skill to turn the spec into an implementation plan first.)
