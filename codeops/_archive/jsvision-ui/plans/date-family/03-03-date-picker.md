# DatePicker + the anchored-popup generalization

> **Document**: 03-03-date-picker.md
> **Parent**: [Index](00-index.md)

## Overview

`DatePicker` is a `Group` — a masked `Input` + a trailing `▼` button — that opens a `Calendar` in the
RD-14 anchored popup, mirroring `ComboBox`. It has **no TV counterpart** (TV predates date pickers);
it is designed fresh but composes shipped pieces. Landing it requires **generalizing** the internal
`openAnchoredPopup` from list-only to host any fixed-size `View` (PA-5 / AR-204) — the one cross-RD
change, additive and guarded by AC-13 (History/ComboBox stay green). The pure format model
(mask/parse/serialize) is split into `date-format.ts` (PA-6/PA-11).

---

## Part A — Generalize `openAnchoredPopup` (PA-5 / AR-204)

### Current → Proposed API (`dropdown/popup.ts`)

```ts
// BEFORE (list-only):
interface AnchoredPopupOptions<T> {
  host: PopupHost; anchor: Rect;
  buildList(): ListView<T>;
  maxRows?: number;
  onPick(index: number): void;
  onDismiss?(): void;
}

// AFTER (any fixed-size View):
interface AnchoredPopupOptions {
  host: PopupHost; anchor: Rect;
  /**
   * Build the hosted view inside the popup's reactive owner (computeds dispose on dismiss). The popup
   * **injects a `commit` trigger** (PA-5): the content wires its own activation callback to it —
   * `ListView.onSelect` (pick) / `Calendar.onChange` (day-commit) — so calling `commit()` closes the
   * popup. This injection is the ONLY channel from content-activation to dismissal (the old
   * `list.selected()` watch is removed); the content is built here (never in the caller's handler), so
   * the caller cannot hold it — hence the trigger must be pushed in, not pulled.
   */
  buildContent(commit: () => void): View;
  /**
   * The hosted content's intrinsic size. `height` = the content's VISIBLE ROW COUNT + 1 (the `+1`
   * absorbs the placement formula's net `+1` border, see "Placement reconciliation" — a list passes
   * `maxRows + 1`, the 8-row `Calendar` passes `9`). `width` = the content's column count (defaults to
   * the anchor width); the frame adds its own ±1 border.
   */
  contentSize: { width?: number; height: number };
  /** What receives focus on open (History/ComboBox: `list.rows`; Calendar: the calendar itself). */
  focusTarget(content: View): View;
  onDismiss?(): void;
}
```

**Placement reconciliation (byte-identical, AC-13):** `placePopup(anchor, contentHeight, viewport)`
computes the intermediate rect height as `contentHeight + 2`, then applies the **identical** TV-faithful
`intersect`-clamp + `−1` sequence currently in `popup.ts:181-190` (the `−1`-after-clamp is load-bearing
for the bottom edge — kept verbatim). The current code's intermediate is `maxRows + 3`; to reproduce it
**exactly**, list callers pass `contentSize.height = maxRows + 1` (so the intermediate is
`(maxRows+1) + 2 = maxRows + 3`, unchanged) — NOT `maxRows + 2`. Net: the unclamped frame height stays
`maxRows + 2` (interior `maxRows` rows). The 8-row `Calendar` passes `height: 9` → frame `10`, interior
`8`. Width: `contentSize.width ?? anchor.width` grown ±1 (the current `anchor.width + 2`, no `−1`), so a
wider `Calendar` (23 cols with week numbers) widens the popup while a list keeps the field width.

**Focus + dismiss + commit rewiring:**
- Focus: `host.focusView(focusTarget(content))` (was hard-coded `list.rows`).
- Focus-loss dismissal: watch `focusTarget(content).focusSignal()` (was `list.rows.focusSignal()`).
- Commit: the popup builds `commit = () => { if (!dismissed) dismiss(); }` and passes it into
  `buildContent(commit)`; the content invokes it from its activation callback (was the popup watching
  `list.selected()`, now removed). The value-side effect (pick / `value.set`) is done by the content's
  own callback **before** it calls `commit()`, so pick-then-close is preserved without the popup needing
  to read any content-specific member.

The catcher (`PopupCatcher`), frame (`PopupFrame` + Esc→dismiss + drop shadow), `absoluteRect`, the
single `createRoot` owner, and `syncOverlayVisible` are **reused unchanged**. `AnchoredPopupOptions`
loses its `<T>` generic; the primitive stays **internal** (not in the ui barrel), so this is
additive/non-public-breaking.

### `History` + `ComboBox` refactor (byte-identical, AC-13)

Both currently pass `buildList`/`onPick`/`maxRows`. Refactor each to:
- `buildContent: (commit) => <their ListView>` — the ListView is constructed unchanged **except** its
  `onSelect(index, item)` now runs the current `onPick` body (`this.pick(entries[index])` / etc.) **then**
  calls the injected `commit()` to close. `onSelect` fires only on activation (Enter/Space/click), so the
  pre-existing `firstSelection` guard is no longer needed (activation never fires on open).
- `contentSize: { height: maxRows + 1 }` — reproduces the current geometry **exactly** (intermediate
  `(maxRows+1)+2 = maxRows+3`, the current value; see "Placement reconciliation"). **Not** `maxRows + 2`.
