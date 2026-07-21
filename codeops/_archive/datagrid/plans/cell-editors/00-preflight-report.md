# Preflight Report — Cell Editors & Value Help (datagrid/RD-03 plan)

> **Artifact**: `codeops/features/datagrid/plans/cell-editors/` (all 9 plan docs)
> **Date**: 2026-07-13 · **CodeOps Skills Version**: 3.7.0
> **Iteration**: 1 (findings) → fixes applied same-session + consistency re-sweep
> **Result**: ✅ **PASSED** — all 6 findings resolved; recommended fixes applied to the plan docs (see Decisions)
>
> ⚠️ **SAME-SESSION REVIEW** — this plan was authored in the current session. To counteract same-agent
> bias, every codebase claim was independently re-verified by separate recon agents reading the actual
> source, and the two high-severity findings were put through an independent adversarial challenger
> that tried to *refute* them (both survived, confirmed by runtime trace). Consider a fresh-session
> re-scan for full independence.

## Codebase Context Summary

The plan grows the RD-02 editor seam (`createCellEditor`, `packages/datagrid/src/cell-editor.ts:45`)
into a typed editor set, binding `@jsvision/ui` widgets to the single `Signal<string>` edit field via
four `untrack`-guarded bridges ported from the inert spike (`packages/spike-data-studio/src/editor-spec.ts`).
Recon verified against the real source:

- **Seam & callers** — `cell-editor.ts` is the 48-line shape the plan states; `beginEdit` (`editing.ts`)
  is the sole caller, pre-gates on `isEditable`, treats `null` as reject, has `cell.row` in scope, and
  commits via `tcol.parse!(field())` (`editing.ts:222-228`). ✔ accurate.
- **ui widgets** — `Input`/`CheckGroup`/`DatePicker`/`ComboBox`, `filter`, `Validator`, `toISO`/`parseISO`/
  `CalendarDate`, `signal`/`effect`/`untrack`/`Group` are all barrel-exported. Option shapes, `filter`
  char-class semantics, single-boolean `CheckGroup` (Space toggles `[false]↔[true]`), `DatePicker` ISO
  default + `parseISO('')→null`, and `ComboBox` (opens on `Alt+Down` regardless of focus; `open()`
  protected; `onEvent` public taking a **`DispatchEvent` envelope**; select-only binds live `items`) —
  all ✔ as the plan states.
- **F4 synthetic event** — the proposed `{ ...ev, event: { type:'key', key:'down', alt:true, ... }, handled:false }`
  is structurally valid against `DispatchEvent`/`KeyEvent` and correctly preserves `popupHost` via the
  spread. ✔ sound.
- **Headless popup harness** — `popupHost` undefined ⇒ open no-ops (`event-loop.ts:525`); the
  `combobox.spec.test.ts` `popupOpen(overlay)` helper is exactly as the plan cites. ✔ accurate.
- **Reactive ownership** — `mountCellOverlay`'s `createRoot` (`overlay.ts:84`) wraps `host.add(view)` +
  `focusView`, **not** editor construction (which happens one statement earlier at `editing.ts:178`).
  This is the root of PF-002.

## Findings

| ID | Sev | Dimension | Summary |
|----|-----|-----------|---------|
| PF-001 | 🔴 CRITICAL | Codebase Alignment / Edge Cases | `lookupBridge` (ported verbatim) writes `''` over a seeded FK key on mount → silent data loss on the primary lookup use case |
| PF-002 | 🟠 MAJOR | Codebase Alignment / Feasibility | Bridge `effect()`s are created **before** the mount `createRoot` and have no ambient owner → they leak + dev-warn and do **not** dispose on editor close; the plan's ownership claim (03-02:30-31) is false |
| PF-003 | 🟡 MINOR | Testability | ST-5 seeds `field=''`, so it never exercises the "edit an existing key" path — the exact path PF-001 corrupts; the spec would pass with the buggy bridge |
| PF-004 | 🟡 MINOR | Edge Cases | Ported `boolBridge`/`dateBridge` coerce empty/non-canonical fields on mount (`''→'false'`; unparseable date `→''`); benign under the plan's format contracts but undocumented |
| PF-005 | 🟡 MINOR | Testability | ST-7's focus-target expectation for a `ComboBox` is ambiguous ("the widget, or `combo.input`"); an immutable oracle must pin one |
| PF-006 | 🔵 OBS | Consistency | Doc literal `createCellEditor(tcol, field, host, cell.row)` mis-states the current 3rd arg `{ overlay: host.overlay }`; executor must preserve it |

---

### 🔴 PF-001 — `lookupBridge` destroys an existing foreign-key value on mount

**Where**: `03-02-typed-bridges.md:86-91` (the `lookupBridge` code, ported verbatim from spike
`editor-spec.ts:232-244`); consumed by `buildLookupEditor` (`03-03:12-20`).

