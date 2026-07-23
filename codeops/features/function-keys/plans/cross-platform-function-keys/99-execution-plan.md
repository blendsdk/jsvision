# Execution Plan: Cross-Platform Function Keys

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-23 16:45
> **Progress**: 0/26 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Extend the terminal grammar, introduce UI-level number-row normalization, add direct xterm.js
physical-key handling, then synchronize public documentation and plugin material.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|------:|-------|------:|
| 1 | Terminal decoder compatibility | 6 |
| 2 | UI fallback policy | 7 |
| 3 | Browser physical-key integration | 7 |
| 4 | Documentation and distribution | 6 |

**Total: 26 tasks across 4 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the single source of truth for progress. Every
> task line appears exactly once. The executing agent MUST:
>
> 1. On implementation, mark the task `[~]` with an actual timestamp.
> 2. On verification pass, promote it to `[x]` with the completion timestamp.
> 3. Update the Progress header and Last Updated stamp after every task; only `[x]` counts.
> 4. Resume the first `[~]` task, otherwise the first `[ ]` task, scanning top-to-bottom.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. A failing specification test is an implementation
> defect; executors must never weaken its expectation.

---

## Phase 1: Terminal Decoder Compatibility

### Step 1.1: Specification Tests

**Reference**: `03-01` · ST-1…ST-8 · AR-4, AR-8, AR-9
**Objective**: Establish immutable byte-to-key oracles for every accepted and rejected family.

- [ ] 1.1.1 [spec-author] Add ST-1…ST-8 as table-driven specification tests — `packages/core/test/input-function-keys.spec.test.ts`
- [ ] 1.1.2 Add representative contiguous and split fixtures without duplicating the entire table — `packages/core/test/fixtures/input-corpus/keyboard.json`
- [ ] 1.1.3 Run the focused core specification/corpus tests and confirm new accepted forms fail while existing forms remain green (red phase)

### Step 1.2: Implementation

**Reference**: `03-01 §Implementation Details` · AR-4, AR-8, AR-9
**Objective**: Extend the bounded decoder grammar without changing existing event shapes.

- [ ] 1.2.1 Implement structured raw CSI validation, CSI F1–F4, Linux-console F1–F5, and strict CSI-u F1–F12 classification — `packages/core/src/engine/input/keys.ts`
- [ ] 1.2.2 Run focused core specification/corpus tests and make ST-1…ST-8 green without changing their expectations

### Step 1.3: Implementation Tests and Hardening

**Reference**: `07-testing-strategy.md §Implementation Tests`

- [ ] 1.3.1 Add private/colon/empty/intermediate/oversized grammar, exact modifier-boundary, invalid id/final, and exhaustive split-point coverage — `packages/core/test/input-function-keys.impl.test.ts`

**Deliverables**:

- Decoder accepts the bounded interoperable F1–F12 grammar.
- Malformed/out-of-scope sequences do not leak printable keys.

**Verify**: Review the core-engine plugin-impact references, run `yarn plugin:update`,
`yarn plugin:check`, then `yarn verify`.

---

## Phase 2: UI Fallback Policy

### Step 2.1: Specification Tests

**Reference**: `03-02` · ST-9…ST-14 · AR-2, AR-3, AR-4, AR-7
**Objective**: Define the complete mapping, opt-out, and routing order before implementation.

- [ ] 2.1.1 [spec-author] Add ST-9…ST-14 mapping and UI integration oracles — `packages/ui/test/function-key-fallback.spec.test.ts`
- [ ] 2.1.2 Run the focused UI test and confirm alias expectations fail (red phase)

### Step 2.2: Implementation

**Reference**: `03-02 §Public Contract` and `§Pure Normalizer` · AR-2, AR-7

- [ ] 2.2.1 Add the typed policy and pure allowlist normalizer — `packages/ui/src/event/function-key-fallback.ts`
- [ ] 2.2.2 Keep bare event loops default-off, narrow key events before normalization, normalize once before routing, and expose the option/type — `packages/ui/src/event/event-loop.ts`, `packages/ui/src/event/types.ts`, `packages/ui/src/event/index.ts`
- [ ] 2.2.3 Default application shells to number-row fallback and document the opt-out — `packages/ui/src/app/application.ts`
- [ ] 2.2.4 Run focused UI specification tests and make ST-9…ST-14 green without changing their expectations

### Step 2.3: Implementation Tests and Hardening

- [ ] 2.3.1 Add identity, modifier-collision, and dispatch-order edges — `packages/ui/test/function-key-fallback.impl.test.ts`

**Deliverables**:

- Application shells default to number-row fallback; bare event loops remain compatibility-default off.
- `'none'` preserves literal Alt chords.
- Keymap, menu, accelerator, and view routing see one canonical event.

