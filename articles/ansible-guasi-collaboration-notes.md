# Talking to the Ansible builder: conflict & cooperation notes

*Prep notes for a conversation with the builder of Ansible (Tris-Aura), who shared his public repo.
Context: I build 我是 (guasi); I'm seeking his advice and want to find out where our works overlap and
where there's a future together. Companion to [`ansible-vs-guasi-comparison.md`](ansible-vs-guasi-comparison.md);
written 2026-06-17.*

---

## The framing to open with: we're not competitors

Lead with this — it de-risks the whole conversation and stops him reading guasi as encroaching on
his turf.

We operate at **opposite altitudes**. guasi *annotates* the mainstream platforms people already live
on (Threads / IG / miin); Ansible *replaces* them with a sovereign, federated network. A creator
worried about a Threads ban uses guasi **without leaving Threads**; someone who wants to leave Meta
entirely uses Ansible. Neither is the other's substitute. Say this first, and the rest of the talk
can be open.

## The one real collision to surface honestly

Ansible's roadmap lists **DNS Handle verification (🔜 future)** — verifying that someone controls an
external handle. That's *adjacent* to guasi's core ("prove you own this external account") and is the
one place our roadmaps could drift into the same lane.

Raise it directly and early — not as a turf claim, but as a "where's your line?" question:

> "You've got DNS handle verification coming — do you see Ansible ever attesting ownership of
> mainstream platform accounts (Threads/IG)? That's my whole core, so I'd love to know if we're
> heading for the same lane or if there's a clean handoff."

His answer tells me whether this is a collaboration or a fork in the road. Better to know now.

## Cooperation opportunities (strongest first)

### 1. He's already built guasi's Phase 2 — the headline

guasi's "publicly-verifiable proofs" is **deferred to Phase 2**. Ansible already runs a **W3C
Verifiable Credential issuer** (`eddsa-jcs-2022`, `did:web` `/.well-known/did.json`). A guasi
`ProofRecord` is morally a credential: *"guasi attests account X is owned by person Y."* If guasi
emitted a standards-shaped VC instead of a private DB row, the proofs become **portable and
independently verifiable** — exactly the Phase-2 goal — without reinventing the crypto.

**Best advice question of the whole conversation:**
> "My durable-proof story is still a DB ledger; you've already got a real VC issuer. Would you reuse
> it, or what would you tell me to build?"

### 2. guasi attestations as an Ansible trust signal

Ansible has a cold-start trust problem: a new pseudonym starts at the lowest tier. A guasi card —
*"these N mainstream accounts are provably the same person"* — is exactly the kind of **external
evidence** his reputation tiers could ingest to bootstrap a newcomer. Mutually motivating: it gives
guasi a reason to exist **beyond ban-survival**, and gives Ansible a trust on-ramp.

### 3. `did:elix` as a guasi platform adapter

guasi's `PlatformAdapter` seam already abstracts "resolve the author of a proof post." A sovereign
`did:elix` could become one more **linkable account type**, so a creator's Ansible identity sits in
the same 驗明正身 card as their Threads/IG. Low effort on guasi's side; gives him distribution.

### 4. One-directional user handoff

guasi's audience — creators who just got banned or fear it — *is* Ansible's prospective migrant pool.
A *"if a platform erased you, here's a network you fully own"* referral is natural. The reverse
(Ansible → guasi) is weaker, so frame it as **guasi sending him users**.

## What to ask him for advice on (play to his depth)

He's solved things guasi deliberately deferred or sidestepped. Mine that.

- **The centralization question (the deep one).** guasi's entire value prop is surviving platform
  de-platforming — yet guasi itself is a single centralized DB, i.e. a single point of trust/failure.
  *"What happens to a guasi identity if guasi disappears?"* is the question he's best equipped to
  challenge, since his self-certifying `did:elix` exists precisely so identity survives the issuer.
  Worth asking whether guasi should give users a key/DID so their cross-link graph isn't purely
  guasi's to hold. **Be ready to defend** the pragmatic centralized MVP (mainstream reach, near-zero
  user effort) — but hear him out.
- **Durable evidence when the post is gone.** guasi's "verify while alive" principle and his "a
  banned account can't prove ownership" are the same insight; he answers it with immutable
  local-first repos (MST) + self-certifying keys. Good input for guasi's deferred snapshot/archive
  work.
- **Graduated vs binary trust.** guasi is verified-or-not; his progressive trust tiers are a model if
  guasi ever needs nuance ("verified 2 years ago" vs "yesterday").

## A risk to watch on guasi's side

He'll likely push toward decentralization — DIDs, federation, wallets. **Take the standards advice
(VCs especially) but guard guasi's focus.** guasi's strength is being a five-minute, log-in-with-
Google, no-wallet tool over platforms people already use. Absorbing Ansible-shaped architecture would
forfeit exactly that. The cooperation is *"interoperate with his primitives,"* not *"become a smaller
Ansible."*

## A clean conversation arc

1. **Open** with the altitude framing: *"I read your repo — we're at totally different layers, which
   is great, here's how I see it..."*
2. **Surface the collision:** the DNS-handle / external-account-attestation question.
3. **Ask for advice where he's deep:** the centralization / key-ownership challenge + guasi's
   deferred VC/proof work — *"you've literally already built the thing I punted to Phase 2."*
4. **Float two-way cooperation:** guasi attestation → his trust tiers; `did:elix` → guasi adapter;
   user handoff.
