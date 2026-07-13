# Plan: plugin-self-sync (PL-02)

> **Feature**: jsvision-plugin · **Implements**: jsvision-plugin/PL-02 (standalone plan, no upstream RD)
> **CodeOps Skills Version**: 3.3.2 · **Status**: Plan Created · **Created**: 2026-07-11

An AI-assisted self-updater that keeps the `jsvision-plugin` content in sync when the `@jsvision/ui`
SDK changes — without manual authoring. It builds directly on PL-01's Tier-0 gate
(`scripts/check-plugin.mjs`), turning each deterministic drift finding into either a **free
deterministic fix** (recipe snippet re-sync) or a **narrowly-scoped AI draft** (a component-catalog
entry for a newly-exported widget), always behind `yarn verify` and always human-reviewed.

## The shape

```
detect (deterministic)         fix
──────────────────────         ─────────────────────────────────────────────
snippet drift          ──────▶ deterministic --fix (copy source region → .md)   [no AI]
undocumented widget    ──────▶ draft a catalog entry from the widget's JSDoc     [AI]
                                 · local:  /jsvision-plugin-sync  (Claude skill, no key)
                                 · script: yarn plugin:sync       (Anthropic API, injected client)
                                 · CI:     plugin-self-sync.yml    (workflow_dispatch only, disabled)
```

Every AI output is gated by `yarn verify` (the check-plugin barrel-coverage gate confirms the entry
exists) and reviewed by a human before it lands. The detector never pays an LLM; the LLM never runs
on the blocking verify path.

## Documents

- [00-ambiguity-register.md](00-ambiguity-register.md) — Zero-Ambiguity Gate (✅ passed, AR-1…AR-16)
- [01-requirements.md](01-requirements.md) — requirements and scope
- [02-current-state.md](02-current-state.md) — what PL-01 already provides + the CI/security context
- [03-01-detector-and-fix.md](03-01-detector-and-fix.md) — structured `detectDrift()` + deterministic snippet `--fix`
- [03-02-generation-and-skill.md](03-02-generation-and-skill.md) — the shared catalog-entry request builder + the `jsvision-plugin-sync` skill
- [03-03-api-script-and-ci.md](03-03-api-script-and-ci.md) — the `yarn plugin:sync` API script + the disabled CI workflow
- [07-testing-strategy.md](07-testing-strategy.md) — specification test cases (ST-*)
- [99-execution-plan.md](99-execution-plan.md) — phases, tasks, verify

## Verify

`yarn verify` (unchanged — lint + turbo typecheck/build/test/check:docs + `node scripts/check-plugin.mjs`).
New unit specs live in `packages/examples/test/` (AR-16).
