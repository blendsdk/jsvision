# 03-05 — Dialog + standard buttons (Phase 4)

> **TV source**: `TDialog` `source/tvision/tdialog.cpp` + `include/tvision/dialogs.h`; `TGroup::valid`
> `tgroup.cpp:566`; command constants `views.h:44`.
> **Files**: `packages/ui/src/dialog/{dialog,buttons}.ts` · **CodeOps**: 3.1.0
> **PA-1, PA-6, PA-7, PA-13, AR-107, AR-108, AR-109** · realizes **DEF-16** · depends on Phase 0 seam + RD-06 controls

## TV decode (GATE 1) — decode BEFORE writing

**`TDialog`** (`tdialog.cpp:25`) — **is-a `TWindow`**: draws the standard `TFrame` chrome (double-line
border + close icon — TV's `[~\xFE~]`, rendered `[×]` by jsvision's `frame.ts` `CLOSE_GLYPH`, PF-005),
`wnNoNumber` (no number), `flags = wfMove | wfClose` (**movable + closable,
NOT resizable/zoomable**), `growMode = 0`, `palette = dpGrayDialog` (the gray palette). Min size `{16,6}`
(inherited `TWindow`, `twindow.cpp:30`).

**`valid(command)`** (`tdialog.cpp:95`):
```cpp
Boolean TDialog::valid(ushort command) {
  if (command == cmCancel) return True;      // Cancel ALWAYS closes (no child sweep)
  else return TGroup::valid(command);
}
```
**`TGroup::valid`** (`tgroup.cpp:566`) — for any command other than `cmReleasedFocus`, sweeps **all**
children via `firstThat(isInvalid, &command)` and returns True only if none report invalid (`==0`).
`isInvalid(p) = !p->valid(command)`.

So (PA-7): **`cmCancel` bypasses** (always closes); **`cmOK`/`cmYes`/`cmNo` run the full child sweep** —
if any hosted control's `valid()` is false, the dialog does **not** close and (our addition) focus moves
to the first invalid child.

**Close triggers** (`tdialog.cpp:57-89`) — `Esc → cmCancel`, Enter → the default button's command, the
frame `[×]`/`cmClose → cmCancel`; on `cmOK/cmCancel/cmYes/cmNo` while `sfModal` it calls `endModal(cmd)`.
**Commands** (`views.h:44`): `cmOK=10, cmCancel=11, cmYes=12, cmNo=13, cmDefault=14`.

## Spec (what we build) — PA-1/6/7/13

`Dialog extends Window` (reuse the RD-05 frame chrome) and defaults `resizable=false`,
`zoomable=false`, `number=undefined`, `movable=true`, `closable=true` (PA-6). Implements
`ModalHostAware` (PA-1). It is `postProcess` so it sees the buttons' command events, **and** it
overrides `onEvent` for the frame-close/Esc path (see below).

> **Frame chrome is not drop-in — `frame.ts` is generalized (PF-001, corrects the "additive-only"
> inventory).** `drawFrame`'s `role` param is typed `FrameRole = 'window' | 'windowInactive'`
> (`window/frame.ts:53`) and it reads `theme.icon` (`:118`), which the `dialog` theme role does not
> carry (`core/.../theme.ts:43` — `ThemeRole & { border; title }`, no `icon`); it also always draws
> the zoom `[↑]` box gated only on `active` (`:145-152`), with no `zoomable`/`closable` fields on
> `FrameState`. So a faithful non-zoomable Dialog needs `frame.ts` made **dialog-aware**: (1) widen
> `FrameRole` to include `'dialog'`; (2) add `closable`/`zoomable` to `FrameState` and **gate** the
> close/zoom icon draws on them (TV `TFrame` gates each icon on `wfClose`/`wfZoom`); (3) add an `icon`
> field to the core `dialog` role. `Dialog.draw` then calls the shared `drawFrame(...)` with the
> `dialog` role — DRY, one fidelity-verified drawer. These are **edits to existing files**
> (`window/frame.ts` + `core/.../theme.ts`) beyond the six theme roles / `Commands` / `execView`
> injection — the additive-edit inventory (`02-current-state.md`, `99` Notes) is updated to list them.

```ts
export interface DialogOptions { title?: string; }
export class Dialog extends Window implements ModalHostAware {
  attachModalHost(host: ModalHost): void;   // injected by execView (PA-1)
  // catches ok/cancel/yes/no → valid()-gate → host.endModal(command)
  valid(command: string): boolean;          // TDialog::valid + TGroup::valid sweep
}
```

