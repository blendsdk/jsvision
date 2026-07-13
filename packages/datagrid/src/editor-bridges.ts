/**
 * Typed bridges — the adapters that let a typed `@jsvision/ui` control drive the editor's single
 * `Signal<string>` edit field, and vice-versa, without a feedback loop.
 *
 * The edit field is one authoritative string (what the commit path parses). But a checkbox wants a
 * `Signal<boolean[]>`, a date picker a `Signal<CalendarDate | null>`, and so on. Each bridge is a pair
 * of effects: one maps the field to the control, the other maps the control back to the field. Both
 * writes are wrapped in `untrack` (so the writing effect does not re-subscribe to the signal it writes)
 * and guarded to fire only on a real change (so a no-op write never schedules the other effect). That
 * pair converges in a single pass — the controls never see the string, and the field never sees the
 * typed value.
 *
 * These bridges create their effects **eagerly**, the moment they are called (inline in the editor
 * factory) — so the factory must run inside the overlay's reactive root, or the effects leak. The
 * editing lifecycle guarantees that by building the editor inside the mount's `createRoot`.
 */
import { effect, parseISO, signal, toISO, untrack } from '@jsvision/ui';
import type { CalendarDate, Signal } from '@jsvision/ui';
import type { LookupItem } from './cell-editor.js';

/**
 * Adapt the edit field to a `CheckGroup`'s single-item `Signal<boolean[]>`. The field's canonical
 * strings are `'true'`/`'false'`; any other value reads as `false`. Toggling the checkbox writes the
 * flipped string back, so the commit path parses the boolean from an up-to-date field.
 *
 * Mount coercion: an empty or non-`'true'` field reads as `false` and is canonicalized to `'false'` on
 * mount (a `boolean[]` has no tri-state, so a NULL/empty boolean cannot be represented — opening the
 * editor commits it as `false`).
 *
 * @param field The editor's string edit field.
 * @returns A single-element boolean signal for the `CheckGroup`.
 */
export function boolBridge(field: Signal<string>): Signal<boolean[]> {
  const b = signal<boolean[]>([field() === 'true']);
  // field → control: reflect the string as the checkbox state.
  effect(() => {
    const v = field() === 'true';
    untrack(() => {
      if (b()[0] !== v) b.set([v]);
    });
  });
  // control → field: write the flipped canonical string only when it actually changes.
  effect(() => {
    const v = b()[0] ? 'true' : 'false';
    untrack(() => {
      if (field() !== v) field.set(v);
    });
  });
  return b;
}

/**
 * Adapt the edit field (an ISO `YYYY-MM-DD` string) to a `DatePicker`'s `Signal<CalendarDate | null>`.
 * The field stays authoritative: picking a day writes ISO back; an empty or unparseable field is `null`
 * (no selection).
 *
 * Mount coercion: a non-canonical field is normalized to canonical ISO, and an unparseable field is
 * rewritten to `''` (opening the editor on a malformed date string clears it).
 *
 * @param field The editor's string edit field.
 * @returns A nullable `CalendarDate` signal for the `DatePicker`.
 */
export function dateBridge(field: Signal<string>): Signal<CalendarDate | null> {
  const d = signal<CalendarDate | null>(parseISO(field()));
  // field → control: parseISO returns a fresh object each run; the DatePicker compares by day value, so
  // an unconditional set is idempotent for a same-day reset. The reverse effect's guard prevents a loop.
  effect(() => {
    const parsed = parseISO(field());
    untrack(() => d.set(parsed));
  });
  // control → field: write the ISO string only when it actually changes.
  effect(() => {
    const iso = d() ? toISO(d()!) : '';
    untrack(() => {
      if (field() !== iso) field.set(iso);
    });
  });
  return d;
}

/**
 * Adapt the edit field to a select-only `ComboBox<string>`'s `Signal<string | null>`. An empty field is
 * no selection (`null`); selecting a value writes that string back to the field.
 *
 * @param field The editor's string edit field.
 * @returns A nullable string signal for the enum `ComboBox`.
 */
export function enumBridge(field: Signal<string>): Signal<string | null> {
  const s = signal<string | null>(field() === '' ? null : field());
  // field → control: an empty field is no selection.
  effect(() => {
    const v = field() === '' ? null : field();
    untrack(() => s.set(v));
  });
  // control → field: write the selected string (or '' for no selection) only when it changes.
  effect(() => {
    const v = s() ?? '';
    untrack(() => {
      if (field() !== v) field.set(v);
    });
  });
  return s;
}

/**
 * Adapt the edit field (which holds a lookup **key**) to a `ComboBox<LookupItem>`'s
 * `Signal<LookupItem | null>`. The field is authoritative: it stores the key, the ComboBox shows the
 * matching row's label, and selecting a row writes that row's key back.
 *
 * The forward effect also depends on `items`, so when an async provider resolves and repopulates the
 * rows, the current key re-matches to its item and the label appears. Unlike the other bridges, `sel`
 * cannot be seeded from the field (the item for a key is unknown until the rows load), so it seeds
 * `null`; the reverse effect therefore writes **only when a row is actually selected** — a bare reverse
 * write would fire `field.set('')` at mount and destroy a seeded key before the async rows arrive.
 *
 * @param field The editor's string edit field (holds the key).
 * @param items The live rows signal (seeded synchronously, or populated by an async provider).
 * @returns A nullable `LookupItem` signal for the lookup `ComboBox`.
 */
export function lookupBridge(field: Signal<string>, items: Signal<LookupItem[]>): Signal<LookupItem | null> {
  const sel = signal<LookupItem | null>(null);
  // field → sel: re-match the key against the (possibly async-loaded) rows.
  effect(() => {
    const key = field();
    const m = items().find((it) => it.key === key) ?? null;
    untrack(() => sel.set(m));
  });
  // sel → field: write ONLY when a row is actually selected. On mount `sel` is null, so a seeded key is
  // left intact; once the rows load the forward effect re-matches it (the write is then a no-op); a user
  // selection writes the new key.
  effect(() => {
    const s = sel();
    untrack(() => {
      if (s !== null && field() !== s.key) field.set(s.key);
    });
  });
  return sel;
}