**Defect** (confirmed by runtime trace + independent challenger): the bridge seeds `sel = signal(null)`
and the async provider leaves `items()` empty on mount. `effect()` runs **eagerly** at creation
(`effect.ts:5-6,47`). With a real seeded key (`field()==='7'`, set at `editing.ts:177` from the existing
cell value), the reverse effect computes `key = sel()?.key ?? '' = ''`, the guard `'7' !== ''` is true
(`Object.is` dedup does not save it, `signal.ts:52-56`), so **`field.set('')`** fires — wiping the key
*before* the lookup rows load. When `items` resolves, the forward effect matches the now-empty field to
`null`; the value is permanently lost and the cell shows blank. This is silent data loss on the flagship
RD-03 feature (F4 value-help on an existing FK column).

Root cause: `lookupBridge` is the one bridge that can't seed its control signal from the field (the
`LookupItem` label is async), so its reverse effect overwrites the field on mount. Its three siblings
seed from `field()` and are safe.

**Options**:
- **(A, recommended)** Guard the reverse effect so it never clobbers a non-empty field with `''`: only
  write the key when a selection actually exists — `effect(() => { const s = sel(); untrack(() => { if (s !== null && field() !== s.key) field.set(s.key); }); })`. On mount `sel===null` ⇒ no write ⇒ the seeded key survives; when `items` load, the forward effect matches the key → `sel` → the reverse write is a no-op; a user pick writes the new key. (Trade-off: "select nothing to clear" no longer writes `''`; out of scope for select-only lookup, and can be added deliberately later.) Update 03-02 + fix the false ownership sentence per PF-002.
- **(B)** Seed `sel` synchronously for the static-array provider and, for async, defer the reverse effect's first run until `items` is non-empty (a `loaded` flag). More faithful to "clear = write ''", more moving parts.

**Recommendation**: **(A)** — minimal, preserves the no-loop design, kills the data loss. Pair with PF-003
(a spec test that seeds an existing key and asserts it survives). **Confidence: High.** **Hardening**: recon
agent traced the clobber; an independent adversarial challenger tried to refute it against the real runtime
and confirmed every link (eager `effect`, `Object.is` non-dedup, no gating owner).

---

### 🟠 PF-002 — Bridge effects are unowned; they leak and do not dispose on editor close

**Where**: `03-02-typed-bridges.md:30-31` claims: *"bridges are created inside the overlay's reactive
root (`createCellEditor` runs under `mountCellOverlay`'s `createRoot`, `overlay.ts:84`), so the effects
dispose when the editor closes — no leak."* **This is false.**

**Defect** (confirmed by runtime trace + challenger): `createCellEditor(...)` runs at `editing.ts:178`;
`mountCellOverlay` (whose `createRoot` is `overlay.ts:84`) is called seven lines later at `editing.ts:185`,
and it takes a **pre-built `view`** (`overlay.ts:69-75`) — so the editor, and the bridge `effect()`s
created inline as constructor args (`value: boolBridge(field)`), are fully constructed *before* the root
exists. During event dispatch there is **no ambient reactive owner** (`event-loop.ts` `runTick`/`dispatch`
set none), so `attachComputation` logs the "created outside any `createRoot()` scope; will never be
auto-disposed (potential leak)" dev-warning (`owner.ts:26-38`) and the two effects per typed edit **leak
for the app's lifetime**, never disposing on editor close. (The widgets' *own* mount-time bindings do run
under the root and dispose — but those are a different effect set; the bridge sync effects are already
outside it.) Note: RD-02's shipped `Input` editor never hit this because `Input` defers binding to
`onMount`; RD-03's factory-time `effect()`s are the first eager ones.

**Options**:
- **(A, recommended)** Construct the editor **inside** the mount root: extend `mountCellOverlay` to accept
  a `factory: () => View` (or `(host) => View`) and call it inside its `createRoot` (`overlay.ts:84`), so
  every `effect()` the editor creates is owned by that scope and disposed by the existing teardown. Keeps
  disposal automatic; a small datagrid-internal change (no ui promotion). The Phase-4 F4 forward needs the
  editor reference after mount — have the factory/`mountCellOverlay` return it.
- **(B)** Wrap the `createCellEditor` call in editing.ts in its own `createRoot((dispose) => …)` and compose
  `dispose` into the overlay teardown. Local to editing.ts; two disposers to thread.
- **(C)** Make each bridge defer its `effect()` creation to a mount hook — heavier, bridges aren't Views.