- **Result (AR-108)** — shown modal via `execView(dialog)` ⇒ resolves to the terminating command string
  (`Commands.ok`/`cancel`/`yes`/`no`); form data lives in the hosted controls' bound signals (AR-100),
  no separate result object. Shown modeless via `desktop.add(dialog)` ⇒ an ordinary window (AC-10).
- **Terminating-command catch (postProcess)** — on a `command` event whose command ∈ {ok,yes,no,cancel}
  (only when `host.isCommandEnabled(command)`, PF-007): call `valid(command)`; if it passes,
  `host.endModal(command)` (set `ev.handled`); if it fails, keep the dialog open and
  `ev.focusView(firstInvalidChild)`.
- **Frame-close / Esc override (`onEvent`, PF-002)** — the inherited `Window.onEvent`
  (`window/window.ts:135`) maps the frame close `[×]` zone to `this.close()` (`:145` → `:109` →
  `manager.removeWindow`), a **mouse** path that emits **no command** — so the postProcess catch above
  would never see it, `valid()` would be skipped, and `host.endModal` would never fire ⇒ the `execView`
  promise **hangs** (stuck modality) and the close-gate is bypassed. `Window` also has **no** Esc
  handling. So `Dialog` **overrides `onEvent`**: it intercepts (a) the frame **close-zone** mouse-down
  and (b) the raw **Esc** key, and routes **both** to the same negative-close path — treat as `cancel`
  ⇒ `valid()` bypass (PA-7) ⇒ `host.endModal(Commands.cancel)`; it must **not** delegate the close zone
  to `super.onEvent`/`this.close()` (that would remove the view without ending modality). All other
  zones (title-drag, resize) fall through to `super.onEvent`. This keeps the fix additive (a subclass
  override), and realizes ST-10's "Cancel/Esc ⇒ cancel regardless" (TV `TDialog`: close/Esc ⇒ cmCancel,
  `tdialog.cpp:57-89`).
- **`valid(command)` (PA-7, realizes DEF-16)** — `command === Commands.cancel ⇒ true` (bypass). Else
  sweep descendant controls that expose `valid()` (the RD-06 `Input`); return false on the first invalid,
  remembering it for refocus. (Controls without `valid()` are treated valid — matches `firstThat`.)
- **Standard buttons (`buttons.ts`, PA-13/AR-109)** — `Button` presets emitting the matching command:
  `okButton()` (`default:true`, `Commands.ok`), `cancelButton()` (`Commands.cancel`), `yesButton()`
  (`default:true`, `Commands.yes`), `noButton()` (`Commands.no`); + `okCancelButtons()` /
  `yesNoButtons()` returning the pair. Faces: `~O~K` / `~C~ancel` / `~Y~es` / `~N~o` (tilde hotkeys),
  drawn by the RD-06 `Button` (its decoded TV face + shadow — already fidelity-verified).

## Spec oracles

- **ST-09** (modal result) — `await execView(dialog)` blocks until a terminating command closes it and
  resolves to that command; the hosted `Input`'s bound signal holds the typed data. *(AC-8)*
- **ST-10** (valid gate = DEF-16) — a dialog hosting an `Input` with `range(0,100)` set to `150`: pressing
  **OK** does **not** resolve/close and focus moves to that `Input`; correcting to `50` then OK resolves
  `Commands.ok`; **Cancel/Esc** resolves `Commands.cancel` regardless of validity. *(AC-9)*
- **ST-11** (modeless) — a `Dialog` added via `desktop.add` is a normal, non-blocking window
  (raise/move/focus). *(AC-10)*
- **ST-12** (standard buttons) — `okButton()`/`cancelButton()`/`yesButton()`/`noButton()` render the TV
  button faces and emit `Commands.ok`/`cancel`/`yes`/`no`; the `Commands` constants exist. *(AC-11)*
- Impl test: `execView` does not attach a modal host to a plain (non-`ModalHostAware`) view (PA-1 guard).
- Impl test (PF-002): clicking a modal `Dialog`'s frame close `[×]` **and** pressing **Esc** each
  resolve `execView` to `Commands.cancel` (not a hang) and bypass `valid()`; a disabled OK command is
  ignored by the terminating catch (PF-007).

## GATE 2 (AFTER) — re-open `tdialog.cpp` + `tgroup.cpp`: confirm the frame is the TWindow chrome in the
`dialog` role with the close `[×]` box present and **no** zoom box (the `frame.ts` icon gating, PF-001),
`wfMove|wfClose` (no resize/zoom), close-box + Esc ⇒ `cancel` (PF-002), the `cmCancel`-only bypass, the
full child sweep for ok/yes/no, and the command constants. Record in the commit.
