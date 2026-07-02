# Controls & Input Editor Hardening: Runtime Hardening (RD-13)

> **Document**: 03-08-controls-input.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-43…HR-48, HR-52, HR-54…HR-60 (TV fidelity + editor correctness)
> **Files**: `packages/ui/src/controls/{input.ts,input-clipboard.ts,cluster.ts,button.ts,text.ts,multi-check-group.ts}`

> **TV-fidelity gate applies to every item below with a `.cpp` cite** — each carries a
> BEFORE-decode/AFTER-diff task pair in the execution plan; the decode `file:line` facts recorded
> here are the audit's citations, re-verified at BEFORE-decode time. A conflicting spec oracle is
> corrected against the `.cpp` (fidelity exception).

## TV decode (GATE 1) — citation index

| HR | Original behavior | Source cite |
|----|-------------------|-------------|
| HR-43 | paste converts `\t\r\n` → spaces before insert | `tinputli.cpp:430-431` |
| HR-44 | `TCluster` is `ofPreProcess\|ofPostProcess`; hotkey selects+presses **and** calls `focus()` | `tcluster.cpp:46,257-284` |
| HR-47 | invalid transient delete is reverted (validator consulted on deletions) | `tinputli.cpp:380-413,481-483` |
| HR-48 | `kbCtrlBack` → `prevWord` word-wise delete | `tinputli.cpp:389-397` |
| HR-52 | disabled draws **both** bytes of the hot run in the disabled color | `tbutton.cpp:107-108`, `tcluster.cpp:95` |
| HR-56 | button click rect excludes column 0 (`clickRect.a.x++`) | `tbutton.cpp:177-180` |
| HR-57 | `TStaticText` draws text verbatim between breaks (no whitespace collapse) | `tstatict.cpp:44-105` |
| HR-58 | insert clamps at `maxLen` and accepts | `tinputli.cpp:282-288` |

## Implementation Details

### HR-43 — Bracketed paste maps control chars
**Defect** (`input.ts:300-308` → `input-clipboard.ts:91-108`): raw `\t\r\n` enter the bound
`Signal<string>`. **Fix**: the paste path maps `\t`/`\r`/`\n` → one space each and **drops** other
C0 before insert (TV converts the trio, `tinputli.cpp:430-431`; the C0 drop preserves our stricter
allowlist posture and the HR-05 invariant that no control char reaches a cell). Validator gating
(`isValidInput`) applies to the mapped text, unchanged.

### HR-44 — Cluster hotkeys are dialog-wide
**Defect** (`cluster.ts:31-37` sets only `focusable`): Alt+hotkey works only while focused. **Fix**:
`Cluster` sets `postProcess = true` (the existing RD-04 sweep flags) and its hotkey handler, on a
dialog-wide Alt+hotkey hit, selects+presses the item **and takes focus** (`ev.focusView`), per
`tcluster.cpp:257-284`.

### HR-45 — autoFill caret math
**Defect** (`input-clipboard.ts:75` applies the trailing-append length delta at `pos`) — reproduced:
mask `'@@--'`, value `"a"`, caret 0, type `b` → caret 3, not 1. **Fix**: the caret advances by the
number of characters inserted **at the caret position**; the trailing-literal autoFill delta never
moves the caret. Oracle = the exact repro.

### HR-46 — Drag guard
**Defect** (`input.ts:465-471`, no "am-I-dragging" state): an Input mutates selection on drags it
never started. **Fix**: the move/drag handler no-ops unless this Input received the initiating
mouse-down (mirror the `scroll-bar.ts:239-240` pattern — a `dragging` flag set on down, cleared on
up/capture-loss).

### HR-47 — Deletions re-validate
**Defect** (`input.ts:355-371` backspace/delete, `:286-291` cut bypass `isValidInput`). **Fix**:
deletions (and cut) apply transiently, consult the validator, and **revert** if invalid — TV's
transient-revert model (`tinputli.cpp:380-413,481-483`). Applies to all validators; the picture
mask is the motivating case.

