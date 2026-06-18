# DIDs & Verifiable Credentials: a primer (mapped to guasi & Ansible)

*A plain-language intro to Decentralized Identifiers (DID) and Verifiable Credentials (VC) — the
W3C standards behind Ansible's identity model — and how they map onto guasi's existing concepts.
Written 2026-06-17 as background for the Ansible conversation. Companion to
[`ansible-vs-guasi-comparison.md`](ansible-vs-guasi-comparison.md) and
[`ansible-guasi-collaboration-notes.md`](ansible-guasi-collaboration-notes.md).*

> Standards facts here (spec names, dates) reflect knowledge as of early 2026 — worth a quick
> re-check against `w3.org` before quoting a date in public.

---

## The one-sentence version

A **DID** is an identifier you create and control with a cryptographic key (no company issues it),
and a **VC** is a tamper-evident digital certificate that one DID signs *about* another. Both are
**open W3C standards**, not anyone's proprietary invention.

## Part 1 — DID (Decentralized Identifier)

### What it is

An identifier you generate yourself from a key pair, where **you** are the authority because you
hold the private key. Contrast with everyday identifiers:

- **Traditional:** `you@gmail.com` — Google owns the namespace, is the authority, and can revoke it.
- **DID:** `did:elix:z6Mk…` — derived from *your* key; no one issues it and no one can take it away.

### The format

Always three colon-separated parts — like a URL scheme:

```
did : method : method-specific-id
 │      │              │
 │      │              └─ the actual id (often derived from a public key)
 │      └─ the "DID method": the ruleset for how this DID is created & resolved
 └─ the scheme, literally "did" (like "https")
```

### How verification works

Every DID **resolves** to a **DID Document** — a small JSON file listing the identity's public keys
and service endpoints. To check "is this really you?", a verifier fetches your DID Document and
validates a signature against the key listed there. Self-certifying methods skip the lookup entirely:
the ID *is* derived from the key, so it proves itself.

### Is it invented by Ansible? No.

- **DID the concept + format** → a **W3C Recommendation** (the same standards body behind HTML/CSS).
  Open and widely adopted.
- **A "DID method"** → anyone can define one; there are 100+ registered. A method just specifies how
  DIDs in its namespace are created and resolved.
- **`did:elix`** → Ansible's *own* method, defined by following the W3C rules. So Ansible invented a
  *method*, not the *standard*.

## Part 2 — VC (Verifiable Credential)

A **Verifiable Credential** is DID's sibling W3C standard: a digital, cryptographically-signed
"certificate." It has three roles:

- **Issuer** — signs a claim ("this account is owned by this person"). Identified by a DID.
- **Holder** — the subject who keeps the credential and presents it. Identified by a DID.
- **Verifier** — anyone who checks the issuer's signature against the issuer's DID Document.

Because the signature is self-contained, a verifier can trust a VC **without contacting the issuer's
server** — and even if the issuer later disappears, the credential stays verifiable. That property is
the whole point, and it's exactly what guasi's proof model currently lacks.

## Part 3 — Ansible's four DID methods, decoded

The README's alphabet soup is really "one standard, four tools for four jobs":

| Method | Defined by | Ansible's role for it |
|---|---|---|
| **`did:elix`** | **Ansible's own** | **Canonical user identity.** *Self-certifying* (proves itself from the key) and *portable across relays* (no single server owns it). |
| **`did:key`** | Standard method | Simplest possible method — the DID *is* the encoded public key. Used as the **wallet / credential holder** alias. |
| **`did:web`** | Standard method | Resolves via an HTTPS file at `https://domain/.well-known/did.json`. Ties identity to a **domain**, so it's reserved for **issuers** (orgs you find by their website). |
| **`did:plc`** | Bluesky / AT Protocol | Bluesky's identity system. Ansible uses it only as an **opt-in bridge** to Bluesky — explicitly *not* the canonical identity. |

Ansible's product decision — "`did:elix` is canonical; the rest are bridges or roles" — is a *design
choice layered on a standard technology*.

## Part 4 — Mapping to guasi (why this is relevant)

guasi already does the *spirit* of this with centralized primitives. The DID/VC stack is the
standards-based, decentralized version of concepts guasi has either built or deferred:

| guasi concept (today) | DID/VC equivalent |
|---|---|
| `User` (正身) = a DB row | A **DID** the user controls with a key |
| `ProofRecord` (link-to-live-post, in guasi's DB) | A **Verifiable Credential** signed by guasi-as-issuer |
| guasi is the trusted authority (centralized DB) | guasi would be a **`did:web` issuer**; trust survives guasi |
| "Publicly-verifiable proofs" — **deferred to Phase 2** | **Exactly what VCs deliver** — Ansible already runs the issuer |
| `PlatformAdapter` resolves a post's author | A `did:elix` profile could be **one more linkable account** |

The headline: **Ansible has already built, on open standards, the Phase-2 "publicly-verifiable
proof" that guasi has on its roadmap.** Understanding DID/VC is what lets guasi evaluate whether to
adopt those standards rather than reinvent them — and lets the conversation with the Ansible builder
happen on shared terms.

The deepest implication is also the sharpest challenge: a guasi identity today **depends on guasi's
DB existing**. A DID-backed identity survives the issuer disappearing — which is the direct answer to
*"what happens to a guasi identity if guasi goes away?"*

## Where to go deeper

In rough order of effort:

1. **Fast intuition:** search *"decentralized identifiers explained"* — W3C, Auth0, Microsoft Entra,
   and SPRUCE have approachable intros.
2. **Canonical source:** the **W3C DID Core spec** (`w3.org/TR/did-core/`) — skim the intro + the
   DID Document examples.
3. **The sibling spec:** **W3C Verifiable Credentials Data Model** (`w3.org/TR/vc-data-model/`) —
   because DIDs are most useful as the signers/holders of VCs (Ansible's issuer).
4. **Play with one:** `did:key` is the easiest to grok by example — search *"did:key method"*; you
   can generate one from a key pair and see how the DID *is* the key.
5. **The Bluesky angle:** the **AT Protocol identity docs** (`atproto.com`) explain handles + DIDs —
   useful if guasi ever reads Bluesky/AT accounts.
