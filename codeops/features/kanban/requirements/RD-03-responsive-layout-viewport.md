# RD-03: Responsive Layout and Viewport

> **Document**: RD-03-responsive-layout-viewport.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-01, RD-02
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The board must remain readable and operable when embedded on a surface, hosted in a window, resized,
maximized, restored, translated, or reduced to a narrow terminal. Ordinary composition uses JSVision's
public layout DSL. One measured exact-cell viewport owns virtualized card geometry, independent
scrolling, sticky bands, hit testing, and drag layers within the rectangle assigned by the DSL.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Compose the board, cards, and state surfaces with public DSL flow/stack/measurement primitives
  to the maximum technically meaningful extent. Any standard dialogs, labs, and examples introduced
  by later owning RDs must obey the same DSL-first boundary.
- [ ] Host the board directly on a surface or inside a window with identical component behavior;
  shadow and outer frame remain host/theme decisions.
- [ ] Support independent horizontal and vertical scrolling, wheel input, scrollbars/indicators where
  configured, and bounded imperative reveal. Later focus and drag owners invoke the same reveal seam.
- [ ] Keep workflow headers sticky vertically and define distinct swimlane/header/gutter geometry that
  later swimlane and drag owners can activate without obscuring insertion gutters.
- [ ] Provide responsive wide, horizontally scrolling compact, and single-focused-column narrow modes.
- [ ] Preserve focused card identity and nearest visual anchor across resize/maximize/restore.
- [ ] Render safe minimum-geometry feedback instead of clipped or overlapping interactive targets.

### Should Have — Complexity L

- [ ] Permit bounded per-column min/preferred/max width overrides and custom renderer measurement hints.
- [ ] Preserve horizontal column position and vertical card anchor when transitioning out of and back
  into focused-column mode.
- [ ] Expose viewport metrics and reveal APIs for app status, testing, and modeless inspector integration.

### Won't Have (Out of Scope)

- Pixel/CSS/media-query breakpoints — geometry is terminal-cell and content-constraint based.
- Raw absolute rectangles for normal headers, cards, forms, actions, or dialog interiors.
- Allowing arbitrary card content to expand a column without declared bounds.

---

## Technical Requirements

### DSL composition mandate — Complexity L

The implementation shall use `col`, `row`, `stack`, `grow`, `fixed`, `spacer`, placement helpers,
measured controls/button groups, conditional children, and `setLayout`/layout invalidation for:

- outer board bands and optional narrow navigator;
- the Phase A conditional focused-column navigator and, when introduced, later status, help, filter,
  and action bands;
- standard card internal sections;
- loading/empty/error/no-results/minimum-size surfaces;
- editor/configuration/confirmation dialog interiors when their owning RDs introduce them; and
- every docs example, kitchen-sink story, and showcase screen when RD-15 introduces them.

Responsive state changes update visibility/layout descriptors and invalidate the nearest shared layout
container once. Code shall not mutate readonly layout internals.

### Exact-cell exception boundary — Complexity XL

After DSL assignment, `KanbanViewport` may calculate raw cells for:

- virtualized visible card rectangles and finite overscan;
- column/swimlane sticky rectangles and clipping;
- horizontal/vertical scroll extents;
- pointer hit maps, card-half/gutter targets, and damage regions;
- transient insertion gap, live reflow, drag ghost, and autoscroll zones when RD-07 activates them.

It implements honest `measure(available)`, paints only inside its ancestor clip, and recalculates after
size, density, locale, renderer-hint, column, grouping, or source revision changes. App-authored
overlays use `stack`/`place` when possible; menus/popups use framework overlay ownership.

### Width solver — Complexity L

Defaults describe the column surface excluding the one-cell separator:

| Density class | Minimum | Preferred | Maximum |
|---|---:|---:|---:|
| Standard default | 18 cells | 24 cells | 32 cells |

The effective minimum is the maximum of configured minimum, mandatory non-color chrome, and bounded
renderer minimum hint, clamped to the declared maximum. Localized column names may ellipsize while
preserving their complete sanitized value in semantic inspection metadata for later focus/help owners;
they do not force unbounded width. The solver first satisfies
minimums, then preferred widths, then distributes remaining cells up to maxima. Overflow creates
horizontal scroll; it never shrinks below effective minimum.

If two effective-minimum columns plus one separator cannot fit, the board uses focused-column mode.
Its conditional navigator row contains previous affordance, ellipsized name, position/count, and next
affordance; unavailable ends remain visibly disabled. The workflow header remains a compact three-row
sticky block with a joined top border, its horizontally padded label, and the joined lower separator
row. The navigator introduces no permanent side rail.

### Vertical geometry and cards — Complexity L

- Compact, comfortable, and spacious card stacks reserve one full-width blank row between cards. This
  keeps focused shadows clear of adjacent cards and provides a stable insertion target.
- Bounded custom presentation policies may explicitly choose a zero-row gap; RD-07 owns any temporary
  expansion required to expose an active insertion target in that configuration.
- Card heights derive from bounded renderer descriptors and density degradation rules, never
  unrestricted record text.
