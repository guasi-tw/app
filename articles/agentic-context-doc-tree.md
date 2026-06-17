# The document tree: how I keep an AI-built project on track

*A lazy-loaded, always-current context structure for agentic coding — and why the agent that
built your project is the wrong one to trust its docs.*

---

## The moment it clicked

I was about to merge a week's worth of AI-assisted work on a side project. Before merging, I
asked a fresh agent — one with no memory of building the thing — to review my project's
foundation docs for consistency.

It came back with a quiet bombshell. Three of the "locked decisions" in the file that gets
**auto-loaded into every coding session** were wrong. Not vague — *contradicted by the code that
had already shipped*:

- The doc said proof verification captured a screenshot + archived the post. The code stored a
  link to the live post and nothing else.
- The doc said users could unbind an account. There was no such feature, by design.
- The doc described a global uniqueness lock. The schema had a per-user constraint — the opposite.

Every future session would have read those lines as ground truth and built on a fiction.

That's the risk of agentic coding nobody puts on the box: **your context doesn't fail loudly, it
drifts silently.** The agent is only as good as the documents it wakes up to, and those documents
rot the moment the code moves and the docs don't.

This is the structure I use to fight that: a **document tree** — and the disciplines that keep it
honest.

## The setup: the repo *is* the context

Two facts about coding agents shape everything:

1. **One root file is auto-loaded every session.** (`CLAUDE.md`, `AGENTS.md` — whatever your tool
   calls it.) It's the one thing you're guaranteed the model reads, so it's prime real estate.
2. **The agent can open any file on demand.** It doesn't need everything pre-loaded; it follows a
   link or a filename and reads what the task needs, when the task needs it.

So the design question isn't "how do I cram everything in?" It's "**how do I shape the documents so
the agent lands on the truth, and loads only the truth it needs?**"

## The technique: an index that points to a tree

The root file is an **index, not an encyclopedia.** It holds the stable spine — locked decisions,
conventions, the one-paragraph "what this is" — and then *points* to topic docs that live in their
own files:

```
CLAUDE.md            ← auto-loaded. Small. Stable facts + links out.
  ├─ docs/routes.md            ← the URL/route map
  ├─ docs/product-decisions.md ← identity & policy decisions
  ├─ docs/brand-and-voice.md   ← naming, language, copy voice
  ├─ docs/deployment.md        ← infra & CI/CD
  └─ docs/devlog.md            ← what shipped, newest first
```

This buys two things that matter on every single turn:

- **Context-window savings.** The always-loaded root stays small. You are *not* paying tokens to
  carry the routing table, the brand guide, and the deploy runbook into a session that's editing one
  component. The big stuff stays on disk.
- **Lazy loading.** The agent pulls `brand-and-voice.md` only when it's writing copy, `routes.md`
  only when it's touching routing. Relevance is decided at read-time, by the task — not pre-loaded
  by guesswork. A bigger project just grows more leaves; the root (and the per-turn cost) stays flat.

The root's job is to be a small, trustworthy map. The moment it tries to *contain* everything, it
gets too big to keep correct — which is the failure I opened with.

## Two tiers: keep the references current, keep the history

Here's the part most setups miss: **not every doc should be kept up to date — and that's on
purpose.**

There are two kinds of project documents, and conflating them is what poisons the well:

- **Maintained docs** (the root file + the topic docs it links): these are the *source of truth*.
  They must match the code. When a feature changes a decision, its doc changes in the same breath.
  These are what the agent is told to trust.
- **Historical docs** (per-milestone specs, plans, and the dev log): these are the *record of how we
  got here*. They are **allowed to go stale** — a spec is a snapshot of the thinking at the time, not
  a promise about today.

You want both. Throwing away the history loses the *why* behind decisions; treating the history as
current is exactly how a six-month-old brainstorm starts dictating today's build. The fix is to
**label the tiers explicitly** so the agent knows which is which — *trust the maintained docs; the
specs are a paper trail, never cited as current.*

The dev log is the elegant resolution of the tension: it's **append-only history that's also
always current**, because "newest entry on top" is true forever. You get the development story and
today's state from the same file, without either lying.

## The rule that does the most work: one fact, one place

The single highest-leverage habit. A fact stated in two documents is a fact that *will* eventually
disagree with itself.

So the root file deliberately **does not** restate "what version we're on" or "what's next" — the
two fastest things to drift. It says instead: *current state is the top row of the dev log; the
roadmap is `todo.md`.* Each fact has exactly one home, and everything else links to it.

## The disciplines that keep it honest

A structure doesn't stay true on its own. Three habits do the real work:

- **Migrate before you retire.** Before demoting milestone specs to "historical," I had an agent
  audit them for any still-current decision that lived *only* there, and moved those into the
  maintained docs first. De-referencing without auditing is how you silently lose real decisions.
- **Review with fresh eyes, not the eyes that built it.** The agent that wrote the code is primed to
  think the docs are fine — it remembers the intent, so it reads the intent *into* the words. A
  fresh-context reviewer reads what's actually written. That's the agent that caught the three lies.
- **Capture conventions so sessions inherit them.** Naming, voice, the release flow, "escape user
  input even when you render it verbatim" — written once, every future session starts knowing them
  instead of relearning (or violating) them.

## What it costs

It isn't free. You pay an upkeep tax: a change that touches a decision has to touch the doc that
records it, in the same change. The two-tier split takes judgment — label something "historical" too
early and you bury a decision that's still live. And this is one project's experience, not a
benchmark; take it as a case study, not a law.

But the alternative is the thing I opened with: foundation docs that quietly lie to every session,
and you don't find out until something built on the fiction breaks.

## The takeaway

For agentic coding, your most important artifact might not be the code — it's the **small set of
documents your agent wakes up to.** Give it a tree, not a pile: a small, trustworthy root that lazy-
loads the rest; maintained docs that stay true and historical docs that stay honestly historical;
every fact in exactly one place.

And every so often, send in an agent that doesn't trust you — and let it tell you where your context
is lying.
