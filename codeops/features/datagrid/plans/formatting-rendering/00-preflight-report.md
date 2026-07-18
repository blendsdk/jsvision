# Preflight Report: Formatting & Cell Rendering (datagrid/RD-04)

> ✅ **PREFLIGHT PASSED — all 5 findings resolved** (1 critical + 1 major + 2 minor + 1 observation)
> **Artifact**: `codeops/features/datagrid/plans/formatting-rendering/` (8 plan docs)
> **Reviewed**: 2026-07-13 · **Resolved**: 2026-07-14 · **CodeOps Skills Version**: 3.7.0
> **Status**: fixes applied to the plan docs (iteration 2) — ready for exec_plan

> ⚠️ **SAME-SESSION REVIEW** — this plan was authored in the current session, so systematic blind
> spots are likely. Countermeasures applied: (1) every code claim was re-verified against the actual
> source (not memory), with `file:line` evidence; (2) the two high-stakes findings (PF-001, PF-002)
> were independently challenged by a separate read-only reviewer that tried to **refute** them — both
> were confirmed CORRECT with contradicting-evidence searches returning nothing. Consider a fresh
> session for the re-scan after fixes, for full independence.

---

## Codebase Context Summary

The plan targets `@jsvision/datagrid` (built on `@jsvision/ui` + `@jsvision/core`). Verified against code:

| Plan claim | Reality | Verdict |
|---|---|---|
| `sanitize` is automatic at the buffer boundary | `ScreenBuffer.text` runs `sanitize(str)` (`core/.../render/buffer.ts:211`); `DrawContext.text` also sanitizes (`ui/.../view/draw-context.ts:108`) | ✅ AC-5/AC-9 hold |
| `toEngineColumn` already renders via accessor + value-aware compare | `column.ts:120-126` (accessor `format ?? String`; `compare = defaultCompare(value(a), value(b))`) | ✅ AC-3 seam real |
| `CellDrawContext = Pick<DrawContext,'text'\|'fillRect'\|'color'\|'role'\|'caps'>` | All five members exist on `DrawContext` (`ui/.../view/types.ts:38-61`; facade `draw-context.ts:193`) | ✅ Pick compiles |
| `EditableGridRows` can host a self-contained `draw()` override | `geometry()`/`updateTop()`/`state.focused`/`vbar`/`hbar` are protected/public and reachable; base loop is readable (`ui/.../table/grid-rows.ts:184-237`) | ✅ feasible (see PF-003) |
| `LookupItem { key, label }` for `fmt.lookupLabel` | `datagrid/src/cell-editor.ts:46-51`; exported from the barrel | ✅ |
| `fmt.date` uses `toDate(CalendarDate)` from the ui barrel | `toDate` exported (`ui/src/index.ts:204`; `date/calendar-date.ts:223`) | ✅ (see PF-005) |
| **`danger`/`warning`/`info`/`success` are theme roles** | **FALSE — they are input aliases (`ThemeColors`), not `keyof Theme`** (`core/.../color/aliases.ts:60-66`; `Theme` has no such keys, `theme.ts:30-259`) | 🔴 **PF-001** |
| Numeric `fmt` `parse` returns a sentinel, wired into a column | `GridColumn.parse: (text)=>V` (`column.ts:31`); commit writes it unchecked (`editing.ts:263`, `commit.ts:68`) | 🟠 **PF-002** |

---

## Findings

