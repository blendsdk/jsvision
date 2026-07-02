# 01 — Requirements & Scope

> **Source**: [RD-07](../../requirements/RD-07-essential-control-completions.md) (preflighted, PASSED WITH NOTES)
> **Implements**: jsvision-ui/RD-07

## Objective

Complete RD-06's leaf-control tier with the four capabilities it deferred (`DEF-01`/`DEF-02`/`DEF-03`/
`DEF-19`), each a faithful Turbo Vision port: `Input` text **selection** + system **clipboard**, the
`picture(mask)` **validator**, the **`MultiCheckGroup`** cluster, and a **visible caret** (logical +
real hardware cursor via an additive `View`→host seam).

## In scope

- **Input selection** (PA-1 code-point unit, AR-116): Shift+Left/Right, **Ctrl+Shift+Left/Right** (word),
  Shift+Home/End, mouse press-drag, double-click select-all, **Ctrl+A** select-all; plain motion collapses;
  edit/Backspace/Delete over a non-empty selection deletes it first. Selected columns draw in the new
  `inputSelection` role (PA-4/PA-6).
- **Input clipboard** (AR-117, PA-7/PA-8/PA-9): copy/cut → core `setClipboard()` (OSC-52, caps-gated);
  paste ← bracketed `PasteEvent`, char-by-char validated; keys Ctrl+Ins/Shift+Ins/Shift+Del + additive
  `Commands.cut`/`copy`/`paste`.
- **Logical caret** (AR-121): the focused `Input` marks its edit cell at `displayedPos(curPos)−firstPos+1`.
- **Hardware caret seam** (AR-121, PA-5): `View.desiredCaret()` → `RenderRoot` absolute → `EventLoop.onCaret`
  → `run()` positions the real cursor via core `cursor.*`; hidden when unfocused/no requester; re-applied on
  `onResume`.
- **`picture(mask)`** (AR-119, PA-2/PA-3): the full `TPXPictureValidator` DSL + autoFill (default ON),
  bounds-safe (reject over-cap masks at `syntaxCheck`).
- **`MultiCheckGroup`** (AR-120, PA-10): a `Cluster`-derived control, `Signal<number[]>` + `states` marker
  string, faithful `" [ ] "`+marker visual.
- **Cross-package additive**: core `Theme` `inputSelection` role; `Commands.cut/copy/paste`.
- **Demo/stories** (AR-124): `MultiCheckGroup` kitchen-sink story (+ smoke); extend the `Input` story +
  `demo:controls` (selection→copy→paste, a `picture` field, the visible caret).

## Out of scope

- `History`/`ComboBox`/`Tree`/`Tabs`/`Table`/`ProgressBar`/`Surface` → **RD-12+** (AR-115).
- Overwrite/`Ins` mode → **DEF-20**; OSC-52 clipboard **read** → unassigned; multi-column cluster → DEF-17.
- Grapheme-cluster caret stepping → **DEF-21** (PA-1); cluster hardware caret → **DEF-22** (PA-11).

## Acceptance criteria (from RD-07 AC-1…AC-15)

The 15 RD ACs (AC-1…AC-15) map onto the 16 ST oracles in [07-testing-strategy.md](07-testing-strategy.md)
(ST-01…ST-16) — a cover, not a strict 1:1: several ACs expand to more than one oracle (e.g. AC-1/2/3 →
ST-01…ST-04). Immutable oracle: the TV C++ source (`tinputli.cpp`/`tvalidat.cpp`/`tmulchkb.cpp`/
`tcluster.cpp`) outranks a mis-decoded spec cell per the fidelity directive.

Key ACs: AC-1 keyboard selection · AC-2 mouse selection · AC-3 select-all + edit-over-selection · AC-4
copy/cut (OSC-52, caps-gated no-op) · AC-5 paste · AC-6/7/8 `picture` transient/blocking+autoFill/DSL ·
AC-9/10 `MultiCheckGroup` cycle+bind / faithful visual · AC-11 logical caret · AC-12 hardware caret seam ·
AC-13 packaging (≤500 lines, `check:deps`, explicit re-exports) · AC-14 stories+demo · AC-15 security
(paste bounded+filtered+sanitized; `setClipboard` base64+sanitize; `picture` bounded).

## Definition of done

`yarn verify` green (typecheck + build + unit) · `yarn test:e2e` (demo + kitchen-sink smoke) · `yarn
check:deps` (zero runtime deps) · `yarn lint` · every TV-derived component's AFTER-diff (GATE-2) recorded ·
`MultiCheckGroup` story passes the headless smoke test.
