# Execution Plan: Cell Editors & Value Help

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-13 17:45
> **Progress**: 9/45 tasks (20%) — Phase 1 complete
> **CodeOps Skills Version**: 3.7.0

## Overview

Grow RD-02's single editor seam into the typed editor set, spec-first and additively: the spec/factory surface +
keystroke filters + the backward-compatible default (Phase 1), the typed string-field bridges + boolean/date
editors (Phase 2), the enum + async lookup value-help editors (Phase 3), the F4 begin-edit-and-open gesture
(Phase 4), the custom-editor escape hatch (Phase 5), and the kitchen-sink editor stories + security + final
verify (Phase 6). The `createCellEditor` switch is built **incrementally** — each phase adds its `case`(s), so
every phase compiles and stays green; the RD-02 immutable ST-15 (`createCellEditor → Input`) stays green
throughout via the `{ kind: 'text' }` default.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Editor spec, factory & filtered text editors (`text`/`integer`/`decimal`/`readonly`) | 9 |
| 2 | Typed bridges + reactive-ownership restructure & `boolean`/`date` editors | 8 |
| 3 | `enum` & `lookup` editors (async value help) | 8 |
| 4 | F4 value-help activation (begin-edit + open) | 7 |
| 5 | Custom-editor escape hatch | 5 |
| 6 | Kitchen-sink editor stories, security & final verify | 8 |

**Total: 45 tasks across 6 phases** (literal checkbox count — the source of truth; no fabricated hour estimates).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress; each task line appears exactly
> once. The executing agent MUST:
>
> 1. **On implementation:** `- [~] N.N.N … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** `- [x] N.N.N … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated after EVERY task** — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented. Spec tests are immutable oracles: a failing spec
> test means the implementation is wrong — fix the code, never the test. The RD-02 `cell-editor.spec.test.ts`
> ST-15 case MUST stay green (the `{ kind: 'text' }` default preserves it) — if it fails, the code diverged, not
> the oracle.

---

## Phase 1: Editor spec, factory & filtered text editors

The spec/factory surface everything else extends (03-01). Delivers AC-5 (read-only) + the keystroke-filter half
of AC-9. Backward-compatible with RD-02 (no `editor` → text `Input`). Blocks Phases 2–6.

### Step 1.1: Specification tests

**Reference**: [03-01](03-01-editor-spec-and-factory.md) · [07 ST-1] · AR #1, #3

- [x] 1.1.1 Write/extend the factory spec (ST-1: no-`editor` editable col → `Input`; `editor:{kind:'readonly'}` → `null` + begin-edit rejected + record untouched; no parse/set → `null`) — `packages/datagrid/test/cell-editor.spec.test.ts` ✅ (completed: 2026-07-13 17:40)
- [x] 1.1.2 Run — verify the new ST-1 cases FAIL (red: `editor` field + `resolveSpec` not yet present); confirm the pre-existing ST-15 still PASSES ✅ (completed: 2026-07-13 17:40) — 2 readonly-kind cases red, ST-15 + ST-1(a)/(c) green

### Step 1.2: Implementation

**Reference**: [03-01 §1–6] · AR #1, #3, #4

- [x] 1.2.1 Add the public types `CellEditorKind`/`CellEditorSpec`/`LookupItem`/`LookupProvider` (+ `create?` on the spec) to `cell-editor.ts`, each with plain-language JSDoc — no spike/plan/RD refs ✅ (completed: 2026-07-13 17:45)
- [x] 1.2.2 Add `editor?: CellEditorSpec | ((row: T) => CellEditorSpec)` to `GridColumn` (with `@example`) — `packages/datagrid/src/column.ts` ✅ (completed: 2026-07-13 17:45)
- [x] 1.2.3 Implement internal `resolveSpec(column, row)` (function/literal/absent→`{kind:'text'}`) + `defaultValidator(kind)` (`integer`→`filter('0-9-')`, `decimal`→`filter('0-9.-')`) — `cell-editor.ts` ✅ (completed: 2026-07-13 17:45)
- [x] 1.2.4 Rework `createCellEditor` to `(column, field, host, row?)`: `isEditable` gate first, then `switch(resolveSpec.kind)` with `text`/`integer`/`decimal` → `new Input({ value: field, validator: spec.validator ?? defaultValidator })`, `readonly`/`default` → `null`; update the `@example`. **Append** `cell.row` as the 4th arg to the *existing* `createCellEditor(tcol, field, { overlay: host.overlay })` call at `editing.ts:178` — keep the 3rd-arg literal, do not replace it (PF-006). Export the new types from `index.ts` ✅ (completed: 2026-07-13 17:45) — `_host` kept underscored until `custom` (Phase 5) consumes it
- [x] 1.2.5 Run the specs — verify ST-1 + ST-15 PASS (green) + `yarn workspace @jsvision/datagrid check:docs` ✅ (completed: 2026-07-13 17:45) — 6/6 spec, check:docs OK

