# Seams & Theme: Input Dropdowns

> **Document**: 03-04-seams-and-theme.md
> **Parent**: [Index](00-index.md)

## Overview

The four additive, non-breaking surfaces RD-14 needs — landed in **Phase 0** before any control so
the controls build on stable seams: (1) a public `Input` linkage seam, (2) a derived
overlay-visibility seam, (3) a popup-host envelope seam (an additive `DispatchEvent` `getFocused()` +
overlay-host accessor, so a leaf control can reach the overlay — PF-002, detailed in
[03-02](03-02-anchored-popup.md)), and (4) five additive core History theme roles. All additive; the
only edit to existing behavior is the menu controller migrating onto the derived-visibility model
(behavior-preserving, regression-checked).

## 1. Public Input linkage seam (PA-8 / AR-162)

### Current Architecture
`controls/input.ts`: `value: Signal<string>` (`:67`), `maxLength: number` (`:69`), and
`selectAll(enable): void` (`:433`) are all **`protected`** — a `History` that *links* an
app-created `Input` cannot reach them (TV reaches the public `data`/`maxLen`/`selectAll`,
`thistory.cpp:106-107`).

### Proposed Changes (smallest non-breaking)
Keep the fields `protected`; add a minimal **public** read+action surface:

```ts
class Input extends View {
  // ... existing protected value/maxLength ...

  /** Public accessor for the two-way bound text signal (History replaces text through it). PA-8. */
  public getValueSignal(): Signal<string> { return this.value; }

  /** Public read of the field's max length (History clamps a picked value to it). PA-8. */
  public getMaxLength(): number { return this.maxLength; }

  /** Select the whole field (History calls this after a pick — faithful to selectAll(True)). PA-8. */
  public selectAll(enable: boolean = true): void { /* was protected at :433 */ }
}
```

Existing callers unaffected (promotion widens access only). `ComboBox` does **not** use this seam
(it composes its own `Input`); only `History` (which *links*) needs it.

## 2. Derived overlay-visibility seam (PA-5 / AR-163)

### Current Architecture
One overlay `Group` per app (`app/application.ts:140-142`), `overlay.state.visible` set `true` at
`menu/controller.ts:229` and `false` at `:247`. Two independent clients (MenuBar + a dropdown)
driving that one flag stomp each other.

### Proposed Changes
Make `overlay.state.visible` **derived from whether it hosts any child** — computed **imperatively**,
because the substrate is **not reactive**: `overlay.children` is a plain `View[]` (`group.ts:33`), not
a callable accessor, and `state.visible` is a plain boolean mutated in place (`view.ts:47`, "the
reference is fixed; fields mutate"). An `effect` reading them would subscribe to nothing and run only
once — the existing model drives repaint imperatively (`overlay.add` → `invalidateLayout`,
`group.ts:67`), so the derive must too (PF-001).

- In `application.ts`, add a small helper `syncOverlayVisible(overlay)`:
  `overlay.state.visible = overlay.children.length > 0; overlay.invalidate();`. `children.length > 0`
  is the coexistence rule — no refcount to desync: the overlay stays visible while *any* client (an
  open menu **or** a dropdown popup) has a child mounted, and hides only when the last unmounts.
- In `menu/controller.ts`, **replace** the two explicit `overlay.state.visible = …` assignments
  (`:229/:247`) with `syncOverlayVisible(overlay)` calls at the same sites (after `mountCatcher()` on
  open; after clearing the catcher on close). Same edit sites → the same regression surface.
- The dropdown popup ([03-02](03-02-anchored-popup.md)) calls `syncOverlayVisible(overlay)` after it
  `overlay.add`/`remove`s its list + catcher. Menu + dropdown coexist without stomping — each add/remove
  re-derives from the live child count.

> **Regression guard:** the existing menu spec/impl tests (`app-shell.menu.*`) must stay green after
> the migration — the observable open/close behavior is unchanged. A Phase-0 task asserts this.

## 3. Additive core History theme roles (PA-12 / AR-139)

### Current Architecture
`core/src/engine/color/theme.ts`: `ThemeRole = { fg, bg, hotkey? }` (`:16-22`); richer roles extend
it (`window: ThemeRole & { border, title, icon }`, `:174`). No `history*` roles or reserved slots
(AR-165).

### Proposed Changes
Add **five** additive roles to `Theme` + `defaultTheme`, with the GATE-1-decoded bytes
([03-01](03-01-history.md) §1, §4 — gray-dialog owner):

| Role | Shape | Decoded byte | Meaning |
| ---- | ----- | ------------ | ------- |
| `historyButtonSides` | `ThemeRole` | `0x72` | ▐ ▌ half-blocks — green-on-lightGray |
| `historyButtonArrow` | `ThemeRole` | `0x20` | ↓ arrow — black-on-green |
| `historyWindow` | `ThemeRole & { border: Color; icon: Color }` | interior/border `0x1F`, icon `0x1A` | popup frame — white-on-blue border, lightGreen-on-blue close/icon |
| `historyViewer` | `ThemeRole` | `0x1F` | normal list rows — white-on-blue |
| `historyViewerFocused` | `ThemeRole` | `0x2F` | focused list row — white-on-green |

`ComboBox` reuses the existing `input*`/`list*` roles + the two button roles (PA-11). No existing
role changes (same additive pattern as AR-97/112/122).

## Integration Points

- `History` ([03-01](03-01-history.md)) draws the icon via `historyButton*`; the popup
  ([03-02](03-02-anchored-popup.md)) frames via `historyWindow` and lists via
  `historyViewer`/`historyViewerFocused`; it reads/writes the linked field via the Input seam and
  mounts through the derived-visibility overlay.
- Core roles land in `@jsvision/core` (cross-package, additive); the ui seams are intra-package.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `encode()` of a new role throws | ST asserts each role encodes without throwing (AC-10) | AR-139 |
| Menu regression from the migration | Phase-0 regression task keeps `app-shell.menu.*` green | PA-5 |
| Non-gray-dialog owner (blue/cyan) | Roles carry the gray-dialog bytes (project default); a themed override is an app concern | decode §note 2 |

## Testing Requirements

- Input seam: `getValueSignal()`/`getMaxLength()`/`selectAll()` are public and behave; existing
  Input tests stay green.
- Overlay: visibility derived from children; menu + a mounted popup both visible; menu tests green.
- Theme: five roles present with the decoded bytes; each `encode()`s without throwing; they are the
  only new core role symbols. (ST-cases in [07-testing-strategy.md](07-testing-strategy.md).)
