# Testing Strategy: Cross-Platform Function Keys

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

The strategy treats terminal bytes and browser keyboard events as untrusted protocol input. It
tests canonical output at each boundary, exact event counts across integrations, and identity
behavior outside the allowlist.

### Coverage Contract

Coverage is behavior-based: every ST case, accepted mapping row, invalid grammar family, modifier
boundary, integration route, and regression named below must have an executable assertion. No new
percentage-coverage tooling or threshold is introduced.

Test names state behavior as `should [expected behavior] when [condition]`. Existing real decoder,
host, event-loop, application, and fake-terminal harnesses are preferred over mocks.

## 🚨 Specification Test Cases

> These cases derive exclusively from `01-requirements.md`, the component specifications, and the
> confirmed Ambiguity Register. They are immutable oracles: implementation must change to satisfy a
> failing expectation.

### Terminal Decoder

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | Existing SS3 `ESC O P…S` and numeric-tilde `ESC [ 11~…24~` fixtures | Exactly the existing canonical F1–F12 events; no regression | R1; 03-01 |
| ST-2 | CSI `ESC [ P`, `Q`, `R`, `S` | Exactly one unmodified F1, F2, F3, F4 event respectively | R1; 03-01 §Classification Rules |
| ST-3 | CSI `ESC [ 1;2P`, `1;3Q`, `1;5R`, `1;6S` | F1+Shift, F2+Alt, F3+Ctrl, F4+Ctrl+Shift respectively | R2; AR-4; 03-01 |
| ST-4 | Linux-console `ESC [[ A`, `B`, `C`, `D`, `E` | Exactly one unmodified F1–F5 event respectively, with no printable leakage | R1, R8; 03-01 |
| ST-5 | Kitty CSI-u identifiers 57364 through 57375, unmodified | Exactly one unmodified F1–F12 event in ascending order | R1; AR-4, AR-8; 03-01 |
| ST-6 | Kitty `CSI 57373;5u` | Exactly one Ctrl+F10 event | R2; 03-01 |
| ST-7 | Unknown/F13 CSI-u id; private/colon/empty/extra/intermediate parameter syntax; oversized decimal; legacy modifier 0/17; CSI-u modifier 0/9; Linux-console unknown final | No key event; complete input consumed; no printable leakage | R8; AR-8, AR-9; 03-01 |
| ST-8 | Each new accepted family split after every byte boundary | Same single event as contiguous input; no retained rest after completion | R8; 03-01 |

### Fallback Policy and UI

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-9 | `'number-row'` with Alt+`1…9,0,-,=` | Exactly F1–F12 respectively; modifiers false and codepoint absent | R3; AR-2, AR-4; 03-02 |
| ST-10 | Bare event loop or explicit `'none'` with every approved alias chord | Every original event remains observably unchanged | R4; AR-7; 03-02 |
| ST-11 | `'number-row'` with Ctrl+Alt candidate, Shift+Alt candidate, plain number, non-key event, or unrelated Alt character | Input remains observably unchanged | R3, R8; 03-02 |
| ST-12 | Event loop explicitly using `'number-row'`, with a keymap binding for `f1`; dispatch Alt+1 | The F1 command fires once and raw Alt+1 does not reach the focused view; command events remain unchanged | R3, R4; 03-02 §Routing Order |
| ST-13 | Application menu receives Alt+0 under default policy | The same first menu opens as physical F10, once | R3, R4; 03-02 |
| ST-14 | Accelerator reveal uses default F12; dispatch Alt+= | Accelerator mode toggles exactly as physical F12 | R3, R4; 03-02 |