### Step 1.3: Hardening

**Reference**: [07 impl: `resolveSpec`, dispatch]

- [x] 1.3.1 Write impl tests: `resolveSpec` per-row function form + `undefined`-row fallback + literal passthrough; `spec.validator` overrides `defaultValidator` — `packages/datagrid/test/cell-editor.impl.test.ts` ✅ (completed: 2026-07-13 17:45)
- [x] 1.3.2 Phase gate: `yarn workspace @jsvision/datagrid typecheck` + `test` + `check:docs` (run separately) — all green ✅ (completed: 2026-07-13 17:45) — typecheck OK · 90 unit tests · check:docs OK

**Deliverables**: `CellEditorSpec`/kinds types, `column.editor`, `resolveSpec`, filtered `text`/`integer`/`decimal` + `readonly`; RD-02 default preserved.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs` (separately)

---

## Phase 2: Typed bridges & `boolean`/`date` editors

Depends on Phase 1. Adds the reactive-ownership restructure (construct the editor **inside** `mountCellOverlay`'s
`createRoot` so factory-time bridge effects are owned and dispose on close, PF-002), the no-loop adapters
(03-02), and the `boolean`/`date` switch cases. Delivers AC-1 + the bridge half of AC-7.

### Step 2.1: Specification tests

**Reference**: [03-02](03-02-typed-bridges.md) · [07 ST-2, ST-3]

- [ ] 2.1.1 Write the boolean/date editor specs (ST-2: `CheckGroup` + `Space` toggle flips `'true'`/`'false'` on commit; ST-3: `DatePicker` + ISO `YYYY-MM-DD` commit; empty field → `null`) — `packages/datagrid/test/cell-editor.spec.test.ts`
- [ ] 2.1.2 Run — verify ST-2/ST-3 FAIL (red: `boolean`/`date` cases + bridges not yet present)

### Step 2.2: Implementation

**Reference**: [03-02 §boolBridge, §dateBridge, §Ownership] · [03-01 §4] · [02-current-state impact table] · AR #10

- [ ] 2.2.1 **Ownership restructure (PF-002):** give `mountCellOverlay` a build-callback form that constructs the editor **inside** its `createRoot` and returns the built editor; move the `createCellEditor(...)` call out of the pre-mount position into that callback, so every bridge `effect()` is owned by the overlay scope and disposes on close (existing disposer path reused; the returned editor feeds Phase-4's F4 forward) — `packages/datagrid/src/overlay.ts`, `packages/datagrid/src/editing.ts`
- [ ] 2.2.2 Create `packages/datagrid/src/editor-bridges.ts` with `boolBridge(field)` + `dateBridge(field)` (each a pair of `untrack`-guarded effects; code-comment the no-loop invariant **and** the mount-coercion limitation — empty→`'false'`, unparseable date→`''`) — internal, not barrel-exported
- [ ] 2.2.3 Add the `boolean` (`CheckGroup` + `boolBridge`) and `date` (`DatePicker` + `dateBridge`) cases to the `createCellEditor` switch — `cell-editor.ts`
- [ ] 2.2.4 Run the specs — verify ST-2/ST-3 PASS (green); confirm **no** "created outside any `createRoot()`" dev-warning fires on begin-edit + `check:docs`

### Step 2.3: Hardening

- [ ] 2.3.1 Write bridge impl tests (round-trip both directions; `dateBridge` idempotent same-day reset) — `packages/datagrid/test/editor-bridges.impl.test.ts`
- [ ] 2.3.2 Phase gate: `yarn workspace @jsvision/datagrid typecheck` + `test` + `check:docs` (separately)

**Deliverables**: `boolBridge`/`dateBridge`, `boolean`/`date` editors.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs` (separately)

---

## Phase 3: `enum` & `lookup` editors (async value help)

Depends on Phase 2 (bridge pattern). Adds `enumBridge`/`lookupBridge` + the async lookup build (03-03 §1).
Delivers AC-2, AC-3 + the enum/lookup half of AC-7.

### Step 3.1: Specification tests

**Reference**: [03-03 §1](03-03-lookup-f4-and-showcase.md) · [07 ST-4, ST-5]