- `focusTarget: (c) => (c as ListView<T>).rows`.

The `ListView.onSelect → commit()` wiring replaces `openAnchoredPopup`'s internal `list.selected()`
effect (which is removed with the generalization) — the pick logic moves from the popup into the
caller's `buildContent`, where it is owned by the popup's `createRoot` scope (no leak). The RD-14
`history.*` + `combo-box.*` spec/impl tests are the guard — **run them green before and after** the
refactor; per the immutable-oracle rule they are not modified.

---

## Part B — `DatePicker` (`date-picker.ts`) + `date-format.ts`

### `date-format.ts` — the pure format model (PA-11)

```ts
export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface DateFormatSpec {
  readonly mask: string;                                  // picture mask, e.g. "####-##-##"
  parse(text: string): CalendarDate | null;               // range-validated, null on incomplete/invalid
  serialize(date: CalendarDate): string;                   // → masked text
}

/** Resolve a format to its {mask, parse, serialize}. Default ISO. Localized month names → DEF-30. */
export function dateFormat(format?: DateFormat): DateFormatSpec;
```

Masks: ISO `"####-##-##"`, `DD/MM/YYYY` `"##/##/####"`, `MM/DD/YYYY` `"##/##/####"`; `parse` extracts
the digit fields per order and range-validates via `daysInMonth` (returns `null` on incomplete/invalid,
AC-11/AC-17); `serialize` zero-pads + orders. Pure, view-free, unit-tested.

### `DatePicker` (`date-picker.ts`)

```ts
export interface DatePickerOptions {
  value: Signal<CalendarDate | null>;
  format?: DateFormat;                 // default ISO (PA-11)
  today?: CalendarDate; min?: CalendarDate; max?: CalendarDate;
  isDisabled?: (d: CalendarDate) => boolean;
  firstDayOfWeek?: 0 | 1; showWeekNumbers?: boolean;  // forwarded to the hosted Calendar (PF-008)
}

export class DatePicker extends Group {
  readonly value: Signal<CalendarDate | null>;
  readonly input: Input;               // the focus target (size: fr), gated by picture(spec.mask)
  // a trailing 3-cell DateButton drawing `▼` (mirrors ComboButton, combo-box.ts:67-88)
}
```

**Composition:** `[ input (fr) | ▼ button (3) ]`. The field is an `Input` with `validator =
picture(spec.mask)` (RD-07); its `text` signal is derived from `value` via `spec.serialize`, and on a
complete valid edit parsed back via `spec.parse` (incomplete/invalid leaves `value` unchanged, AC-11).

**Open (mirrors `ComboBox`, combo-box.ts:175-214):** on the field's **Down/Alt+Down** or a click on
`▼`; `const host = ev.popupHost; if (host === undefined) return;` (**no host ⇒ decline**, headless).
Focus the field, then `openAnchoredPopup({ host, anchor: absoluteRect(this), buildContent: (commit) =>
new Calendar({ value, today, min, max, isDisabled, firstDayOfWeek, showWeekNumbers, onChange: () =>
commit() }), contentSize: { width: showWeekNumbers ? 23 : 20, height: 9 }, focusTarget: (c) => c })`. The
`Calendar` writes the shared `value` on a day-commit and its `onChange` then calls the injected
`commit()` to close the popup (value already set). `contentSize.height` is `9` = the Calendar's 8 visible
rows **+ 1** (the placement `+1` border compensation, per 03-03 Part A) → frame `10`, interior `8`. On
open, if `value` is set, the hosted `Calendar` initializes its cursor to it (positions on the current
date, AC-11).

**Commit / cancel:** a single day **click** (or **Enter** on the cursor) inside the popup calendar
sets `value` and — because that is the `commit()` the popup was given — **closes** it (AC-10); **Esc**
or an **outside mouse-down** dismisses without changing `value` (reused catcher/Esc). Since the popup
`Calendar` writes the **same** `value` signal, the field text updates via the serialize bind.

### Integration Points
- Third client of the anchored popup (after History + ComboBox); the generalization also unblocks
  RD-21's `ColorPicker`.
- Needs an overlay `PopupHost` (an app shell or a bare `Dialog`); headless ⇒ open is a no-op.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Open with no `PopupHost` (headless) | Decline to open (the `host === undefined` guard) | AC-10 / AR-205 |
| Incomplete / invalid field text | `value` unchanged (parse returns null) | AC-11 / PA-11 |
| Esc / outside mouse-down while open | Dismiss, `value` unchanged | AC-10 |
| History/ComboBox geometry drift after generalization | `contentSize.height = maxRows + 1` reproduces the exact rect (intermediate `(maxRows+1)+2 = maxRows+3` = current); their tests guard (AC-13) | PA-5 |

> **Traceability:** every choice references the register. See `00-ambiguity-register.md`.

## Testing Requirements
- Spec (ST-10…ST-13): field mask + open/commit/cancel (AC-10), two-way sync (AC-11), configurable
  format `DD/MM/YYYY` (AC-12), generalization intact + History/ComboBox green (AC-13).
- Impl: `dateFormat` parse/serialize tables per format (incl. null cases), the `DateButton` draw, the
  no-host guard, open→pick→close round-trip, Esc/outside cancel.