### Browser Integration

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-15 | Focused browser terminal custom hook receives F1 and Ctrl+Shift+F12 `keydown` | One canonical event per key with physical modifiers retained; default/propagation prevented; handler returns false | R1, R2, R6; AR-5; 03-03 |
| ST-16 | Custom hook receives exact Alt-only `Digit1…Digit0`, `Minus`, `Equal` codes, then application-default and `'none'` policies consume them | Raw literal Alt chords are dispatched once from physical codes; the application maps them to F1–F12 by default and preserves them under `'none'` | R3, R4, R6; AR-5, AR-7; 03-03 |
| ST-17 | Minimal/headless terminal lacks the custom hook and emits existing F10 bytes through `onData` | Existing byte path emits one canonical F10 and mounting remains valid | R7; 03-03 |
| ST-18 | DOM terminal handles physical F10 through the hook and is capable of emitting bytes; hook also receives keyup, repeat, Meta+F, `F13`, malformed name, ordinary input, and composed downstream handlers returning true/false | Physical F10 produces one action, never two and is not delegated; excluded inputs produce no direct event and preserve the downstream result (or return true when absent) | R6, R8; 03-03 §Reclaim Coordination |

### Documentation and Distribution

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-19 | Public API/doc/plugin generation and drift checks after source/docs updates | New option/types and guidance are present; generated copy is synchronized; checks exit zero | R9; AR-10; 03-04 |
| ST-20 | Full project verification | `yarn verify` exits zero with no regressions | Acceptance Criteria 5; AR-10 |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
|-----------|------------------|-----------|
| `packages/core/test/input-function-keys.spec.test.ts` | ST-1…ST-8 | Decoder |
| `packages/ui/test/function-key-fallback.spec.test.ts` | ST-9…ST-14 | UI policy |
| `packages/web/test/function-keys.spec.test.ts` | ST-15…ST-18 | Browser |
| Feature-owned UI/web packaging specs plus the examples xterm contract | Public type and real-consumer compatibility | Packaging |
| Existing validation commands | ST-19, ST-20 | Distribution |

### Implementation Tests

| Test File | Description | Priority |
|-----------|-------------|----------|
| `packages/core/test/input-function-keys.impl.test.ts` | Invalid shapes, exhaustive split points, unknown ids, bounds | High |
| `packages/ui/test/function-key-fallback.impl.test.ts` | Identity/reference behavior, option edges, dispatch ordering internals | High |
| `packages/web/test/function-keys.impl.test.ts` | Hook lifecycle/ownership, downstream composition, alias codes, repeat/Meta/keyup pass-through, no duplicate paths | High |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Native application fallback | Decoder → event loop → menu/accelerator | Alt+0 and Alt+= reach canonical UI behavior |
| Browser application function key | xterm hook → browser host → event loop → menu | Direct F10 opens the menu exactly once; aliases map or preserve according to application policy |
| Headless browser compatibility | `TerminalLike` → `onData` → decoder | Optional DOM hook does not break headless mounting |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Native fallback | Run a representative shell app; press physical F10 then Alt+0 | Both invoke the same action; no duplicate event |
| Browser fallback | Run `codeops/features/function-keys/evidence/browser-smoke.md` against the web example in Chromium and Firefox: physical F1/F10/F12, Alt+1/0/-/=, `'none'`, repeat, and Meta | Record date, OS, browser versions, and per-case results; actions remain accessible, literal opt-out is preserved, direct presses emit once, and excluded inputs stay on the prior path |

## Test Data

### Fixtures Needed

- Byte literals for CSI/SS3/Linux-console/CSI-u families.
- Table-driven alias/key outputs.
- Existing fake timer, fake native input, and fake xterm terminal extended with an optional custom
  key-event handler.

### Mock Requirements

Only the browser `KeyboardEvent` boundary and terminal hook are faked. Core decoder and event-loop
objects remain real.

## Verification Checklist

- [ ] All ST cases have concrete input/output pairs and source references.
- [ ] Specification tests are written before implementation and confirmed red.
- [ ] Existing specification oracles are not weakened.
- [ ] Green phase fixes implementation only.
- [ ] Implementation tests cover invalid and boundary input.
- [ ] Focused package tests pass.
- [ ] Plugin update/check pass.
- [ ] `yarn verify` passes.