| # | Severity | Dimension | One-line |
|---|---|---|---|
| PF-001 | 🔴 CRITICAL | Codebase Alignment / Assumptions | `danger`/`warning`/`info`/`success` are not `Theme` roles — `ctx.color('danger')` and `cellStyle→'danger'` do not compile |
| PF-002 | 🟠 MAJOR | Completeness / Consistency | `fmt.*().parse: V \| PARSE_FAILED` is not assignable to `GridColumn.parse: (text)=>V`, and the commit path never checks the sentinel |
| PF-003 | 🟡 MINOR | Codebase Alignment | `keepVisible`/`clampIndex` are module-private ui free functions, not protected base helpers — the override must use `this.updateTop()` |
| PF-004 | 🟡 MINOR | Testability | `parse(format(v))===v` holds only for values representable at the formatter's fraction-digits; the oracle must be scoped |
| PF-005 | 🔵 OBSERVATION | Consistency | `02-current-state` omits `toDate` from its barrel inventory though `fmt.date` depends on it (it exists) |

---

### 🔴 PF-001 — Phantom theme roles (`danger`/`warning`/`info`/`success`)

**Where**: `00-ambiguity-register.md` AR-2; `02-current-state.md` §What Exists ("Theme roles … `danger`,
`warning`, `info`, `success` semantic roles exist"); `00-index.md` examples; `03-02-cell-rendering.md`
examples + Error Handling; `07-testing-strategy.md` ST-10, ST-13, ST-14.

**Evidence**: `ThemeRoleName = keyof Theme` (`ui/src/view/types.ts:30`). The `Theme` interface
(`core/src/engine/color/theme.ts:30-259`) has **no** `danger`/`warning`/`info`/`success` key — the only
grid roles are `gridCursor` (`:216`) and `gridDirty` (`:222`). Those four names are members of the
16-token **input alias** set `ThemeColors` (`core/src/engine/color/aliases.ts:60-66`), read by
`rolesFromAliases` only as *inputs* that colour real roles (e.g. `roles.ts:41,94,108`). Tree-wide grep
for `color('danger'` / `role('danger'` (all four) → none. `defaultTheme.danger` is `undefined`.

**Impact**: `ctx.color('danger')`, `ctx.color('success')`, `cellStyle: (v)=>v<0?'danger':'listNormal'`,
and `safeRender` painting `⚠` "in the `danger` role" all **fail to type-check** (`'danger'` is neither a
`ThemeRoleName` nor a `Style`). AR-2's chosen resolution ("reuse the existing `danger` role") is built on
a false premise; the AC-4 error mechanism and ST-10/13/14 cannot be implemented as written. RD-04 itself
(§Integration, line 104) states the **error role** is an additive **RD-14** Theme role (AR-24) — so the
plan mis-resolved a cross-RD dependency rather than a naming choice.

**Options**
- **A′ — self-contained, no core change (RECOMMENDED).** `cellStyle` keeps its `ThemeRoleName | Style`
  return; examples that want "negative = red" return an explicit `Style` (`{ fg, bg }`). The error glyph
  paints `⚠` in an explicit `Style` whose fg is `ctx.color('gridDirty').fg` (a red that adapts per theme,
  needs no new role) composited over the row bg — mirroring how `paintDirtyMarkers` composites a fg.
  Rewrite AR-2, the false claim in `02-current-state`, every example, and ST-10/13/14; defer any semantic
  `danger`/`success`/`gridCellError` role to **RD-14** (where RD-04 already places it). Blast radius stays
  inside `@jsvision/datagrid`, consistent with the plan's "self-contained / no ui change" spirit.
- **B′ — add core semantic roles now.** Add `danger`/`warning`/`info`/`success` (or a `gridCellError`) to
  the core `Theme` + `rolesFromAliases` + `defaultTheme` + every preset + the serialized theme format +
  the theme-designer. This is exactly the "PF-006 cost" AR-2 was trying to avoid, is a cross-package
  `@jsvision/core` change, ripples the preset parity oracle, and is RD-14-scoped. **Not recommended** for
  this plan.

**Recommendation**: **A′.** Confidence: high (challenger-confirmed, refutation searches empty).

---

### 🟠 PF-002 — `parse` sentinel vs the `GridColumn.parse` contract

**Where**: `03-01-formatter-registry.md` (`InvertibleFormat.parse: (text) => V | typeof PARSE_FAILED`);
`00-index.md` example (`...fmt.currency(...)` spread); `03-02-cell-rendering.md` example; `07` ST-2.

**Evidence**: `GridColumn.parse?: (text: string) => V` (`column.ts:31`). The commit path does
`const value = tcol.parse!(field())` then applies it with no guard (`editing.ts:263` → `commit.ts:68`
`apply(row, columnId, next)`); the only `try/catch` wraps `onCommit` (a veto), not `parse`. No failure
sentinel exists anywhere in `datagrid/src`.

**Impact**: `(text) => number | typeof PARSE_FAILED` is **not assignable** to `(text) => number`
(return-type covariance), so the plan's headline `...fmt.currency({...})` spread does **not compile**.
Even if forced through, a `PARSE_FAILED` symbol would be **written into the record** on bad input, because
the commit path never checks it — the opposite of AC-2 ("reported as invalid, not `NaN`"). RD-12 (the
validation layer that would consume the sentinel) does not exist yet, so within RD-04's scope the sentinel
has no consumer.

**Options**
- **B — widen + handle at the one commit site (RECOMMENDED).** Widen `GridColumn.parse` to
  `(text) => V | typeof PARSE_FAILED` (a `datagrid` change), and at `editing.ts:263` reject the commit
  when the parse returns the sentinel (keep the editor open / signal invalid) instead of writing it. Makes
  the `...fmt.*(...)` spread valid **and** delivers AC-2 now. Touches the RD-02 commit path but is small,
  localized, and the only consumer of `parse` is that line (`isEditable` only checks `typeof parse`).
- **A — adapter, zero commit-path change.** Keep `GridColumn.parse: (text)=>V`; `fmt` invertible `parse`
  returns `V | PARSE_FAILED` for standalone/tested use only; callers wire a documented adapter, and the
  plan's direct-spread examples are rewritten to show it. Lower touch, but `(text)=>V` has no failure
  channel, so AC-2's "reported as invalid" is effectively deferred to RD-12 and the ergonomic spread the
  RD advertises is lost.
- **C — throw + catch.** `parse` returns `V` and throws on bad input; the commit path wraps `parse` in
  try/catch. Rejected: the plan/standards deliberately chose a sentinel over an exception ("never a silent
  `NaN`"), and a throw-based contract is inconsistent with the `PARSE_FAILED` design already specified.

**Recommendation**: **B.** Confidence: high (challenger-confirmed).

---

### 🟡 PF-003 — `keepVisible`/`clampIndex` are not reusable base helpers

**Where**: `03-02-cell-rendering.md` §Proposed Changes step 1 ("reuse … the base's `keepVisible`/clamp
helpers via protected access; where a base helper is `private`, replicate the one-line math").

**Evidence**: `import { clampIndex, keepVisible } from '../list/virtual.js'` (`ui/.../table/grid-rows.ts:29`)
— module-private free functions, **not** methods on `GridRows` (neither private nor protected), and **not**
re-exported from the `@jsvision/ui` barrel. The base `draw()` uses them inline (`:203-204`).

**Impact**: The override cannot "reuse them via protected access" — they are unreachable from `datagrid`.
The correct seam is the protected `this.updateTop()` (`grid-rows.ts:165`), which computes `topItem`
identically; the focused-index clamp can use the file-local `clamp(...)`. Left unfixed, an executor may
hunt for a nonexistent protected helper or add a fragile deep import. Reword step 1 to name `updateTop()`.

**Recommendation**: Reword. Non-blocking.

---

### 🟡 PF-004 — Round-trip oracle must be scoped to representable values

**Where**: `03-01-formatter-registry.md` ("`parse(format(v)) === v` asserted per locale"); `07` ST-3.

**Evidence**: `Intl.NumberFormat` rounds to its fraction-digits (percent default 0; decimal default max 3),
so `format` is lossy for finer values. `parse(format(v)) === v` holds only when `v` is representable at the
formatter's precision (e.g. `format(0.245)` → `"25%"` → `parse` → `0.25 ≠ 0.245`).

**Impact**: The chosen ST values (0, −5, 1234.5, 1000000, 0.25) are all representable, so the tests pass —
but the general claim is over-broad and could seed a brittle oracle later. Scope the assertion to "values
representable at the configured fraction-digits."

**Recommendation**: Add the scoping caveat to `03-01` and ST-3. Non-blocking.

---

### 🔵 PF-005 — `toDate` missing from the current-state inventory

**Where**: `02-current-state.md` (lists `toISO`/`parseISO` on the ui barrel, omits `toDate`).

**Evidence**: `fmt.date` (`03-01`) depends on `toDate`, which **is** exported (`ui/src/index.ts:204`).
Cosmetic doc-completeness only — no functional gap.

**Recommendation**: Add `toDate` to the inventory line. Optional.

---

## Adversarial checklist (same-agent-bias safeguard)

- Behaviour bound to an external standard? Yes — the paint precedence and theme-role model. Verified
  against the actual `Theme`/`DrawContext`/`GridRows` source rather than memory; the one place memory
  diverged from code (theme roles) is PF-001.
- Any claim I could not verify against code? No — every code claim in the plan was checked to a
  `file:line`. `makeDrawContext` is cited but not load-bearing (the plan hand-builds a facade).
- Independent challenger run on the high-stakes findings? Yes — PF-001 and PF-002 both confirmed CORRECT.

## Resolution (iteration 2 — 2026-07-14)

User decisions were recorded and the fixes applied to the plan docs:

| # | Decision | Docs edited |
|---|---|---|
| PF-001 | **A′** — self-contained: `cellStyle` "red" returns an explicit `Style`; the error `⚠` uses `ctx.color('gridDirty').fg` over the row bg; semantic roles deferred to RD-14 (no core change) | `00-ambiguity-register.md` (AR-2 revised), `02-current-state.md`, `00-index.md`, `01-requirements.md`, `03-02-cell-rendering.md`, `07-testing-strategy.md` (ST-10/13/14), `99-execution-plan.md` (2.2.2) |
| PF-002 | **B** — widen `GridColumn.parse` to `(text)=>V \| typeof PARSE_FAILED`; reject the sentinel at `editing.ts:263` | `00-ambiguity-register.md` (AR-13 added), `02-current-state.md`, `00-index.md`, `01-requirements.md`, `03-01-formatter-registry.md`, `07` (ST-20 + `parse-commit.spec.test.ts`), `99` (Step 1.4, +3 tasks → 24 total, `PARSE_FAILED` barrel export) |
| PF-003 | Reworded — the override sets `topItem` via the protected `this.updateTop()` | `02-current-state.md`, `03-02-cell-rendering.md`, `99` (2.2.3) |
| PF-004 | Oracle scoped to values representable at the configured fraction-digits | `02-current-state.md`, `03-01`, `07` (ST-3) |
| PF-005 | `toDate` added to the barrel inventory | `02-current-state.md` |

**Re-scan verification**: a residual-reference sweep of the plan folder confirms the only surviving
`'danger'` mentions are the corrective notes stating the role does not exist; no `thin adapter` /
`keepVisible … protected access` wording remains. Task counts are internally consistent (Phase 1 = 10,
Phase 2 = 9, Phase 3 = 5; total 24). No `@jsvision/ui` source change is introduced (AR-1 intact — the
`parse`/commit edits are in `@jsvision/datagrid`).

## Disposition

`✅ PASSED` — all 🔴/🟠 resolved by explicit user choice and all 🟡/🔵 fixed in the same pass; zero findings
remain open. The plan is executable as written. **Next**: `/codeops:exec_plan formatting-rendering`
(spec-first; the RD-03 flow used `--auto-commit`). These plan-doc edits + this report are uncommitted
working-tree changes.
