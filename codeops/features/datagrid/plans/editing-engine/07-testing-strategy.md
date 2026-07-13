# Testing Strategy — Editing Engine

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Refs**: RD-02 AC-1…AC-10 · the plan's ST-1…ST-17

Spec-first: each `ST-*` is an **immutable oracle** derived from an AC or a plan decision — a failing spec test
means the code is wrong, never the test. Expectations come from the spec, never from imagined behavior. Impl
tests (`*.impl.test.ts`) cover internals/edges. All datagrid tests import `@jsvision/core`/`@jsvision/ui` by name
(built dist), per the RD-01 convention.

## Test harness note

Grid views need a mounted event loop + a real viewport to have `bounds`/`geometry`. Follow the RD-01 grid specs'
pattern: build a `createEventLoop({ width, height }, { caps: resolveCapabilities().profile })`, mount a root
`Group` holding the grid at an absolute rect, `loop.focusView(grid.rows)`, and drive `loop.dispatch(...)` with
synthetic key/mouse envelopes. Assert on `loop.getFocused()`, the serialized frame
(`serialize(buffer, null, { caps })`), the record, and `grid.isDirty(...)`. For async-commit tests use an
`onCommit` returning a **deferred** `Promise<boolean>` so the pending window is observable.

## Specification Test Cases

| ST | AC | Input → Expected | File |
| -- | -- | ---------------- | ---- |
| **ST-1** | 1 | Cursor on a **read-only** column (no `parse`/`set`); dispatch `Enter`, then `F2` → **no** editor mounts (`getFocused()` unchanged = the body), the record is untouched. | `editing.spec.test.ts` |
| **ST-2** | 1 | Cursor on an **editable** column; dispatch `Enter` (then separately `F2`) → an editor mounts and `loop.getFocused() === editor`. | `editing.spec.test.ts` |
| **ST-3** | 2 | Cursor on an editable cell; dispatch printable `'x'` → editor mounts and the field **equals** `'x'` (content replaced), not `previous + 'x'`. | `editing.spec.test.ts` |
| **ST-4** | 3 | While editing, dispatch a printable → it lands in the editor and the grid cursor does **not** move. Then `Enter` → `onCommit`→true, editor closes, `focusedCol` unchanged, `focused === row + 1` (clamped). | `editing.spec.test.ts` |
| **ST-5** | 4 | While editing (field changed), dispatch `Esc` → the cell shows `previous`, the editor is closed (`getFocused()` = body), and `onCommit` was **not** called. | `editing.spec.test.ts` |
| **ST-6** | 5 | Edit + `Enter` with `onCommit` spy: called **exactly once** with `{ rowKey, columnId, value: parse(field), previous, row }`. `onCommit → false`: editor **remains open**, cell shows `previous`. `onCommit → true`: editor closes, cell shows the new value. | `editing.spec.test.ts` |
| **ST-7** | 6 | `Tab` while editing the **last** column → commit, then cursor at **first column of the next row**. `Shift-Tab` while editing the **first** column → cursor at **last column of the previous row**. Grid **corner** (last cell / first cell) clamps. | `editing.spec.test.ts` |
| **ST-8** | 7 | Async `onCommit` (deferred promise). On `Enter`: `isDirty(rowKey, columnId) === true` while pending; resolve `true` → `isDirty === false`. Draw a body whose registry marks a cell dirty → the serialized frame shows `'•'` at that cell in the `gridDirty` foreground. | `dirty.spec.test.ts` |
| **ST-9** | 8 | On begin-edit, the mounted overlay's `bounds` = the focused cell rect (`width = column width`, `height = 1`). On close, an `onCleanup` registered inside the editor's scope **fires** (owner disposal — no leaked binding effect). | `editing.spec.test.ts` |
| **ST-10** | 9 | The `editing` story is registered (unique id + required metadata) and paints headlessly; a scripted nav → edit → commit sequence mutates the bound row. | `kitchen-sink.smoke.spec.test.ts` |
| **ST-11** | 10 | Type a control byte (``) into the editor, commit, render → the serialized frame contains **no** raw ESC/BEL. The only record mutation observed is via the `onCommit`/`set` path (a spy confirms no out-of-band persistence). | `security.spec.test.ts` |
| **ST-12** | — | `←`/`→` move `focusedCol` (clamped at `0` / `n−1`); `Home`/`End` jump col ends; `Ctrl+Home`/`Ctrl+End` jump grid corners; `↑`/`↓`/`PgUp`/`PgDn` still move the **row** (base fall-through intact). | `editable-grid-rows.spec.test.ts` |
| **ST-13** | — | With the body focused, the focused cell is overpainted in `gridCursor` (the serialized frame shows the cursor cell distinct from the `listFocused` row); with the body **not** focused, no cursor box. | `editable-grid-rows.spec.test.ts` |
| **ST-14** | — | A second commit for the **same** cell issued while the first is in flight is serialized (does not overlap) — the per-cell `committing` guard blocks a concurrent begin-edit/commit on that cell. | `editing.impl.test.ts` |
| **ST-15** | — | `column.set` writes the value into the record; `isEditable` is `true` only when both `parse` **and** `set` are present; `createCellEditor` returns an `Input` for an editable column and `null` for a read-only one. | `cell-editor.spec.test.ts` |
| **ST-16** | — | `defaultTheme.gridCursor` and `defaultTheme.gridDirty` equal their frozen bytes (`gridCursor = black-on-brightWhite`, `gridDirty.fg = brightRed`); `encode()` of each at all four color depths does not throw. | `grid-theme.spec.test.ts` |
| **ST-17** | — | The field round-trip: seeded from `format(value)` (or `String(value)` when no formatter); a printable begin-edit seeds the typed char; commit parses `field()` back with `parse` before `set`/`onCommit`. | `cell-editor.impl.test.ts` |