- [ ] 3.1.1 Write the enum/lookup specs (ST-4: select-only `ComboBox`, `items()` = `values` in order, select 3rd commits it; ST-5(a): async provider loads after `tick()`, shows the label, select writes the **key**; **ST-5(b) regression (PF-001): field seeded with an existing key `'7'` + no interaction → after `tick()` shows the label and commit yields the unchanged `'7'` — not clobbered to `''` on mount**) — `packages/datagrid/test/cell-editor.spec.test.ts`
- [ ] 3.1.2 Run — verify ST-4/ST-5 FAIL (red: `enum`/`lookup` cases + bridges not yet present)

### Step 3.2: Implementation

**Reference**: [03-02 §enumBridge, §lookupBridge] · [03-03 §1] · AR #6, #9

- [ ] 3.2.1 Add `enumBridge(field)` (`'' ⟷ null`) + `lookupBridge(field, items)` (key ⟷ `LookupItem`, re-matches on `items` change; **reverse effect guarded to write only when a row is actually selected — never clobber a seeded key with `''` on mount, PF-001**) to `editor-bridges.ts`
- [ ] 3.2.2 Add the `enum` case (seed `signal(values)` → select-only `ComboBox<string>` + `enumBridge`) and the `lookup` case (`buildLookupEditor`: static array seeds `items`; async provider `void provider().then(items.set)`; `ComboBox<LookupItem>` `getText = it.label`, `editable:false`, `lookupBridge`) — `cell-editor.ts`
- [ ] 3.2.3 Run the specs — verify ST-4/ST-5 PASS (green) + `check:docs`

### Step 3.3: Hardening

- [ ] 3.3.1 Extend bridge impl tests: `enumBridge` `''⟷null`; `lookupBridge` key⟷item + re-match after async `items` repopulation — `editor-bridges.impl.test.ts`
- [ ] 3.3.2 Write the no-loop spec (ST-9: each of the four bridges updates its control once and does not re-write `field`; effect-run counts) — `packages/datagrid/test/editor-bridges.impl.test.ts`
- [ ] 3.3.3 Phase gate: `yarn workspace @jsvision/datagrid typecheck` + `test` + `check:docs` (separately)

**Deliverables**: `enumBridge`/`lookupBridge`, `enum`/`lookup` editors, async provider load, no-loop guarantee.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs` (separately)

---

## Phase 4: F4 value-help activation

Depends on Phase 3 (a `lookup`/`enum` ComboBox exists). Adds the F4 begin-edit-and-open gesture (03-03 §2).
Delivers AC-6 (the F4 clause; F2/Enter open is ST-7).

### Step 4.1: Specification tests

**Reference**: [03-03 §2, §5](03-03-lookup-f4-and-showcase.md) · [07 ST-7, ST-8] · AR #2, #7, #8

- [ ] 4.1.1 Write ST-7 (F2/Enter mount the type-appropriate widget; `getFocused()` is the **single pinned** target per kind — the widget for text/boolean/date, `combo.input` for enum/lookup, PF-005) + ST-8 (with `loop.popupHost` wired: `F4` on a lookup cell mounts the editor **and** `popupOpen(overlay)===true`; `F4` on a read-only cell is a no-op) — `packages/datagrid/test/cell-editor.spec.test.ts`
- [ ] 4.1.2 Run — verify ST-8 FAILs (red: F4 branch + Alt+Down forward not yet present); ST-7 may partly pass (F2/Enter already mount)

### Step 4.2: Implementation

**Reference**: [03-03 §2a, §2b]

- [ ] 4.2.1 Add the `f4` branch to `EditableGridRows.tryBeginEdit` → `controller.beginEdit(ev, { openDropdown: true })` — `packages/datagrid/src/editable-grid-rows.ts`
- [ ] 4.2.2 Extend `beginEdit` opts with `openDropdown?`; after mount+focus, when set and `editor instanceof ComboBox`, forward a synthetic `Alt+Down` `DispatchEvent` (spread from `ev`, reusing `popupHost`/`focusView`) to `editor.onEvent`; import `ComboBox` from `@jsvision/ui` — `packages/datagrid/src/editing.ts`
- [ ] 4.2.3 Run the specs — verify ST-7/ST-8 PASS (green) + `check:docs`

### Step 4.3: Hardening

- [ ] 4.3.1 Write impl test: `openDropdown` on a non-ComboBox editor (text/date) is inert (no throw, editor mounts); F4 on an editable non-lookup cell begins the edit — `packages/datagrid/test/editing.impl.test.ts`
- [ ] 4.3.2 Phase gate: `yarn workspace @jsvision/datagrid typecheck` + `test` + `check:docs` (separately)

**Deliverables**: F4 = begin-edit + open the value-help dropdown (one press), via the public Alt+Down trigger.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs` (separately)

---

## Phase 5: Custom-editor escape hatch

Depends on Phase 1 (the switch). Adds the `custom` case (03-01 §4). Delivers AC-4.

### Step 5.1: Specification tests

