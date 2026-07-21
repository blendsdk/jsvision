# 03-01 — Reveal overlay (the `revealAccelerators` seam + underline emphasis)

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0
> Realizes **FR-1**, **FR-6** (enabled-only reveal). Decisions AR-2, AR-8, AR-14, AR-15, AR-17.

## Responsibility

Thread a scope-wide `revealAccelerators` boolean from the RenderRoot to every `View.draw(ctx)` (the
same shape as `DrawContext.caps`), and have each `~X~` drawer add an **underline** to its hot-glyph
accent while the flag is set. No color change, no width change, no new theme role.

## The seam (mirror `caps`, AR-17)

Add `revealAccelerators: boolean` at exactly the `caps` hops (see 02 §3):

| File | Change |
|------|--------|
| `view/types.ts` | `DrawContext.readonly revealAccelerators: boolean` (documented additive; drawers that ignore it are unaffected — mirrors the `caps` JSDoc at `:57-64`). |
| `view/draw-context.ts` | `makeDrawContext(buffer, viewRect, clip, theme, caps, revealAccelerators)` — accept + place on the returned object (`:64-70,190`). |
| `view/render-root.ts` | Hold `private revealAccelerators = false` + `private revealScope: View \| null = null` (**mutable**, unlike `caps`); a `setRevealAccelerators(on: boolean, scope?: View \| null)` setter stores both and, on a change, calls `markRelayout()` (AR-14 — one coalesced `fullCompose` next flush). Pass the flag into `composeView` (`:303,316-328`) and thread through `composeView`→`makeDrawContext`→child recursion (`:135,156`). Expose `setRevealAccelerators` on the `RenderRoot` interface. |

### Reveal scoping (FR-4 / AR-5) — honor the modal scope in the compose walk

The flag is global on the root, but reveal must light up **only the active dispatch scope** (a modal
`Dialog` ⇒ only its subtree). Because `composeView` already recurses root→down, thread an
`insideScope: boolean` alongside the flag: it starts `revealScope === null` (no modal ⇒ whole tree)
and flips **true** when the walk reaches `view === revealScope`. The **effective** value handed to
`makeDrawContext` is `revealAccelerators && (revealScope === null || insideScope)`. So a background
window (outside the modal subtree) composes with reveal **off** and never underlines, while fire is
independently clamped by `scopeRoot()` in `dispatch.ts` — the two stay consistent. The loop supplies
`revealScope = this.scopeRoot()` when it arms (03-02).

> **Default `false`** everywhere — a bare unit-constructed `DrawContext` (tests) omits it via a
> helper default, exactly as `caps` is defaulted in existing test helpers.

## Emphasis helper (AR-2)

A single shared pure helper so all 7 drawers apply identical emphasis (DRY):

```ts
// menu/builders.ts (next to tildeSegments) or a small accent util
export function accentStyle(base: Style, reveal: boolean): Style {
  return reveal ? { ...base, attrs: (base.attrs ?? Attr.none) | Attr.underline } : base;
}
```

`Attr.underline` = `render/types.ts:47` (SGR 4, `encode.ts:30`). Each drawer already computes its hot
run's `Style` (the `*Shortcut` role or the role's `.hotkey` accent); wrap only that hot style through
`accentStyle(hotStyle, ctx.revealAccelerators)`. The base (non-hot) text is untouched (AR-3: no
dimming).

## Per-widget wiring (only the hot run changes)

| Widget | Hot style today | Change |
|--------|-----------------|--------|
| Button | `ctx.color('buttonShortcut')` (`button.ts:105`) | wrap in `accentStyle(…, ctx.revealAccelerators)` at the `tildeSegments` hot run (`:156-158`) |
| Label | `ctx.color('labelShortcut')` (`label.ts:57`) | wrap the hot run (`:60-62`) |
| Cluster | `clusterShortcut` accent (`cluster.ts:104-105`) | wrap the hot run |
| MenuBar | `menuBar.hotkey`/`menuSelected.hotkey` (`menubar.ts:49-50`) | wrap the single-char redraw (`:63-66`) |
| TabView (strip) | `raw.hotkey` (`tab-strip.ts:332`) | wrap `hotStyle` (`:332,341-342`); skip disabled tabs (already no accent, `:336-339`) |
| StatusLine | `statusBar.hotkey`/`statusSelected.hotkey` (`statusline.ts:130-131`) | wrap the hot run (`:144-145`) |

**Enabled-only (FR-6/AR-8):** a drawer emphasizes only when its widget is enabled + visible. Button
already collapses the accent to the face when disabled (`button.ts:105`, HR-52); TabView already
draws a disabled tab with no accent; Cluster/Label/MenuBar/StatusLine emphasize per item — a disabled
item keeps its resting (non-emphasized) accent. No new gating logic beyond honoring the existing
disabled paths.

## Notes

- **Menu popup rows** (`popup.ts:118-122`) are reached only while a menu is open, and an open menu is
  its own plain-letter mode (AR-7) — popups are **not** part of the F12 overlay (accelerator mode
  dismisses when a menu opens). No popup change.
- **No core change (AR-15).** Everything here is `packages/ui/**` + the existing core `Attr`.
- **Reveal ≠ layout.** Underline is width-neutral, so `markRelayout` repaints without geometry drift.
