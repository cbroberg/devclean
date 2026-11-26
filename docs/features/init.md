# Init — adopting `devclean` into cardmem

> Auto-written by `cardmem_initialize_project` when this project was linked.
> Documents the one-time onboarding epic; the per-repo cc session executes it.

## Purpose

Bring this project's cardmem board in sync with what the repo actually
contains. No server-side LLM — all reasoning happens in the local cc session,
which has full filesystem + git context. cardmem-cloud does not.

## Three branches

`init.1` inspects the repo and picks exactly one branch:

- **Branch A** (`init.2`) — the repo already has `docs/features/F<n>-*.md`
  plan-docs → adopt each as a real card, classifying status (done /
  in-progress / planned) from code + git log.
- **Branch B** (`init.3`) — no F-docs but a `docs/PLAN.md` (or prose spec)
  exists → cut it into epics, draft customer journeys, STOP for the owner's
  approval, then cut the approved journeys into stories (AC = the steps'
  given/when/then), and last the technical stories no journey covers.
- **Branch C** (`init.4`) — nothing exists → bootstrap a draft `docs/PLAN.md`
  for human review; Branch B runs after it's merged.

The two un-run branches are archived in `init.5`.

## Sub-stories

- **init.1** — Detect existing plan-docs, pick the branch.
- **init.2** — Branch A: adopt each F-doc as a card.
- **init.3** — Branch B: epics → journeys → owner approval → stories.
- **init.4** — Branch C: bootstrap a draft PLAN.md.
- **init.5** — Mark Init done; archive un-run branches; stamp `init_completed_at`.
- **init.6** — Terms/GDPR: legal documents + ProductFacts, mandatory for every project (F060.3).

## Guardrails

- Never call `cardmem_bulk_import_f_docs` — it only creates shallow stubs
  (the tool that caused the 2026-05-28 disaster). Build real
  role/task/constraints/AC per card from reading the plan-doc + code.
- Ask the user whenever status, scope, or dependencies are ambiguous — never guess.

## The product's lifecycle — where this project is headed

Init gets the project onto the board. The product then lives through twelve stages,
from the first idea to supporting its users and learning from them. Know them, so the
work you plan now fits where the product is going.

1. Idea — the Inbox (mail rules, webhooks, the daily inbox sweep), Notes, pins.
2. Discovery — Interview and Scope meetings (recording → minutes → plan). If this
   project has an interview report or a Scope plan, it is INPUT to the journeys.
3. Journey — 3–10 customer journeys (cardmem_save_journey), open questions answered
   by the owner, approved on /journeys. Nothing is cut before approval.
4. Design — mock up a journey step (cardmem_save_mockup, linked to the step) before
   building its UI; the owner or customer signs it off (portal).
5. Plan / Board — cardmem_cut_journey turns approved journeys into stories with AC;
   technical stories no journey covers get their own AC.
6. Build Contract — /contracts: everything the build needs (keys, DNS records, R2,
   permissions, owner-only steps, last questions) listed once and SIGNED by the owner;
   the signature issues what it names and sends ONE GO to the build agent. Missing
   something the contract does not name? POST /api/build-contracts/<id>/request — an
   amendment the owner signs, never a mid-build stop to ask.
7. Build ⇄ Test — ONE station: pick up a card, build it, hand it off (queue-drain picks
   up Ready cards); Lens proves it in a real browser and the auto-review gate decides Done.
8. CI/CD — NOT YET BUILT in cardmem (F369: see which commit is live, Done = running).
   Meanwhile: a green gate deploys in the same turn, and you verify on production.
9. Launch — release notes, documentation, landing page, customer portal. Documentation
   is written by the Docs project (AutoDoc) and must match the build that is live.
   Release notes and landing pages are NOT YET BUILT (F370) — ask the owner what the
   launch needs.
10. Operate — Upmetrics catches errors and incidents (enroll this repo); incidents
    land in the Inbox.
11. Support — NOT YET BUILT (F371: HelpDesk.broberg.ai answers users, their questions
    come back as Inbox signal). Meanwhile: customer messages arrive via the portal.
12. Learn — the lessons engine is NOT YET BUILT (F372). Meanwhile: the owner's settled
    choices go to the Decision Register (cardmem_propose_decision), and rationale and
    diagnoses to Trail.

The loop closes: what users ask and what breaks becomes the next idea (stage 1).

## Done when

The chosen branch is in Done, the two un-run branches are archived, and
`init_completed_at` is set in project settings.
