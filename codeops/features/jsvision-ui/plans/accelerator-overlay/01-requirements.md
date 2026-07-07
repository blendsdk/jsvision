# Requirements — accelerator-overlay

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0
> **Source**: GH [#40](https://github.com/blendsdk/jsvision/issues/40) (reliability remainder) +
> [#41](https://github.com/blendsdk/jsvision/issues/41) (discoverability). No RD (AR-6).

## Problem

`~X~` accelerators (`[ ~O~pen ]`) feel inconsistent because Alt is the one modifier terminals mangle
most, and there is **zero discoverability** — nothing tells the user a hotkey is Alt (not Ctrl) or
whether it fired. The `ESC O`/`ESC [` decode collision was already fixed (task
`hotkey-introducer-collision`, #40); what remains is *reliability* and *discoverability*.

## Functional requirements

- **FR-1 (Reveal, #41).** A trigger reveals every reachable `~X~` accelerator in the current dispatch
  scope simultaneously — the hot glyph gains an **underline** on its existing accent (AR-2). Covers
  Button, Label, CheckGroup/RadioGroup/MultiCheckGroup (Cluster), MenuBar, TabView, StatusLine.
- **FR-2 (Arm-to-fire, #40).** While the mode is armed, pressing the **bare letter** (no Alt) fires
  the matching in-scope accelerator, behaving identically to `Alt+letter` (AR-4).
- **FR-3 (Single mode).** One trigger — **F12** by default (AR-10) — toggles the mode; it both reveals
  and arms (AR-1). Alt continues to work independently as the power-user path.
- **FR-4 (Scope).** Reveal + fire are scoped to the active dispatch scope: a modal `Dialog` ⇒ only its
  accelerators; otherwise the whole tree (menubar + focused window + status) (AR-5).
- **FR-5 (Lifetime).** Sticky: the mode stays on until an accelerator fires, Esc, F12 again, a click,
  or a non-accelerator key; dismiss leaves **no** residual emphasis (AR-3).
- **FR-6 (Enabled-only).** A disabled or invisible widget's accelerator does not light up or fire
  (AR-8).
- **FR-7 (Menu precedence).** While a MenuBar menu is open it owns plain letters; opening a menu
  dismisses accelerator mode (AR-7).
- **FR-8 (Configurable).** The trigger key is overridable/disable-able via an option seam
  (`revealKey`), default F12 (AR-10).

## Non-functional

- **NFR-1.** **Zero `@jsvision/core` changes** — underline is `Attr.underline`; the reveal flag and
  `DrawContext` are UI-owned (AR-15).
- **NFR-2.** Additive only — the router intercept and reveal flag are optional seams mirroring the
  existing `ev.emit`/`caps` additive-primitive patterns; widgets that don't read the flag are
  unaffected (AR-16/AR-17).
- **NFR-3.** Toggling the flag coalesces to exactly one repaint per tick (AR-14).
- **NFR-4 (Kitty seam).** The trigger is structured so real hold-Alt can later replace F12 without
  reworking the reveal/fire mechanism (AR-13).

## IN scope

- The F12 mode (toggle, sticky lifetime, dismiss rules).
- The router synth-alt intercept for arm-to-fire.
- The `revealAccelerators` DrawContext seam + underline emphasis in the 7 accelerator drawers.
- The `revealKey` option seam.
- A kitchen-sink dialog story + smoke (AR-11).

## OUT of scope

- Real hold-Alt (Kitty/CSI-u, DEF-1) — seam only (AR-13).
- Firing StatusLine **chord** items whose accelerator is not an Alt-letter (e.g. `Ctrl+Q`, `F1`) —
  reveal shows them, arm does not fire them (AR-9).
- Duplicate-accelerator authoring warnings — separate issue #6.
- Any `@jsvision/core` change (AR-15).

## Success criteria (definition of done)

- FR-1…FR-8 realized and covered by ST oracles (see 07).
- `yarn verify` + `yarn lint` clean (AR-12).
- Kitchen-sink story registered + smoke green (AR-11).
- #40 and #41 updated/closed as appropriate.