### HR-48 — Word-wise Ctrl+Backspace / Ctrl+Del
**Defect** (`input.ts:338-339` ignores modifiers). **Fix**: Ctrl+Backspace deletes to the previous
word boundary (TV `prevWord`, `tinputli.cpp:389-397`); Ctrl+Del symmetrically to the next word
boundary. Word-boundary predicate = TV's (space-delimited runs). Deletion re-validation (HR-47)
applies.

### HR-52 — Disabled hot-run color
**Defect** (`button.ts:103-104,155`; `cluster.ts:88,98-101`): the `~hot~` run stays bright while
disabled. **Fix**: when disabled, the hot segment renders in the disabled role for **both** glyph
and marker bytes (`tbutton.cpp:107-108`, `tcluster.cpp:95`).

### HR-54 — Double-click window resets
**Defect** (`input.ts:81,452-460`: `lastDownX` never reset): any later second click on the same
cell select-alls. **Fix**: the double-click substitute arms only within a short window and is
disarmed by any edit, caret move, or click on another cell. (No wall-clock in tests: the window is
an injectable/tick-based counter consistent with the loop's tick model.)

### HR-55 — Docs-only: leading mask literals
**Defect**: JSDoc/PA-17 (essential-control-completions) claim leading literals auto-appear;
reproduced false — code is TV-faithful (autoFill appends **trailing** literals only). **Fix**:
correct the JSDoc + the plan-doc wording; **no behavior change**, no oracle.

### HR-56 — Button click rect excludes column 0
**Defect** (`button.ts:197-200`, `local.x >= 0`). **Fix**: activation requires `local.x >= 1`
(`tbutton.cpp:177-180` `clickRect.a.x++`); column 0 (the shadow-adjacent edge) is inert.

### HR-57 — `Text` preserves whitespace
**Defect** (`text.ts:29` tokenizes `/\S+/g`, rejoining with single spaces): `"a  b"` renders
`"a b"`; indentation lost. **Fix**: the wrapper preserves internal whitespace verbatim between
break points (`tstatict.cpp:44-105` draws the string as-is, breaking at spaces without collapsing
runs); only the break-search logic changes, not the drawn content.

### HR-58 — maxLength clamps instead of rejecting
**Defect** (`input-clipboard.ts:73` returns null when the **filled** length exceeds `maxLength`).
**Fix**: clamp the insertion so the result length ≤ `maxLength` and accept what fits
(`tinputli.cpp:282-288`).

### HR-59 — External writes clamp the full selection
**Defect** (`input.ts:111-117` clamps `curPos` only): a shorter external value leaves
`selStart/selEnd/anchor` past the end. **Fix**: the external-write reconciler clamps the entire
selection state tuple to the new length.

### HR-60 — Floored modulo in `MultiCheckGroup.press`
**Defect** (`multi-check-group.ts:60`: JS `%` keeps sign — a negative bound state cycles more
negative). **Fix**: use a floored modulo (`((n % m) + m) % m`) so any external state normalizes
into range on press.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Paste containing C0 beyond `\t\r\n` | dropped (trio → space) | RD HR-43 + HR-05 invariant (PA-5-consistent) |
| Delete that invalidates the value | transient revert | RD HR-47 (pinned, TV) |
| Insert past `maxLength` | clamp-and-accept | RD HR-58 (pinned, TV) |
| Negative externally-bound `MultiCheckGroup` state | floored-modulo normalize | RD HR-60 (pinned) |

## Testing Requirements

- Spec oracles ST-8.a–m ([07-testing-strategy.md](07-testing-strategy.md)); existing controls spec
  oracles that encode the pre-fix behavior are corrected **against the cited `.cpp`** (fidelity
  exception, AC-8).
- Impl tests: paste across selection; word-delete at string edges; drag in/out across two Inputs;
  clamp with multi-cell (wide) content.