- Swimlane headers/separators are distinct from the first insertion gutter.
- Empty cells expose a larger bounded target and state surface.
- Sticky rows subtract from the card viewport before hit testing; no card target exists under chrome.

### Scrolling and anchoring — Complexity L

- Horizontal and vertical offsets clamp to live extents after every layout/source change.
- `revealCard(key, alignment?)` scrolls the smallest amount needed; RD-06 focus navigation invokes the
  same seam when introduced.
- Wheel movement is bounded and does not change selection/focus unless configured by a command.
- Resize anchors the focused card by identity and preferred relative row; if it disappears, RD-06
  reconciliation chooses the survivor before scroll correction.
- RD-07's later drag autoscroll uses the viewport's scroll seam, two-speed edge zones, and a recomputed
  hit map after each step.

### Hosting and minimum geometry — Complexity M

The board accepts its parent-assigned rectangle and makes no desktop assumptions. A window's outer
position may be absolute because the desktop is a window manager; its content remains DSL-composed.
When mandatory board chrome cannot fit, render one bounded localized minimum-size message plus any
reachable Cancel/close route owned by the host. Do not draw partial action targets.

---

## Integration Points

- **RD-02** supplies visible ranges and revisions; viewport geometry may not scan other cards.
- **RD-04** supplies bounded card descriptors and degradation priorities.
- **RD-06/RD-07** consume focus reveal and hit maps.
- **RD-13** supplies measured translations, glyph/capability fallbacks, and semantic theme roles.
- **RD-14/RD-15** verify geometry and real examples across host states.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Composition | Bespoke rects / best effort / DSL mandate | DSL mandate | Responsive everywhere | AR #41 |
| Exact cells | Whole custom board / no custom leaf / bounded leaf | Bounded viewport leaf | Virtualization without abandoning DSL | AR #42 |
| Width | Fixed / measured constrained / app only | Measured constrained | Locale/host aware and predictable | AR #24, #34 |
| Narrow UI | Shrink / focused column / fail | Focused column then safe minimum | Preserve readability without clutter | AR #24, #31, #34 |
| Hosting | Surface / window / both | Both | Reusable SDK component | AR #24 |

---

## Security Considerations

- Width/height/count arithmetic uses validated finite integers and overflow-safe bounds; hostile
  renderer hints cannot allocate or paint outside the assigned clip.
- Display text is sanitized before measurement so escape sequences cannot alter geometry/terminal state.
- Custom renderers receive no raw host, filesystem, network, clipboard, or overlay-stack authority.
- Window shadows and desktop positioning remain host controlled; the component cannot draw outside its
  ancestor clip or create spoofed global chrome.
- No server/auth/encryption/rate-limit concern exists in this local geometry layer; application host
  boundaries remain documented.

---

## Acceptance Criteria

1. [ ] At a standard 80×24 viewport with no consuming outer chrome, three default preferred columns
   plus two separators fit in 74 cells and the solver uses remaining cells without exceeding 32 each.
2. [ ] When available width is less than the sum of two effective minima plus one separator, exactly one
   focused column and one compact navigator row render; no second clipped column remains interactive.
3. [ ] Resizing from multi-column to narrow and back preserves the focused card key and restores a
   horizontally visible containing column.
4. [ ] A surface-hosted and window-hosted fixture produce equivalent board content/hit behavior inside
   equal content rectangles; only host frame/shadow differs.
5. [ ] The horizontally padded, fully framed three-row workflow headers remain visible while vertically
   scrolling cards and consume no card drop target.
6. [ ] The pure geometry model classifies a projected swimlane header separately from the first
   insertion gutter below it; the header is never classified as an insertion position. RD-05 and RD-07
   own activation of swimlane presentation and pointer/drag hit behavior.
7. [ ] Compact, comfortable, and spacious fixtures show exactly one blank row between adjacent cards.
   A bounded custom zero-gap policy remains valid, and RD-07 owns expansion of its active insertion
   gap.
8. [ ] Horizontal wheel/scroll commands and vertical wheel input clamp to live extents and never create
   negative or beyond-end offsets after columns/cards disappear.
9. [ ] A longest-locale header is clipped by display cells without splitting a wide glyph, while its
   complete sanitized label remains available in semantic inspection metadata. RD-06, RD-12, and RD-13
   own user-reachable focus/help disclosure.
10. [ ] Leaving focused-column mode hides the conditional navigator row, triggers one layout reflow,
    and lets the viewport reclaim its cells without overlap. Later status/filter/help/action owners
    reuse this seam.
11. [ ] A hostile renderer hint below zero, non-finite, or above the configured bound is rejected/falls
    back and cannot allocate an oversized surface.
12. [ ] At impossible geometry, a bounded minimum-size message renders and zero partial card/header/action
    hit targets are returned.
13. [ ] Resize, maximize, restore, locale, density, and renderer-hint changes exercise the mounted DSL
    tree and leave every solved child within its parent clip.
14. [ ] Source instrumentation proves one frame reads only descriptors intersecting visible range plus
    finite overscan.
15. [ ] Repository tests reject raw absolute placement in ordinary Kanban content and in any
    package-owned dialog content present at that phase unless the code is inside a documented sanctioned
    exception module with responsive coverage.