## AC → ST coverage map

| AC | Covered by |
| -- | ---------- |
| AC-1 read-only no-op / editable mounts + `getFocused` | ST-1, ST-2 |
| AC-2 printable replaces | ST-3 |
| AC-3 keys route to editor; Enter → next row, `focusedCol` unchanged | ST-4 |
| AC-4 Esc reverts + closes, no `onCommit` | ST-5 |
| AC-5 `onCommit` once; false keeps open + previous; true closes + new | ST-6 |
| AC-6 Tab/Shift-Tab row wrap | ST-7 |
| AC-7 dirty marker + `isDirty` | ST-8 |
| AC-8 overlay one-cell rect + owner disposal | ST-9 |
| AC-9 editable kitchen-sink story + smoke | ST-10 |
| AC-10 control-byte sanitized; no out-of-band persistence | ST-11 |
| (foundational) write seam / editor factory / roles / cursor / serialization / round-trip | ST-12…ST-17 |

## Impl test coverage (non-exhaustive)

- `editable-grid-rows.impl.test.ts` — corner clamp exactness; `Space`-as-printable on editable vs read-only;
  cursor overpaint math at H-scroll offsets + partial-width edge columns; `focusedCol` bind repaint.
- `editing.impl.test.ts` — veto keeps the field for re-editing; `version` bump repaints a mutated-in-place row;
  the `committing` guard (ST-14); async resolve ordering (dirty clears after `bumpVersion`).
- `dirty.impl.test.ts` — `createDirtyRegistry` reactivity (fresh Set ref on add/delete); `cellKey` NUL join;
  `isRowDirty`/`isGridDirty` rollups.
- `cell-editor.impl.test.ts` — ST-17 round-trip; `createCellEditor` host arg ignored by the text `Input`.
- `grid.impl.test.ts` (extend) — container owns/injects the shared signals; `onCommit` threads through;
  `isDirty`/rollups.

## Verify

Per AR #10: phase/done gates run `yarn verify`; the inner loop runs
`yarn workspace @jsvision/datagrid <build|typecheck|test|check:docs>` and
`yarn workspace @jsvision/core test check:docs` (the new roles). No fabricated timings.
