# Testing Strategy: Global Clipboard & Selection

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (default keymap merge, buffer seam, widget command wiring) | 90% |
| Glue (app option threading, barrel exports) | 80% |
| Kitchen-sink story | smoke only (mounts + paints) |

- Test names state behavior: `should [expected] when [condition]`.
- Tests use `expect()` (vitest `unit` project). Widget tests construct real `Input`/`Editor`/loop
  objects (real objects over mocks); the OS-clipboard host sink is a fake capturing what was written.
- Spec tests are **immutable oracles** derived from `01-requirements.md`, the `03-*` specs, and the
  AR — never from the implementation.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, `03-01`/`03-02`/`03-03`, and
> `00-ambiguity-register.md`. Do NOT modify these expectations to match code — if the code disagrees,
> the code is wrong. The `Source` column stays in this doc; the in-code traceability comment quotes
> the behavior in plain language (no `ST-`/`AR`/`RD` ids, no `codeops/` paths).

### Default keymap & commands (`buildKeymap`, `Commands.selectAll`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `buildKeymap('modern')`, then `lookup` each of `Ctrl+A/C/X/V` | `'selectAll'`, `'copy'`, `'cut'`, `'paste'` respectively | R1 / 03-01 |
| ST-2 | `buildKeymap('modern')`, `lookup` `Ctrl+Insert` / `Shift+Insert` / `Shift+Delete` | `undefined` for all (no classic chords in `'modern'`) | R10 / 03-01 |
| ST-3 | `buildKeymap('classic')`, `lookup` `Ctrl+Insert` / `Shift+Insert` / `Shift+Delete` | `'copy'`, `'paste'`, `'cut'`; and `Ctrl+C` → `undefined` | R6 / 03-01 |
| ST-4 | `buildKeymap('both')`, `lookup` `Ctrl+C` and `Ctrl+Insert` | both → `'copy'` (modern + classic aliases live) | R6 / AR-3 |
| ST-5 | `buildKeymap('both', createKeymap({ 'ctrl+c': 'save' }))`, `lookup` `Ctrl+C` and `Ctrl+X` | `Ctrl+C` → `'save'` (user wins); `Ctrl+X` → `'cut'` (default remains) | R1 / AR-4 |
| ST-6 | `buildKeymap('none')` (no user keymap); and `buildKeymap('none', userKeymap)` `lookup` `Ctrl+C` | `undefined` (nothing to bind); and `undefined` for `Ctrl+C` (only user chords resolve) | R10 / AR-3 |
| ST-7 | Package barrel + `Commands` | `Commands.selectAll === 'selectAll'`; `buildKeymap` and the `ClipboardKeys` type importable from `@jsvision/ui`; `DispatchEvent.readClipboard` present | R2 / AR-9 |

### Input — copy / cut / paste / select-all via commands

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-8 | Focused `Input` value `"hello"`, selection `[0,5]`, dispatch `Commands.copy` through a loop | The dual-sink fires: OS write sequence emitted to the host clipboard sink **and** `readClipboard()` returns `"hello"`; value unchanged | R3 / AR-4 |
| ST-9 | Same, dispatch `Commands.cut` | `readClipboard()` === `"hello"`; `Input` value becomes `""` (selection deleted) | R3 |
| ST-10 | Focused `Input`, empty selection, dispatch `Commands.copy` | No clipboard write (OS sink not called; buffer unchanged); value unchanged | R3 |
| ST-11 | `Input` value `""`, buffer holds `"abc"`, dispatch `Commands.paste` | Value becomes `"abc"`, caret at 3 (inserted via the validator/`maxLength` path) | R4 |
| ST-12 | `Input`, empty buffer, dispatch `Commands.paste` | No-op — value unchanged | R4 |
| ST-13 | Focused `Input`, deliver a bracketed `PasteEvent { text: 'xyz' }` | `"xyz"` inserted — the external-paste path still works (regression guard) | R5 |
| ST-14 | Focused `Input` value `"hi"`, dispatch `Commands.selectAll` | Selection becomes `[0,2]` (whole value) | R2 |
| ST-15 | Under a validator/`maxLength`, buffer holds an over-long / partly-invalid string, `Commands.paste` | Only the valid, in-cap code points are inserted (per the existing `applyPaste` drop-individually rule) | R4 |
| ST-16 | Under `clipboardKeys: 'both'`, a focused `Input` with a selection receives the classic `Ctrl+Insert` (→ `Commands.copy` via alias) | Selection copied (classic chord still copies) | R6 / AR-5 |
| ST-17 | A `ComboBox` (or `History`) whose field is an `Input`, focused with a selection, `Commands.copy` then `Commands.paste` into an empty field | Copies then pastes — inherits the behavior with no widget-specific code | R7 |
| ST-18 | A focused non-editable `Button`, dispatch `Commands.copy`/`cut`/`paste`/`selectAll` | No throw; command unhandled; no state change (harmless no-op) | R8 / AR-14 |
| ST-19 | A modal `Dialog` with a focused `Input`; `Commands.copy` inside the dialog, close it, `Commands.paste` into an `Input` on the desktop | Copy routes to the dialog's `Input`; after close the desktop `Input` pastes the same text (loop-global buffer across the modal boundary) | R9 / AR-15 |
| ST-20 | `clipboardKeys: 'none'`, no user keymap; deliver raw `Ctrl+A` to a focused `Input` | Select-all still works via the raw-key fallback (global keymap disabled) | R2 / AR-8 |