**Recommendation**: **(A)** — the editor and its effects belong in one owned scope; the overlay already owns
the disposer. Requires a plan-doc update (02-current-state impact table, 03-02 ownership paragraph, a task
in Phase 2 to restructure `mountCellOverlay`, and awareness in Phase 4's F4 wiring). **Confidence: High.**
**Hardening**: independent challenger confirmed construction precedes the root, no dispatch-time owner
exists, and the plan's specific claim is false.

---

### 🟡 PF-003 — ST-5 never exercises the "edit an existing key" path (hides PF-001)

**Where**: `07-testing-strategy.md:37` (ST-5 seeds `field=''`). With an empty seed there is nothing for the
reverse effect to clobber, so ST-5 passes even with the PF-001 bug. **Fix**: add a spec case (or extend ST-5)
seeding `field` with a pre-existing key (e.g. `'7'`) and asserting that after `tick()` the ComboBox shows
that key's label **and**, with no user interaction, commit yields the **same key `'7'`** (not `''`). This is
the regression oracle for PF-001. **Recommendation**: add the case. **Confidence: High.**

### 🟡 PF-004 — Ported boolean/date bridges coerce empty/non-canonical fields on mount

**Where**: `03-02` `boolBridge` / `dateBridge`. On mount `boolBridge` turns an empty field into `'false'`
(no tri-state / NULL boolean), and `dateBridge` rewrites a non-canonical or unparseable field to `''`.
Both are **benign under the plan's own format contracts** (boolean columns format to `'true'`/`'false'`;
date columns hold ISO), so no ST triggers them — but they are undocumented mount side-effects on a dirty/NULL
cell. **Options**: (A) document the limitation in the `boolean`/`date` editor JSDoc + an impl-test note;
(B) also guard the reverse writes as in PF-001(A). **Recommendation**: **(A)** — document; a guard is optional
polish given the contracts. **Confidence: Medium.**

### 🟡 PF-005 — ST-7 focus-target expectation for ComboBox is ambiguous

**Where**: `07-testing-strategy.md:39` — ST-7 asserts `getFocused()` is "that editor's focus target (the
widget, or `combo.input` for a ComboBox)". The editing controller focuses the returned `editor` (the
`ComboBox`), but the only focusable descendant is `combo.input`. An immutable oracle must assert exactly one
value. **Fix**: pin ST-7 to the concrete `getFocused()` the mount produces for a ComboBox (verify empirically
during Phase 4 spec-writing and state it). **Recommendation**: pin it. **Confidence: Medium.**

### 🔵 PF-006 — Doc literal mis-states the current 3rd argument

**Where**: 00-index Key Decisions + task 1.2.4 show `createCellEditor(tcol, field, host, cell.row)`, but the
current call passes the literal `{ overlay: host.overlay }` (not a bare `host`). 02-current-state has it
right. **Fix**: append `, cell.row` to the existing `{ overlay: host.overlay }` call; a one-word note in
task 1.2.4. Cosmetic. **Recommendation**: note it. **Confidence: High.**

## Decisions

User accepted all recommendations (2026-07-13). Fixes applied to the plan docs (no code executed):

| ID | Decision | Status |
|----|----------|--------|
| PF-001 | Accept rec (A): guard `lookupBridge` reverse effect (`if (sel !== null …)`) + add ST-5(b) existing-key regression | ✅ Applied — 03-02, 07 (ST-5b), 99 (3.1.1/3.2.1) |
| PF-002 | Accept rec (A): construct the editor inside `mountCellOverlay`'s `createRoot` (build-callback) so bridge effects dispose on close | ✅ Applied — 02, 03-01, 03-02, 03-03, 99 (new task 2.2.1) |
| PF-003 | Accept: add the existing-key lookup regression oracle | ✅ Applied — 07 (ST-5b), 99 (3.1.1) |
| PF-004 | Accept rec (A): document the boolean/date mount-coercion limitation | ✅ Applied — 03-02 mount notes, 99 (2.2.2) |
| PF-005 | Accept: pin ST-7's ComboBox focus target to `combo.input` | ✅ Applied — 07 (ST-7), 99 (4.1.1) |
| PF-006 | Accept: clarify task 1.2.4 to append `cell.row`, keep the `{ overlay: host.overlay }` literal | ✅ Applied — 99 (1.2.4) |

**Iteration-2 consistency re-sweep**: corrected two docs that still stated the pre-fix assumptions as settled —
the AR #6 async-lookup note (register "Preflight addendum") and the 02 "reference decode" ("ports the bridges…
not verbatim"). No residual contradiction found.

## Relationship to the Ambiguity Register

These are post-authoring findings, not re-litigations of `00-ambiguity-register.md`. PF-001/PF-002 are
codebase-alignment defects the creation-time gate missed (a verbatim spike port + an unverified ownership
assumption); PF-003/PF-005 are testability gaps; PF-004/PF-006 are edge/consistency notes. AR #3 (keystroke
filter only) and AR #6/#9 (lookup key-not-label, async load) remain valid decisions — PF-001 is a *wiring
bug* in realizing AR #9, not a reversal of it.