**Verify**: Review the UI app/event plugin-impact references, run `yarn plugin:update`,
`yarn plugin:check`, then `yarn verify`.

---

## Phase 3: Browser Physical-Key Integration

### Step 3.1: Specification Tests

**Reference**: `03-03` · ST-15…ST-18 · AR-5, AR-6
**Objective**: Define physical and alias direct handling, pass-through, headless, and no-duplicate browser behavior.

- [ ] 3.1.1 [spec-author] Add ST-15…ST-18 browser-host and mount oracles — `packages/web/test/function-keys.spec.test.ts`
- [ ] 3.1.2 Extend the fake terminal with an optional custom-key hook through real structural behavior — `packages/web/test/helpers/fake-terminal.ts`
- [ ] 3.1.3 Run focused web tests and confirm direct interception expectations fail while byte fallback remains green (red phase)

### Step 3.2: Implementation

**Reference**: `03-03 §Structural Types` and `§Direct Function-Key Handling` · AR-5

- [ ] 3.2.1 Add the optional narrow key-event hook, singleton ownership/downstream composition, direct F1–F12 handling, exact physical alias-code dispatch, and repeat/Meta pass-through — `packages/web/src/host.ts`
- [ ] 3.2.2 Extract only shared F1–F12 classification while preserving every unrelated reclaim behavior — `packages/web/src/key-reclaim.ts`
- [ ] 3.2.3 Wire browser mounting/lifecycle as required and make ST-15…ST-18 green — `packages/web/src/mount.ts`

### Step 3.3: Implementation Tests and Hardening

- [ ] 3.3.1 Add hook ownership/composition, keyup, repeat, Meta, malformed-name, alias-code, modifier, hook-absence, unrelated-reclaim, and duplicate-path tests — `packages/web/test/function-keys.impl.test.ts`

**Deliverables**:

- DOM xterm.js physical F-keys bypass byte-encoding variance.
- Minimal/headless terminals retain the existing path.
- One physical press produces one action.

**Verify**: Review the web plugin-impact references, run `yarn plugin:update`,
`yarn plugin:check`, then `yarn verify`.

---

## Phase 4: Documentation and Distribution

### Step 4.1: Validation Oracles

**Reference**: `03-04` · ST-19, ST-20 · AR-6, AR-7, AR-10

- [ ] 4.1.1 [spec-author] Add feature-owned UI/web public packaging oracles and a real `@xterm/xterm` consumer contract in the examples workspace; do not modify unrelated immutable accelerator tests
- [ ] 4.1.2 Run focused packaging/doc checks and confirm stale generated/public assertions fail (red phase)

### Step 4.2: Documentation and Generation

- [ ] 4.2.1 Update consumer keyboard guidance, troubleshooting heuristics, API JSDoc, relevant skill references, the root and impacted core/UI/web changelogs, and the named Chromium/Firefox smoke checklist — `packages/docs-site/guide/keyboard-and-clipboard.md`, `packages/core/CHANGELOG.md`, `packages/ui/CHANGELOG.md`, `packages/web/CHANGELOG.md`, `CHANGELOG.md`, `tools/jsvision-skill/references/`, `codeops/features/function-keys/evidence/browser-smoke.md`
- [ ] 4.2.2 Review the exact deduplicated plugin-impact set (including architecture, theming, gotchas, app-lifecycle, and web API where reported), run `yarn plugin:update`, and retain owned generated changes — `tools/jsvision-plugin-impact.json`, `plugins/jsvision-plugin/skills/jsvision/`

### Step 4.3: Browser Evidence and Final Hardening

- [ ] 4.3.1 Execute the named smoke checklist in Chromium and Firefox against the web example; record date, OS, browser versions, and per-case pass results — `codeops/features/function-keys/evidence/browser-smoke.md`
- [ ] 4.3.2 Run `yarn plugin:check`, then the authoritative `yarn verify`; resolve every failure without weakening specification oracles

**Deliverables**:

- Public documentation explains aliases, opt-out, and physical-capture limits.
- Generated plugin material is synchronized.
- Full repository verification passes.

**Verify**: `yarn verify`

---

## Dependencies

```text
Phase 1: canonical physical keys
    ↓
Phase 2: canonical fallback policy
    ↓
Phase 3: browser direct source
    ↓
Phase 4: public contract and generated distribution
```

## Success Criteria

1. All 26 tasks are verified.
2. ST-1…ST-20 pass without weakened expectations.
3. Existing keyboard, event-loop, application, menu, accelerator, web host, mount, fuzz, and
   hardening tests remain green.
4. No dead code or unbounded input handling is introduced.
5. Public docs and changelogs state the compatibility impact and opt-out.
6. `yarn plugin:check` and `yarn verify` pass.
7. The committed Chromium/Firefox evidence record contains environment details and passing results.
8. Post-completion project re-analysis is performed by the exec-plan workflow.
