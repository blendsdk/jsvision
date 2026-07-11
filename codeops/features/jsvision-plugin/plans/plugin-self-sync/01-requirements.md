# Requirements: plugin-self-sync (PL-02)

> **Feature**: jsvision-plugin · **Plan**: plugin-self-sync · Standalone plan (no upstream RD — this
> document owns the requirements). See [00-ambiguity-register.md](00-ambiguity-register.md) for the
> decision trail (AR-*).

## Problem

The `jsvision-plugin` content (the `component-catalog.md` widget list, the embedded recipe snippets)
must stay truthful as `@jsvision/ui` evolves. PL-01 already makes drift **loud**: `check-plugin.mjs`
turns `yarn verify` red when a new widget is undocumented (barrel-coverage) or a recipe snippet
diverges from its source module (snippet-drift). We just experienced this first-hand — the merge of
`flexible-chrome-bars` added `StatusItemView`, and the gate correctly went red until it was
documented by hand.

PL-02 removes the **manual authoring** from that loop: it converts each deterministic finding into an
automatic fix (free where the fix is mechanical, AI-drafted where it needs prose), always
verify-gated and human-reviewed.

## In scope (AR-2, AR-3, AR-4)

- **FR-1 — Structured detection.** A `detectDrift()` that returns typed, machine-readable findings
  (`undocumented-widget` with the class name; `snippet-drift` with the recipe module) derived from
  the same checks `check-plugin.mjs` already runs. (AR-6)
- **FR-2 — Deterministic snippet fix.** A `--fix` mode that re-syncs each drifted recipe snippet by
  copying its source module's `#region example` into the owning `.md`. No AI. (AR-3)
- **FR-3 — Catalog-entry drafting (AI).** For an undocumented widget, draft a single
  `component-catalog.md` bullet grounded in that widget's exported-class JSDoc lead sentence +
  `@example`, via two invocation paths that share one request spec (AR-7):
  - **FR-3a — Local skill.** A `jsvision-plugin-sync` Claude Code skill the developer runs; it drafts
    the entry in-session (no API key) and the developer reviews before committing.
  - **FR-3b — API script.** `yarn plugin:sync` calls the Anthropic API (via an injected client) to
    draft the same entry; used by automation.
- **FR-4 — Verify gate.** Every produced change is validated by `yarn verify`; the barrel-coverage /
  snippet-drift checks confirm the fix actually resolves the finding. AI output is never on the
  blocking verify path — it is *checked by* verify, not *run during* it. (AR-1, AR-10)
- **FR-5 — CI-ready, disabled.** A `plugin-self-sync.yml` workflow gated on `workflow_dispatch` only,
  referencing no secret, with documented steps to enable it later (add `ANTHROPIC_API_KEY`, add a
  trigger, open a PR). (AR-8)
- **FR-6 — Human-in-the-loop governance.** No AI output ever auto-commits. Local: the dev reviews the
  edit. CI (when enabled): a PR a human approves. (AR-13)

## Out of scope (AR-15)

- Agentic recipe **repair** (an AI agent loop fixing a recipe module broken by an API change).
- Proactive refresh of references with **no** deterministic drift signal (gotchas text, lifecycle
  prose) — nothing detects their staleness, so nothing auto-edits them.
- Auto-firing CI, any wired secret, or auto-commit of AI output.

## Success criteria (definition of done)

- **SC-1** `detectDrift()` returns exactly the set of typed findings for a seeded-drifted tree and an
  empty array for the clean tree. (ST-1, ST-2)
- **SC-2** `yarn plugin:sync --fix` re-syncs a drifted recipe snippet so `check-plugin` goes green,
  and is a no-op on a clean tree. (ST-3, ST-4)
- **SC-3** The pure catalog-entry request builder produces a grounded, correctly-targeted request
  from a widget's JSDoc + `@example`. (ST-5)
- **SC-4** The API script, given an **injected fake client**, drafts + writes a catalog entry for an
  undocumented widget that makes barrel-coverage pass, and never calls the network in tests. (ST-6,
  ST-7)
- **SC-5** The `jsvision-plugin-sync` skill exists, validates (`claude plugin validate`), and its
  SKILL.md documents the detect → draft → review → verify loop. (ST-8)
- **SC-6** `plugin-self-sync.yml` is `workflow_dispatch`-only, references no secret, and the README
  documents the enable path; `yarn check:deps` stays green with `@anthropic-ai/sdk` present. (ST-9,
  ST-10)
- **SC-7** Full `yarn verify` green, including a new `plugin-sync.spec.test.ts` in
  `packages/examples/test/`.

## Constraints

- Reuse PL-01's machinery (`extractRegion`, `DRIFT_PAIRS`, `extractUiClassExports`, `CATALOG_DENYLIST`)
  — do not duplicate barrel/region logic. (AR-6)
- `@anthropic-ai/sdk` is a tooling **devDependency** only; pure-JS; never in a published/SDK package.
  (AR-9)
- No raw network in tests; the model client is an injected seam. (AR-10)
