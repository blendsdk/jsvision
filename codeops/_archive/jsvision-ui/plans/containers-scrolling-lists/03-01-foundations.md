# 03-01 — Foundations (Phase 0)

> **CodeOps Skills Version**: 3.1.0 · The additive primitives every later phase depends on. Not
> TV-derived drawing (no GATE-1/2), except the theme role **colours**, which are decoded (PA-10).

## F1. Theme roles (core) — PA-10, PA-4, AR-112

Add to `packages/core/src/engine/color/theme.ts`: extend the `Theme` interface + `defaultTheme` with six
additive `ThemeRole` (`{fg,bg}`) keys. `ThemeRoleName = keyof Theme` picks them up; `ctx.color(role)` and
`Group.background` accept them with no other change.

| Role | Decoded `0xHL` | bg / fg | `PALETTE` values |
|------|----------------|---------|------------------|
| `scrollBarPage` | `0x13` | blue / cyan | `{ fg: PALETTE.cyan, bg: PALETTE.blue }` |
| `scrollBarControls` | `0x13` | blue / cyan | `{ fg: PALETTE.cyan, bg: PALETTE.blue }` |
| `listNormal` | `0x30` | cyan / black | `{ fg: PALETTE.black, bg: PALETTE.cyan }` |
| `listFocused` | `0x2F` | green / white | `{ fg: PALETTE.white, bg: PALETTE.green }` |
| `listSelected` | `0x3E` | cyan / yellow | `{ fg: PALETTE.yellow, bg: PALETTE.cyan }` |
| `listDivider` | `0x31` | cyan / blue | `{ fg: PALETTE.blue, bg: PALETTE.cyan }` |

Decode chain (record in the JSDoc, per the fidelity directive): `cpScrollBar[1..3]=0x04,0x05,0x05`
(`tscrlbar.cpp:37`) → `cpGrayDialog[4],[5]=0x23,0x24` (`dialogs.h:80`) → `cpAppColor[35],[36]=0x13`
(`app.h:145`) → cyan-on-blue. `cpListViewer="\x1A\x1A\x1B\x1C\x1D"` (`tlstview.cpp:30`) → gray slots
26–29 → `cpAppColor[57..60]=0x30,0x2F,0x3E,0x31` (`app.h:146`, hand-verified). *page = controls = thumb
share `0x13` in a gray dialog — the visual distinction is the glyph (`■` thumb vs `▒` track), faithful.*

- Mirror the same six keys in the core theme spec test's `ROLE_SLOTS` map (the RD-06/RD-10 convention).
- **AC-12/ST-13:** `encode()` / `encodeStyle()` of each role must not throw at any colour depth.

## F2. `Commands` additions (ui) — PA-12, AR-109

Append to `packages/ui/src/status/commands.ts` `Commands` (value = key, the existing convention):
`ok:'ok'`, `cancel:'cancel'`, `yes:'yes'`, `no:'no'`. Additive; no existing key changes. Re-exported
already via the `status` barrel.

## F3. The `attachModalHost` loop seam (ui) — PA-1

A modal view (the `Dialog`) must close itself. Add one additive intra-package seam (precedent: the
AR-82/AR-84 `setCapture`/`onFrame` seams — the loop is *composed*, not reshaped):

```ts
// event/types.ts — the host handed to a modal view that opts in
export interface ModalHost {
  endModal(result: unknown): void;       // resolve the active execView promise
  isCommandEnabled(command: string): boolean;
}
// a view opts in by implementing:
export interface ModalHostAware { attachModalHost(host: ModalHost): void; }
```

- In `event/event-loop.ts` `execView<R>(view)` (around `:127`): before/at `modal.begin`, if
  `view` implements `attachModalHost`, call `view.attachModalHost({ endModal: (r) => this.endModal(r),
  isCommandEnabled: (c) => this.registry.isEnabled(c) })`. On modal end, no teardown needed (the view is
  removed from the tree by the caller / desktop).
- Non-modal views (everything today) are unaffected — the check is a duck-typed `typeof
  (view as ...).attachModalHost === 'function'`. **No behaviour change** to existing `execView` callers.
- **Grounding:** `execView` already returns `Promise<R>` resolved by `endModal` (`event-loop.ts:127-140`);
  this seam only gives the modal view the handle to call it. Verified against live source.

## F4. New subsystem skeletons — PA-9, AR-113

Create three subsystem dirs, each with a barrel `index.ts`, wired via **explicit named re-exports** in
`packages/ui/src/index.ts` (the AR-102 pattern):

```
packages/ui/src/scroll/   scroll-bar.ts · scroller.ts · index.ts
packages/ui/src/list/     virtual.ts · list-rows.ts · list-view.ts · list-box.ts · index.ts
packages/ui/src/dialog/   dialog.ts · buttons.ts · index.ts
```

Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps`). Every file ≤ 500 lines.

## Phase-0 spec oracles

- **ST-13** (theme roles) — `defaultTheme` exposes the six roles with the decoded colours; `encode()`
  non-throwing. *(AC-12)*
- **ST-15** (packaging, partial) — the new barrels re-export from `@jsvision/ui`; `Commands.ok/cancel/
  yes/no` importable; `check:deps` clean. *(AC-14)*
- The `attachModalHost` seam is covered behaviourally by the Dialog specs (ST-09/ST-10), plus an impl
  test asserting a non-modal-host view is untouched by `execView`.