**Reference**: [03-01 §4] · [07 ST-6]

- [ ] 5.1.1 Write ST-6 (a `custom` column whose `create` returns the caller's `Input`; `F2` mounts exactly that view; type + `Enter` commits once via the RD-02 protocol; a fresh edit + `Esc` reverts with no `onCommit`) — `packages/datagrid/test/cell-editor.spec.test.ts`
- [ ] 5.1.2 Run — verify ST-6 FAILs (red: `custom` case not yet present → `default` null)

### Step 5.2: Implementation

- [ ] 5.2.1 Add the `custom` case: `return spec.create ? spec.create(field, host) : null` (the caller's factory gets the field + the existing `CellEditorHost`) — `cell-editor.ts`; document the Enter=commit/Esc=cancel contract in the `create` JSDoc
- [ ] 5.2.2 Run the spec — verify ST-6 PASSES (green) + `check:docs`

### Step 5.3: Hardening

- [ ] 5.3.1 Phase gate: `yarn workspace @jsvision/datagrid typecheck` + `test` + `check:docs` (separately); confirm a `create` returning `null` is treated as read-only (begin-edit rejected)

**Deliverables**: `custom` editor factory honoring the RD-02 commit/cancel protocol.
**Verify**: `yarn workspace @jsvision/datagrid typecheck test check:docs` (separately)

---

## Phase 6: Kitchen-sink editor stories, security & final verify

Depends on all prior phases. Delivers AC-8 (stories) + the lookup-label-sanitize clause of AC-9, then the full
done gate.

### Step 6.1: Specification tests

**Reference**: [03-03 §3, §4](03-03-lookup-f4-and-showcase.md) · [07 ST-10, ST-11] · AR #11

- [ ] 6.1.1 Write ST-11 security cases (a) lookup `label: 'A\x1b[31mB\x07'` renders sanitized (no raw ESC/BEL in the buffer / serialized frame; wired `popupHost`) (b) `integer` `filter('0-9-')` rejects a letter keystroke before commit — `packages/datagrid/test/security.spec.test.ts`
- [ ] 6.1.2 Run — verify the new security cases FAIL where behavior is missing (red)

### Step 6.2: Implementation

- [ ] 6.2.1 Add `packages/datagrid/test/kitchen-sink/stories/editors.story.ts` (`id: 'datagrid/editors'`) with boolean/date/enum/lookup columns + a bound-state echo + interaction hints; register it (one import + one array entry) in `stories/index.ts`
- [ ] 6.2.2 Confirm the security behavior passes (the core `sanitize` boundary + the `filter` keystroke gate already deliver it; add code only if a gap is found) — `security.spec.test.ts` green
- [ ] 6.2.3 Run the smoke + security specs — verify ST-10 + ST-11 PASS (green) + `check:docs`

### Step 6.3: Hardening & done gate

- [ ] 6.3.1 Update the `@jsvision/datagrid` public JSDoc for every new/changed export (`createCellEditor`, the spec types) — each has a lead sentence + `@example`; run `check:docs` (0 banned refs / 0 missing `@example`)
- [ ] 6.3.2 Full `yarn verify` (use `TUI_SKIP_PERF=1` if the `@jsvision/ui` `editor-perf` ceiling trips under load; confirm it passes in isolation) — capture the PASS one-liner
- [ ] 6.3.3 Roadmap sync: RD-03 → `Done` (✅) in `codeops/features/datagrid/00-roadmap.md`, cascade to `codeops/00-roadmap.md` (via the roadmap skill)

**Deliverables**: editor kitchen-sink stories + smoke, RD-03 security ST, full-verify-green RD-03.
**Verify**: full `yarn verify`

---

## Phase → AC coverage

| Phase | AC delivered | ST |
| ----- | ------------ | -- |
| 1 | AC-5 (readonly) + AC-9 keystroke-filter clause | ST-1 (+ ST-11b in P6) |
| 2 | AC-1 (boolean, date) | ST-2, ST-3 |
| 3 | AC-2 (enum), AC-3 (lookup), AC-7 (no-loop) | ST-4, ST-5, ST-9 |
| 4 | AC-6 (F2/Enter + F4 open) | ST-7, ST-8 |
| 5 | AC-4 (custom) | ST-6 |
| 6 | AC-8 (stories), AC-9 (label sanitize) | ST-10, ST-11 |

## Post-completion hooks

1. End-of-plan commit per the active commit mode (`/gitcmp` in `--auto-commit`).
2. Techdocs: if opted in, incremental update; else the exec_plan skill asks.
3. Re-analyze: the exec_plan skill asks whether to refresh `CLAUDE.md`.
4. Roadmap: RD-03 → `Done` + portfolio cascade (Step 6.3.3).
