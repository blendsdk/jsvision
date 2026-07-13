## Ambiguity Register: Cell Editors & Value Help (datagrid/RD-03 plan)

> **Status**: ✅ GATE PASSED — all 13 items resolved
> **Last Updated**: 2026-07-13
> **Scope**: This is the **plan-level** register for the `cell-editors` implementation plan. It records
> only decisions that arose while planning RD-03 (deliverable shape, how the typed-editor surface layers
> onto the already-shipped RD-01/RD-02 seam, naming, file structure, phasing) — **not** the
> requirement-level decisions, which live in
> [`../../requirements/00-ambiguity-register.md`](../../requirements/00-ambiguity-register.md) (AR-01…AR-32,
> gate passed + preflighted). Where a plan document reasons from a requirement-level decision it cites the
> requirements register (e.g. "req AR-32") or the owning RD section; plan-local entries below are cited as
> "AR #N (plan)".
> **Session note**: Items 1–3 decided by the user via `AskUserQuestion` on 2026-07-13; items 4–13 are
> grounded plan-authoring resolutions (repo convention / the requirement text / an acceptance criterion / a
> verified codebase fact) surfaced for the user's veto in the plan summary. The advisor tool was unavailable
> this session, so consequential recommendations were hardened in-context (grounded against `file:line`, each
> second-guessed) rather than via an independent challenger.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical / API | RD-03's TR specifies `createCellEditor(spec: CellEditorSpec, field, host)` (spec-based), but the shipped seam is `createCellEditor(column, field, host)` (`cell-editor.ts:45`) with an immutable spec oracle (ST-15) asserting the column shape, and RD-03's literal "absent editor → read-only" contradicts RD-02's shipped "parse+set ⇒ editable text `Input`". How do they reconcile? | (A) **Additive override, keep signature** — `createCellEditor(column, field, host)` stays; `editor?` is an optional **widget** override; `isEditable` (parse+set) stays the editability rule; no `editor` → today's text `Input` (ST-15 stays green); `editor:{kind}` picks the typed widget; `kind:'readonly'` is an explicit opt-out. Internal `resolveSpec(column,row) → switch(kind)`. · (B) Refactor to the RD's literal spec-based `createCellEditor(spec, …)` + a separate `resolveEditorSpec`, rewriting the immutable ST-15 as an RD-03 requirements change | (A) Additive override, keep signature — backward-compatible, least churn, keeps the immutable ST-15 green | ✅ Resolved |
| 2 | Behavior / Events | AC-6 says "F4 on a `lookup` cell opens the lookup popup", but `ComboBox.open()` is **protected** and no-ops without an `ev.popupHost` (`combo-box.ts:199-201`). What does F4 do and how is the open triggered without touching a ui-internal seam? | (A) **F4 begins edit + opens dropdown** in one press — mount the ComboBox editor, then trigger its open via its **public** key path (forward a synthetic `Alt+Down`, the trigger at `combo-box.ts:188`, reusing the dispatch envelope's `popupHost`) · (B) F4 begins edit like F2 (dropdown closed; user opens with the ComboBox's own key) · (C) F4 opens only while already editing | (A) F4 begins edit + opens dropdown (forward `Alt+Down`; `open()` stays untouched) | ✅ Resolved |
| 3 | Scope / Validation | RD-03 AC-9 ("editor input is validator-gated before commit") vs. the RD's own Won't-Have + RD-12 integration note ("enforcement/surfacing is RD-12; a failing validator blocks commit"). How far does RD-03 take validators? | (A) **Keystroke filter only** — wire the live `filter` validator into `Input` (invalid chars never enter, so the committed value is filter-conformant); the commit-time `valid()` gate + error surfacing stays in RD-12 · (B) Also block commit on `!editor.valid()` now (overlaps RD-12) | (A) Keystroke filter only; commit-time gating deferred to RD-12 | ✅ Resolved |
| 4 | Scope | Which `CellEditorKind`s ship in this plan, and what about `datetime`/`json`/`array` and the per-row function form? | The RD-03 `CellEditorKind` union is exactly `text \| integer \| decimal \| boolean \| date \| enum \| lookup \| readonly \| custom` (9 kinds). `datetime`/`json`/`array` are **not in the union** (the spike's superset only) → out of scope, no kind exposed. The per-row function form `editor: (row) => CellEditorSpec` is a Must-Have union member and its resolution is trivial (`typeof editor === 'function' ? editor(row) : editor`) → **included now** in `resolveSpec`, not deferred. | Recommended — grounded in the RD-03 TR union (lines 69-70) + the Must-Have descriptor; surfaced for veto. | ✅ Resolved (plan-authoring) |
| 5 | Naming / Structure | The new module layout for the RD-03 editor surface (single-barrel, 200–500-line files). | Grow `cell-editor.ts` to hold the **public** surface: the `CellEditorKind`/`CellEditorSpec`/`LookupItem`/`LookupProvider` types, `resolveSpec(column,row)`, and the `createCellEditor` widget switch (each stays ~150-200 lines). Add `editor-bridges.ts` for the **internal** typed adapters (`boolBridge`/`dateBridge`/`enumBridge`/`lookupBridge`) — not re-exported from the barrel. Edit `column.ts` (+`editor`), `editing.ts` (pass `row` to `createCellEditor`; F4 flag), `editable-grid-rows.ts` (F4 begin-edit trigger), `index.ts` (re-exports). | Recommended — one concern per file, flat single-barrel per the RD-01/RD-02 precedent; bridges stay internal like the spike. | ✅ Resolved (plan-authoring) |
| 6 | Technical / Async | How a `lookup` provider (`LookupItem[] \| () => Promise<LookupItem[]>`) loads its rows into the ComboBox. | The editor builds `const items = signal<LookupItem[]>([])`; a synchronous array seeds it immediately, an async provider is `void provider().then(rows => items.set(rows))` — the select-only ComboBox binds the live `items` signal, so the list re-renders when the promise resolves (the spike pattern, `editor-spec.ts:271-279`). Adapter effects (the `lookupBridge`) are created inside the overlay's reactive root so they dispose on close. | Recommended — grounded in the spike + `ComboBox` select-only live-`items` binding (`combo-box.ts:204`). | ✅ Resolved (plan-authoring) |
| 7 | Testing | A bare `createEventLoop` has `popupHost === undefined`, so a real dropdown **no-ops headlessly** (`event-loop.ts:526`). How is AC-6 (F4 opens the popup) asserted without a TTY? | The datagrid F4 test wires `loop.popupHost = { overlay, focusView, getFocused }` over a full-viewport overlay `Group` (the exact ui pattern in `combobox.spec.test.ts:65-67`), then asserts `popupOpen(overlay)` after F4. This overlay is separate from the grid's own editor-mount `overlay`. | Recommended — the authoritative headless popup-open pattern already used by ui's own ComboBox spec. | ✅ Resolved (plan-authoring) |
| 8 | Technical / Events | The mechanism by which F4 triggers the ComboBox open, given `open()` is protected. | The editing controller, after `beginEdit` mounts + focuses the ComboBox on an F4-on-lookup path, forwards a synthetic `Alt+Down` `DispatchEvent` (built from the real envelope, reusing `ev.popupHost`/`ev.focusView`) to the mounted ComboBox's public `onEvent` — which opens on `inner.alt` regardless of the inner field's focus (`combo-box.ts:188`). No access to `ComboBox.open()` or the popup seam; honors RD-03's "no direct use of the ui-internal popup seam". | Recommended — grounded in the public `ComboBox.onEvent` Alt+Down trigger + the `DispatchEvent` shape used across RD-02 (`editable-grid-rows.ts`). | ✅ Resolved (plan-authoring) |
| 9 | Behavior | Commit value for a `lookup` cell — key or label (req AR-32)? | The edit `field` holds the **key**; the ComboBox shows the **label** via `getText(item) = item.label`; `lookupBridge(field, items)` maps `field(key) ⟷ value(LookupItem)`. On commit RD-02's `parse(field())` sees the key. AC-3 verifies the committed value is the key, not the label. | Recommended — the requirement decided key (req AR-32); this is the wiring. | ✅ Resolved (plan-authoring) |
| 10 | Behavior | The boolean/date editors' commit path through the string field. | `boolean` → `CheckGroup` over `boolBridge(field)` (`Signal<boolean[]>`); toggling (Space) writes `'true'`/`'false'` into `field`; RD-02's Enter commits `field()`. `date` → `DatePicker` over `dateBridge(field)` (`Signal<CalendarDate\|null>` via core `toISO`/`parseISO`); the field stays the authoritative ISO `YYYY-MM-DD` string. Each bridge is a pair of `untrack`-guarded effects (write only on change) to avoid feedback loops. | Recommended — grounded in the spike bridges (`editor-spec.ts:190-244`) + the confirmed widget option shapes (`CheckGroupOptions`/`DatePickerOptions`). | ✅ Resolved (plan-authoring) |
| 11 | Scope / Showcase | Where the mandated editor kitchen-sink stories live and what they cover. | Extend the **in-package** kitchen-sink harness (RD-01/RD-02 precedent) with stories exercising the built-in editor kinds (boolean, date, enum, lookup) beside the existing text `editing` story; the local smoke test covers them (unique id + required metadata + paints headlessly). | Recommended — continues the in-package showcase precedent (req/plan AR for RD-02 #12). | ✅ Resolved (plan-authoring) |
| 12 | Non-functional | The verify command that fills every `Verify` line. | Inner loop: `yarn workspace @jsvision/datagrid test <spec>` (red/green). Phase gate: `yarn workspace @jsvision/datagrid typecheck` + `test` + `check:docs` (run **separately** — one script per `yarn workspace` invocation; the combined form trips TS5042). Done gate: full `yarn verify` (the environment-sensitive `@jsvision/ui` `editor-perf` 16 ms ceiling may be excluded via `TUI_SKIP_PERF=1` per `CLAUDE.md` — it never gates and passes in isolation). | Recommended — single interpretation from `CLAUDE.md` → Commands; same as the RD-02 plan's AR #10. | ✅ Resolved (plan-authoring) |
| 13 | Naming | The plan folder slug. | `cell-editors` — matches the RD title ("Cell Editors & Value Help") and the roadmap RD-03 row. | Recommended — single consistent interpretation. | ✅ Resolved (plan-authoring) |

### Resolution Notes

**AR #1 (plan):** The `editor` descriptor is an **additive widget override**, not a replacement of the shipped
editability rule. A column stays **editable** exactly when `isEditable(col)` (both `parse` and `set`) — RD-02's
contract, unchanged. `resolveSpec(column, row)` produces the `CellEditorSpec`: when `column.editor` is a
function it is called with the row; when it is a literal it is used directly; when it is **absent** on an
editable column the spec defaults to `{ kind: 'text' }` (today's behavior — so ST-15's `createCellEditor →
Input` stays green). `editor: { kind: 'readonly' }` on an otherwise-editable column is an **explicit** read-only
opt-out (`createCellEditor` returns `null` → begin-edit rejected). The public signature stays
`createCellEditor(column, field, host, row?)` — `row` is a new **optional** trailing parameter (ST-15's 3-arg
call still type-checks; the editing controller always passes `cell.row`). Option (B) was rejected: it changes a
shipped public signature and rewrites an immutable oracle for no functional gain over the internal resolver.

**AR #2 (plan):** F4 on a `lookup` (or `enum`) cell begins the edit **and** opens the dropdown in one press —
the classic SAP/Access "F4 = value help". `EditableGridRows` treats F4 like F2 for begin-edit and flags the
controller to auto-open; the controller forwards a synthetic `Alt+Down` to the just-mounted ComboBox's public
`onEvent` (which opens on `inner.alt`, `combo-box.ts:188`). F4 on a non-combo editable cell begins the edit
with no dropdown (a harmless generalization); F4 on a read-only cell is a no-op (falls through to the base).
`ComboBox.open()` is never called directly — it is protected, and forwarding the public key honors RD-03's "no
direct use of the ui-internal popup seam".

**AR #3 (plan):** RD-03 wires only the **live keystroke** validator: `new Input({ value: field, validator })`
where `validator = spec.validator ?? defaultValidator(kind)` (integer → `filter('0-9-')`, decimal →
`filter('0-9.-')`, else none). This satisfies AC-9's "validator-gated before commit" at the keystroke level —
an invalid character never enters the buffer, so the committed value is filter-conformant. The commit-time
`Input.valid()` **gate** (blocking commit + surfacing the error) is out of scope, deferred to RD-12 per the RD's
own Won't-Have. No change to RD-02's commit path.

**AR #4 (plan):** The nine shipped kinds are `text`, `integer`, `decimal` (all `Input`, with the kind's
keystroke filter), `boolean` (`CheckGroup`), `date` (`DatePicker`), `enum` (select-only `ComboBox<string>`),
`lookup` (select-only `ComboBox<LookupItem>` + F4 value help), `readonly` (`null`), and `custom` (the caller's
factory). `datetime`, `json`, and `array` are deliberately absent from the `CellEditorKind` union — they are a
later RD (a column that wants raw-text editing today simply omits `editor` and gets the text `Input`). The
per-row function form is resolved in `resolveSpec` now (trivial), so a column may vary its editor by row state
without a follow-up.

**AR #5 (plan):** `cell-editor.ts` owns the public surface (types + `resolveSpec` + `createCellEditor`);
`editor-bridges.ts` owns the four internal `untrack`-guarded typed adapters. The bridges are **not** re-exported
from `index.ts` — they are an implementation detail of `createCellEditor`, exactly as in the spike. Both files
stay well under the 500-line ceiling.

**AR #6–#12 (plan):** grounded wiring/testing/verify resolutions — see each row above; all trace to a verified
`file:line` in `@jsvision/ui`, the spike `editor-spec.ts`, or the shipped datagrid source.

**Preflight addendum (2026-07-13, see [00-preflight-report.md](00-preflight-report.md)).** The codebase-grounded
audit refined two AR #6/#10 mechanisms that were stated during authoring as already-true but were not:
- **PF-001** — AR #6's "the spike pattern" for the async lookup is **not safe verbatim**: the spike's
  `lookupBridge` reverse effect clobbers a seeded FK key with `''` on mount. The ported bridge adds an
  `if (sel !== null …)` guard (03-02). AR #6/#9 (lookup key-not-label, load-once) are otherwise unchanged.
- **PF-002** — AR #6/#10's "adapter effects are created inside the overlay's reactive root so they dispose on
  close" required a restructure to become true: `createCellEditor` runs one statement *before*
  `mountCellOverlay`'s `createRoot`, so the plan now constructs the editor **inside** that root via a
  build-callback (02-current-state · 03-02 · Phase 2). No user-facing decision changed — these are wiring
  corrections, not reversals.
