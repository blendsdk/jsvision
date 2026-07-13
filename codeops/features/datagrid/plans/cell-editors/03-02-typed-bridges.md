# 03-02 — Typed Bridges (string field ⟷ typed control)

> **Document**: 03-02-typed-bridges.md
> **Parent**: [Index](00-index.md)
> **Owns**: the four internal typed adapters in `editor-bridges.ts` (`boolBridge`, `dateBridge`, `enumBridge`,
> `lookupBridge`) and the no-feedback-loop discipline. `createCellEditor` (03-01) calls these; the barrel does
> not export them.

## Why bridges exist

RD-02's edit `field` is a single `Signal<string>` — the authoritative buffer `parse` reads on commit. But
`CheckGroup` wants `Signal<boolean[]>`, `DatePicker` wants `Signal<CalendarDate | null>`, and `ComboBox` wants
`Signal<T | null>`. A **bridge** is a pair of `untrack`-guarded effects that keeps the typed control signal and
the string field in sync **without a feedback loop**: each effect reads only the *other* signal and writes only
on a real change (AR #10). The controls never see the string; `field` never sees the typed value — so RD-02's
commit path is untouched.

## The no-loop discipline (the invariant every bridge obeys)

```ts
// field → control: on a field change, update the control (untracked write, only if different)
effect(() => { const v = fromField(field()); untrack(() => !eq(ctrl(), v) && ctrl.set(v)); });
// control → field: on a control change, update the field (untracked write, only if different)
effect(() => { const s = toField(ctrl()); untrack(() => field() !== s && field.set(s)); });
```

- The `untrack(...)` wrapper stops the write from re-subscribing the *writing* effect to the signal it writes;
  the `!== / !eq` guard stops a no-op write from scheduling the *other* effect. Together they converge in one
  pass — asserted by ST-9's effect-run counts (AC-7).
- **Ownership (effects must dispose on close).** These bridge `effect()`s run **eagerly** the moment the bridge
  function is called — inline in the `createCellEditor` switch (e.g. `value: boolBridge(field)`), i.e. at
  editor-construction time, not in a view `onMount`. For them to be torn down when the editor closes they must
  be created **inside** the overlay's reactive root. The RD-02 seam constructs the editor one statement
  *before* `mountCellOverlay`'s `createRoot` (`overlay.ts:84`), so a factory-time `effect()` would be
  **unowned** — it dev-warns ("created outside any `createRoot()` scope; never auto-disposed") and leaks one
  pair per begin-edit. The fix (03-01 §4 · 02-current-state impact table · Phase 2 task): restructure the
  begin-edit path so `createCellEditor` is invoked **inside** `mountCellOverlay`'s `createRoot` (via a build
  callback), returning the built editor for the F4 forward; then every bridge effect belongs to that scope and
  disposes on overlay close. (RD-02's default `Input` bound its effects in `onMount`, so it never hit this —
  the bridges are the first factory-time effects, which is why the seam needs this one adjustment.)

## `boolBridge(field): Signal<boolean[]>` — `CheckGroup`

```ts
export function boolBridge(field: Signal<string>): Signal<boolean[]> {
  const b = signal<boolean[]>([field() === 'true']);
  effect(() => { const v = field() === 'true'; untrack(() => b()[0] !== v && b.set([v])); });
  effect(() => { const v = b()[0] ? 'true' : 'false'; untrack(() => field() !== v && field.set(v)); });
  return b;
}
```

- The field's canonical strings are `'true'`/`'false'` (any non-`'true'` field reads as `false`). Toggling the
  single checkbox (Space) writes the flipped string; RD-02's Enter commits `field()` → `parse` yields the bool
  (AC-1). `CheckGroupOptions` is `{ labels, value: Signal<boolean[]> }` (verified `check-group.ts:12`), so the
  single-item `[bool]` shape is exact.
- **Mount note (documented limitation).** An empty/non-`'true'` field reads as `false`, and the reverse effect
  canonicalizes it to `'false'` on mount — `CheckGroup`'s `boolean[]` has no tri-state, so a NULL/empty boolean
  cannot be represented (it renders and commits as `false`). Under the RD-03 boolean contract
  (`format: v => v ? 'true' : 'false'`) the field is always `'true'`/`'false'`, so this is benign; **state it in
  the `boolean` editor's shipped JSDoc** so a caller with nullable booleans knows opening the editor coerces
  NULL → `false`.

## `dateBridge(field): Signal<CalendarDate | null>` — `DatePicker`

```ts
export function dateBridge(field: Signal<string>): Signal<CalendarDate | null> {
  const d = signal<CalendarDate | null>(parseISO(field()));
  effect(() => { const parsed = parseISO(field()); untrack(() => d.set(parsed)); });
  effect(() => { const iso = d() ? toISO(d()!) : ''; untrack(() => field() !== iso && field.set(iso)); });
  return d;
}
```

