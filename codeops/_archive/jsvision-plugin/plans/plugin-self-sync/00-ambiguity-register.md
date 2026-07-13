# Ambiguity Register: plugin-self-sync (PL-02)

> **Feature**: jsvision-plugin · **Plan**: plugin-self-sync · **CodeOps Skills Version**: 3.3.2
> **Status**: ✅ GATE PASSED — all items resolved with explicit user decisions (2026-07-11)

This register is the audit trail for every design/scope/behavior decision behind the plugin-self-sync
plan. Every row is `✅ Resolved`; the user confirmed the complete set before any plan document was
written. Decisions tagged `(session)` were made in the planning conversation; `(runtime)` entries, if
any, are appended during execution.

## Resolved items

| # | Category | Question | Decision | By |
|---|----------|----------|----------|----|
| AR-1 | Architecture | How automated is the self-updater in v1? | **Hybrid** — build the local path now (deterministic detector + a Claude skill + an API script) and scaffold the CI workflow as **documented-but-disabled** (no secret, manual trigger only). Delivers value immediately without committing the currently secret-free CI to an AI bot. | user (session) |
| AR-2 | Scope | Which content deltas can v1 auto-fix? | Two, each keyed to a deterministic finding the gate already emits: an **undocumented `@jsvision/ui` widget** → a drafted `component-catalog.md` entry, and a **drifted recipe snippet** → a re-synced code block. | user (session) |
| AR-3 | Scope | Does snippet re-sync use AI? | **No** — re-syncing a snippet is copying the source module's marked region into the `.md`; it is fully deterministic. AI is reserved for the one step that genuinely needs drafting (the catalog entry). | user (session) |
| AR-4 | Architecture | How is the AI catalog-entry drafting invoked? | **Both** a manual `jsvision-plugin-sync` Claude Code skill (local, no API key, dev-in-loop) **and** a `yarn plugin:sync` Anthropic-API script (the automatable path the disabled CI workflow calls). Both consume one shared deterministic detector and one shared catalog-entry request spec; only "who calls the model" differs. | user (session) |
| AR-5 | Dependencies | Branch strategy relative to PL-01 (unmerged when planning began)? | **Merge PL-01 to master first**, then build plugin-self-sync fresh off master. Done — PL-01 shipped via squash-merge (PR #57); this plan lives on `feat/plugin-self-sync`. | user (session) |
| AR-6 | Design | Where does the structured drift detector live? | **Extend `scripts/check-plugin.mjs`** with a structured `detectDrift()` returning typed findings (`{kind:'undocumented-widget', name}` / `{kind:'snippet-drift', module}`), beside the existing `runAllChecks()` — one source of truth. The deterministic snippet `--fix` lives here too, reusing `extractRegion`/`DRIFT_PAIRS`/`extractUiClassExports`. | user (session, recommended default confirmed) |
| AR-7 | Design | How is the model call structured so both paths share logic and tests never hit the network? | A shared **pure "catalog-entry request builder"** reads the target widget's exported-class JSDoc + `@example` (via the existing TS-compiler extractor) and produces the request (system/user prompt + the exact catalog-bullet target). The API script's Anthropic call sits behind an **injected client seam** so unit tests pass a fake — no real API calls, no key in CI. | user (session, recommended default confirmed) |
| AR-8 | Security/Ops | What does the disabled CI workflow look like? | A `plugin-self-sync.yml` gated on **`workflow_dispatch` only** (manual, never auto-fires), referencing **no secret** by default, with a README section on how to enable it later (add `ANTHROPIC_API_KEY`, add a trigger, open a PR a human approves). Keeps `ci.yml`'s secret-free guarantee and `check:deps` green. | user (session, recommended default confirmed) |
| AR-9 | Dependencies | Where does the Anthropic SDK dependency live? | `@anthropic-ai/sdk` as a **devDependency of the root/plugin tooling only** (pure-JS, no native binaries → `check:deps` unaffected). It is **never** a dependency of any published package (`@jsvision/core`) or of the private SDK packages. | user (session, recommended default confirmed) |
| AR-10 | Testability | How is a non-deterministic AI step spec-tested? | Spec tests assert the deterministic scaffolding only: `detectDrift()` emits the right delta on seeded drift; the deterministic `--fix` greens a drifted snippet; the API script calls the **injected fake client** with the correct request, writes the entry to the right place, and is rejected when `yarn verify` would fail. **No real LLM call in any test.** | user (session, recommended default confirmed) |
| AR-11 | Naming | Canonical names? | Skill `jsvision-plugin-sync`; script `yarn plugin:sync` with a deterministic `--fix` mode; detector export `detectDrift`. The verify command is unchanged: `yarn verify`. | user (session, recommended default confirmed) |
| AR-12 | Design | Command semantics of `yarn plugin:sync`? | `yarn plugin:sync --fix` = **deterministic only** (snippet re-sync; no AI, no key). `yarn plugin:sync` (no flag) = the API path: apply deterministic fixes **and** draft catalog entries for undocumented widgets via the injected Anthropic client (requires a key at runtime). Both print a summary and leave changes unstaged for human review. | user (session, runtime detail under AR-4) |
| AR-13 | Behavior | Does the AI output ever land without a human? | **Never.** The skill edits `component-catalog.md` in-session for the dev to review before committing; the script writes the entry but does not commit; the CI path (when enabled) opens a PR a human approves. Approving is not editing — the reviewer reads the drafted prose. | user (session, governance under AR-1) |
| AR-14 | Behavior | Hallucination guard for the drafted catalog entry? | The request builder feeds the widget's **actual** JSDoc lead sentence + `@example` only, and instructs a single catalog-style bullet grounded in that text — no invented behavior. The `check-plugin` barrel-coverage gate then confirms the entry exists; the human confirms it is accurate. | user (session, under AR-7) |
| AR-15 | Scope boundary | What is explicitly OUT of v1? | Agentic recipe repair (an AI agent loop fixing a recipe broken by an API change) — deferred. Proactive refresh of prose references with **no** deterministic drift signal (gotchas, lifecycle text). Auto-firing CI and any wired secret. Auto-commit of AI output. | user (session) |
| AR-16 | Consistency | Verify command + where the new tests run? | `yarn verify` (unchanged). New unit specs live in `packages/examples/test/` (the `unit` project), matching PL-01's `check-plugin.spec.test.ts` precedent (cross-root import of `scripts/*.mjs`). | user (session, confirmed) |

## Category sweep (12 categories — no unresolved items)

Ambiguities, Assumptions, Contradictions, Completeness, Dependencies, Feasibility, Testability,
Security, Edge Cases, Scope Creep, Ordering, Consistency — all hunted; every surfaced item is one of
AR-1…AR-16. Security received particular attention (AR-8/AR-9/AR-13/AR-15: no wired secret, no native
dep, no auto-commit, human-in-the-loop by construction). No item deferred.
