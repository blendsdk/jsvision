# 03-04 — Accessibility & No-Keyboard Fallback

Owner of: the always-present DOM content, ARIA/keyboard operability, touch detection, and the fallback
slot. The terminal canvas is opaque to assistive tech, so the accessible content lives beside it.

## Always-in-DOM content (AR-12, AC-7)

For every example region, present in the DOM **without running the terminal**:
1. The **example source** — the whole-file `<<<` code block (03-01) — which is real text, selectable +
   screen-reader-readable, and carries the Shiki copy button for free (RD-01).
2. A **prose description** — the example's `blurb` (from the module, AR-14) rendered as a `<p>` near the
   Play control, plus any markdown the page author adds.
3. The **Play control** is a real `<button>` with an accessible label (e.g. `aria-label="Run the
   {title} example in a terminal"`), reachable + operable by keyboard (Enter/Space). The dialog is a
   labelled modal (`role="dialog"`, `aria-modal`, focus moved to the × / a heading on open, returned on
   close). Escape is intentionally not a dialog shortcut (AR-11) — documented in the hint so keyboard
   users know to use ×.

## Touch / no-keyboard detection (AR-13, AC-8)

```ts
// packages/docs-site/src/play/no-keyboard.ts
export function isNoKeyboardDevice(mm = globalThis.matchMedia): boolean {
  return !!mm && mm('(hover: none) and (pointer: coarse)').matches;
}
```

- The heuristic: a coarse pointer with no hover ⇒ a touch-primary device with no hardware keyboard.
  Injectable `matchMedia` for the headless test (AC-8 simulates it).

## Fallback slot (AR-13, AC-8)

- When `isNoKeyboardDevice()` is true, the Play region renders the **fallback** instead of (or above)
  the interactive Play button:
  - a **note**: *"Live interaction needs a hardware keyboard."*
  - an **`<img>`** at a conventional path derived from the id: `/screenshots/<id>.gif` (e.g.
    `/screenshots/controls/button.gif`), with `alt` = the title + " (recorded demo)".
- **Missing-asset degrade:** if the screenshot is absent (RD-09 has not produced it yet), the `<img>`
  is omitted and the region shows the note **+ the always-present source** — never a broken image. The
  slot + path convention are the RD-03 contract; RD-09 fills the assets (deferral).
- Deep-link (03-03) on a no-keyboard device shows the fallback, it does not open a terminal.

## Tests (see 07)
- ST-11 source + blurb present in the DOM without terminal JS; Play button has an accessible label +
  is keyboard-operable.
- ST-12 `isNoKeyboardDevice()` true ⇒ the fallback (note + slot) renders; missing asset ⇒ note + source,
  no broken image.