### Editor & cross-widget

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-21 | Focused `Editor` with text selected, `Commands.selectAll` first cleared, then a fresh `Commands.selectAll` | Whole buffer selected (`selStart` at 0, `selEnd` at buffer length) | R2 |
| ST-22 | Copy a selection in an `Editor` (`Commands.copy`), then focus an `Input` and `Commands.paste` | The `Editor`'s copied text is inserted into the `Input` (cross-widget, Editor→Input) | R12 / AR-6 |
| ST-23 | Copy text in an `Input` (`Commands.copy`), then focus an `Editor` (its injected clipboard editor empty) and `Commands.paste` | The `Input`'s copied text is inserted into the `Editor` via the shared-buffer fallback (Input→Editor) | R12 / AR-6 |

### Enable-gating & story

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-24 | `Input.hasSelection()` with `selStart === selEnd` vs `selStart < selEnd` | `false` then `true` — the queryable state the app uses to grey `copy`/`cut` | R13 / AR-7 |
| ST-25 | The kitchen-sink `clipboard` story mounted headlessly | Unique id `'controls/clipboard'`; has `category`/`title`/`blurb`/`build`; paints a non-empty frame | R11 / AR-12 |

> **⚠️ AUTHORING RULE:** Expectations derive from the specification, not from imagined implementation
> output. Any expectation that cannot be pinned from the spec is an ambiguity → register it before
> writing the test.

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. Filed as `*.spec.test.ts` (vitest `unit` project).

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/ui/test/event.default-keymap.spec.test.ts` | ST-1..ST-6 | Default keymap merge |
| `packages/ui/test/controls.global-clipboard.spec.test.ts` | ST-8..ST-18, ST-20, ST-24 | Input command wiring, paste, gating |
| `packages/ui/test/editor.global-clipboard.spec.test.ts` | ST-19, ST-21..ST-23 | Editor selectAll, cross-widget, modal scope |
| `packages/ui/test/event.packaging.spec.test.ts` *(extend)* | ST-7 | Barrel + `Commands.selectAll` + `readClipboard` |
| `packages/examples/kitchen-sink/test/kitchen-sink.smoke.spec.test.ts` *(auto)* | ST-25 | Story smoke (existing generic test picks up the new story) |

> Modal-scope ST-19 lives with the editor/integration file because it composes a `Dialog` + desktop
> `Input`; it may instead be filed in a dedicated `event.clipboard-modal.spec.test.ts` if the executor
> prefers — the ST oracle is what binds, not the filename.

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. Filed as `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/ui/test/event.default-keymap.impl.test.ts` | Compose-at-lookup internals; canonicalization of odd modifier orders; `'none'`+user edge | High |
| `packages/ui/test/controls.global-clipboard.impl.test.ts` | Paste through picture/filter validators; caret placement; wide-glyph selection copy; retired `clipboardChord` leaves no path; the reactive `hasSelection` signal fires on selection-only changes (shift-arrow / drag / double-click / Ctrl+A — value + focus unchanged) | High |
| `packages/ui/test/editor.global-clipboard.impl.test.ts` | Editor paste-fallback precedence (clipboard editor beats loop buffer when both set); undo-step integrity | Med |

### Integration / E2E

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Full app parity | Build an `Application`, focus an `Input`, `Ctrl+C`/`Ctrl+V`; focus a `Memo`, `Ctrl+A`/`Ctrl+X` | Modern chords work in both by default (covered by existing `controls-demo`/`shell` e2e patterns; extend if a headless e2e is cheap) |
| Kitchen-sink | `demo:kitchen` smoke | Story renders; no clipped text |

## Test Data

### Fixtures Needed
- Reuse the existing `app-shell.fixtures.ts` / host-double helpers for a loop with a capturing
  `writeClipboard` sink.
- Small `Input`/`Editor`/`ComboBox` builders (existing `controls.*` test helpers).

### Mock Requirements
- Fake host clipboard sink (`writeClipboard`) to assert the OS write still fires (ST-8). No other
  mocks — real widgets and a real loop.
- **ST-8 precondition:** the loop's `caps` must advertise `osc.clipboard52` for the OS-write half of
  ST-8 to fire — core `setClipboard(text, caps)` returns `''` (and `writeClipboard` is never called)
  on a profile without it. The buffer-fill half (`readClipboard()` returns the copied text) is
  caps-independent, so build the ST-8 loop with a clipboard-capable profile.

## Verification Checklist
- [ ] All ST-cases defined with concrete input/output pairs (above)
- [ ] Every ST case traces to a requirement / spec doc / AR entry
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red)
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests written for edge cases/internals
- [ ] No regressions in existing `controls.input-clipboard.*`, `event.*`, `editor.*`, `app-shell.*`
- [ ] `yarn verify` (lint + typecheck + build + unit + check:docs) green
- [ ] Relevant `test:e2e` + `demo:kitchen` smoke green
- [ ] `yarn check:docs` green (every new public export has an `@example`; no banned IDs)