- `parseISO`/`toISO` are the core helpers (re-exported from `@jsvision/ui`). The field stays the authoritative
  ISO `YYYY-MM-DD` string; picking a day writes ISO back; an empty/invalid field is `null` (no selection). Commit
  yields the ISO string (AC-1). `DatePickerOptions.value` is `Signal<CalendarDate | null>` (verified).
- The `field → d` effect uses an unconditional `d.set(parsed)` (the spike form): `parseISO` returns a fresh
  object, and `DatePicker` compares by day value, so a same-day reset is idempotent; the guard on the reverse
  effect prevents the loop.
- **Mount note (documented limitation).** A non-canonical field is normalized to canonical ISO on mount, and an
  **unparseable** field (`parseISO` returns `null`) is rewritten to `''`. Under the RD-03 date contract (the
  field holds ISO `YYYY-MM-DD`) this is a no-op, so no ST triggers it; **state in the `date` editor's shipped
  JSDoc** that opening the editor on a malformed date string clears it.

## `enumBridge(field): Signal<string | null>` — select-only `ComboBox<string>`

```ts
export function enumBridge(field: Signal<string>): Signal<string | null> {
  const s = signal<string | null>(field() === '' ? null : field());
  effect(() => { const v = field() === '' ? null : field(); untrack(() => s.set(v)); });
  effect(() => { const v = s() ?? ''; untrack(() => field() !== v && field.set(v)); });
  return s;
}
```

- `'' ⟷ null` (empty field = no selection). The ComboBox lists exactly `spec.values` in order (03-01 seeds
  `items`); selecting the *n*-th value sets `s` → writes that string to `field` → commit yields it (AC-2).
- This is the spike's `stringOrNullBridge`, renamed `enumBridge` for the datagrid surface (it is the enum
  adapter; the lookup adapter is distinct below).

## `lookupBridge(field, items): Signal<LookupItem | null>` — `ComboBox<LookupItem>`

```ts
export function lookupBridge(field: Signal<string>, items: Signal<LookupItem[]>): Signal<LookupItem | null> {
  const sel = signal<LookupItem | null>(null);
  // field → sel: re-match the key against the (possibly async-loaded) rows.
  effect(() => { const key = field(); const m = items().find((it) => it.key === key) ?? null; untrack(() => sel.set(m)); });
  // sel → field: write ONLY when a row is actually selected. Do NOT clobber a seeded key with '' while the
  // rows are still loading (`sel` is null on mount) — an unconditional reverse write would destroy the
  // existing FK value before the async items arrive.
  effect(() => { const s = sel(); untrack(() => { if (s !== null && field() !== s.key) field.set(s.key); }); });
  return sel;
}
```

- The field holds the **key**; `sel` holds the `LookupItem`. The `field → sel` effect also depends on `items()`,
  so when an async provider resolves and repopulates `items`, the current key re-matches to its item and the
  ComboBox shows the right **label** (`getText = it.label`, 03-03). Selecting a row sets `sel` → writes its
  **key** to `field` → commit yields the key, not the label (AC-3, req AR-32).
- **Why this bridge is guarded differently from its siblings.** `boolBridge`/`dateBridge`/`enumBridge` seed
  their control signal *from* `field()`, so their reverse effect finds field == control on mount and never
  writes. `lookupBridge` **cannot** seed `sel` from the field — the `LookupItem` for a key is unknown until the
  async rows load — so it seeds `null`. A *bare* reverse write (`field.set(sel()?.key ?? '')`) would therefore
  fire `field.set('')` at mount, **destroying a seeded FK key** (the edit field is seeded with the existing
  cell value at begin-edit). The `if (s !== null && …)` guard is the fix: on mount `sel === null` ⇒ no write ⇒
  the seeded key survives; once `items` load the forward effect re-matches the key → `sel` → the reverse write
  is a no-op; a user selection writes the new key. Trade-off: selecting "nothing" no longer writes `''` (a
  clear-to-empty gesture) — out of scope for the select-only lookup, and addable deliberately later. ST-5's
  existing-key clause (07) is the regression oracle.

## Module & documentation notes

- `editor-bridges.ts` imports `signal`, `effect`, `untrack`, `toISO`, `parseISO` from `@jsvision/ui` and the
  `LookupItem` type from `./cell-editor.js`; it exports the four bridge functions for `cell-editor.ts` only.
- The bridges are internal, so they carry **code comments explaining the no-loop invariant** (above-junior
  reactivity) but are not part of the public `@example` surface. No spike/plan/RD references in comments.
- Target size: ~90 lines — one focused module, well under the 500-line ceiling.
