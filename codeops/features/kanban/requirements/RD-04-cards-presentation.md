# RD-04: Cards and Presentation

> **Document**: RD-04-cards-presentation.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-01, RD-03
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Cards must be easy to scan in a constrained terminal while remaining generic enough for arbitrary
application data. The package supplies a mainstream `StandardCard` adapter and renderer, but all cards
flow through one bounded descriptor contract. Applications choose fields, summaries, checklist detail,
density, and reactive semantic styles without turning the card into an unbounded form or mini-dashboard.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Render generic records through typed identity/field/presentation adapters without requiring a
  fixed inheritance or storage schema.
- [ ] Supply `StandardCard`, standard adapter, standard renderer, and shared schema/editor integration.
- [ ] Always support a readable title and status in the standard presentation; preserve focus,
  selection, pending, invalid, and grab/drop state with non-color cues.
- [ ] Allow ordered configurable metadata fields, labels, priority, type, assignee, dates, estimate,
  counts, and application summaries within bounded display budgets.
- [ ] Resolve title/foreground/background/border/glyph styling reactively from card/application state
  while maintaining theme contrast and capability fallbacks.
- [ ] Support checklist modes `hidden`, `progress`, and `preview`, including multiple ordered groups,
  stable IDs, bounded items, omitted count, display-cell ellipsis, and dialog-only editing.
- [ ] Support ordered generic summary sections, where non-checklist child data is represented only by
  bounded counts/summary text in the standard renderer.
- [ ] Support `compact`, `comfortable` (default), `spacious`, and bounded custom descriptors.

### Should Have — Complexity M

- [ ] Expose deterministic standard presentation presets suitable for docs, kitchen sink, and showcase.
- [ ] Permit per-card and per-view presentation policy, with view policy defining maximum budgets and
  card policy selecting a subset rather than exceeding them.
- [ ] Let focused/help/action surfaces reveal complete values that were safely ellipsized on the card.

### Won't Have (Out of Scope)

- Inline field/checklist editing, arbitrary live controls, rich text, graphical attachment covers, or
  embedded images in the standard renderer.
- Unbounded comments, activity, attachment names, descriptions, or checklist rows on the card.
- Persisting semantic status colors as authoritative business data.

---

## Technical Requirements

### Generic card adapter — Complexity M

The board receives typed adapters for stable key and display/title/status semantics. Placement and
ordering are source semantics (RD-02), so consumer records need no required property names. Optional
field descriptors use stable string IDs and typed getters/formatters. Adapter reads must be pure,
bounded, and side-effect free; exceptions degrade the affected card/field and emit sanitized
observations without aborting the board.

### `StandardCard` convenience model — Complexity M

The standard adapter shall support required semantic values for stable identity, placement/order,
title, and status, plus optional:

- description;
- type and priority;
- one or more assignees;
- labels;
- start and due date values;
- estimate/value text;
- zero or more checklist groups;
- application summary values; and
- application custom data handled through explicit adapters.

Dates remain application values formatted by configured field formatters; the card performs no hidden
timezone conversion. Visual styles are resolver outputs, not stored status truth.

### Descriptor contract — Complexity L

A renderer receives card, density, available width, a bounded `KanbanTheme` projection/capabilities, focus/selection/operation
state, presentation policy, and a bounded formatting context. It returns terminal-cell rows/regions,
semantic style roles, hit regions for card-level actions only, and a height within configured limits.
Descriptor validation rejects negative/non-finite dimensions, regions outside the card, unsafe text,
duplicate action IDs, or rows beyond budget.

The standard descriptor uses DSL-derived section relationships and the same measurement/wrapping rules
as other JSVision content; the viewport flattens the bounded result for drawing. No descriptor may open
host resources or mutate application state.

### Standard section order and degradation — Complexity M

Default order:

1. non-color state/focus/grab marker and title;
2. status plus optional type/priority;
3. configured metadata/labels;
4. configured summary sections;
5. checklist progress or bounded preview;
6. compact pending/error feedback.

When height/width is constrained, sections degrade from the bottom according to configured priority:
checklist item rows → checklist progress → optional summaries → optional metadata. Title, status,
focus/selection, and active operation state remain. Long values ellipsize by display cells and never
split a wide glyph.

### Checklist model and display — Complexity M

- A card has zero or more ordered groups, each with stable bounded string ID and optional title.
- A group has ordered items with stable bounded string ID, text, and completion flag; extra item data is
  available only through the generic editor schema.
- Default card mode is `hidden`.
- Standard `preview` shows at most two items across selected/configured groups, preserves source order,
  includes completed items, and shows an omitted count when additional items exist.
- Compact/narrow mode degrades preview to progress-only when at least the minimum progress width fits;
  otherwise it hides checklist content.
- Empty checklists render no empty frame. Card-level checklist rows are read-only; Enter/double-click or
  an action opens the editor.

### Reactive semantic styling — Complexity M

Resolvers may return semantic title, text, background, border/marker, and glyph roles based on the
current card and state. Reads participate in JSVision reactivity and repaint only affected visible
descriptors. The package validates package-local `KanbanThemeRole` names and applies RD-13's deterministic
contrast/fallback resolver for truecolor,
256, 16, monochrome, `NO_COLOR`, and ASCII profiles. Color never carries the only status, selection,
pending, invalid, or WIP meaning.

---

## Integration Points

- **RD-03** assigns width/height budgets and degradation state.
- **RD-05** provides column/swimlane policy and WIP/DoD context.
- **RD-07/RD-08** supply grab, pending, rejected, and invalid states.
- **RD-10** edits the same standard/checklist data through the normalized schema protocol.
- **RD-13** defines exact theme roles, locale formatting, Unicode/ASCII, and contrast evidence.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Model | Fixed / generic / hybrid | Generic plus standard | Unknown application schemas | AR #4, #35 |
| Editing | Inline / dialog / both | Dialog | Preserve scanability | AR #5, #16 |
| Checklist | None / progress / bounded / full | Configurable bounded | Useful Azure-style detail without clutter | AR #25 |
| Other children | Inline rows / summaries | Summaries | Avoid miniature activity feeds | AR #26 |
| Styling | Static / custom only / semantic+custom | Semantic+reactive resolvers | Strong defaults and logic-driven color | AR #28 |

---

## Security Considerations

- Sanitize and bound every displayed title, field, label, checklist item, summary, resolver error, and
  custom descriptor row before measurement/drawing.
- Do not include descriptions, custom data, checklist text, or formatted values in diagnostics unless
  the application explicitly supplies a redacted observation label.
- Resolver/renderer code is trusted same-thread application code. The package passes no host-resource
  handles, bounds inputs/results/invocation frequency, validates returned descriptors, and isolates
  exceptions; it cannot prevent closure/import side effects or pre-empt a non-terminating synchronous
  callback. Applications own callback runtime behavior and any side effects.
- Theme roles are allowlisted; raw terminal sequences and arbitrary color-control strings are rejected.
- Dates/formatters do not perform network locale loading or implicit host access.

---

## Acceptance Criteria

1. [ ] A record whose properties have application-specific names renders through adapters without
   conversion to `StandardCard`.
2. [ ] The standard renderer always shows a non-empty sanitized title, status, and non-color focused
   marker at widths from 18 through 32 cells.
3. [ ] Changing a reactive status/style signal repaints the visible card's semantic roles without
   replacing authoritative card data or rebuilding unrelated descriptors.
4. [ ] Invalid/custom renderer output outside its width/height budget is rejected and the card displays
   a bounded fallback while neighboring cards remain usable.
5. [ ] Default checklist mode renders no checklist content; preview mode renders at most two source-order
   items and `+N` omitted evidence when more exist.
6. [ ] Compact/narrow mode converts checklist preview to progress-only before hiding it and never clips
   title/status/focus state.
7. [ ] A long checklist item ellipsizes by terminal display width without splitting a double-width glyph.
8. [ ] Empty checklist groups do not add blank card rows or frames.
9. [ ] Clicking/pressing a checklist preview cannot toggle completion inline and routes to the configured
   editor action instead.
10. [ ] Multiple checklist groups preserve stable group/item identities and source order after editor
    publication and card rerender.
11. [ ] A non-checklist summary with 100 child labels renders only its configured bounded count/summary,
    never 100 inline rows.
12. [ ] Monochrome and `NO_COLOR` frames distinguish status, focus, selection, pending, and invalid states
    without relying on foreground/background color differences.
13. [ ] ANSI/control text in every standard field is neutralized and cannot alter surrounding cells.
14. [ ] A throwing field/style/summary resolver yields one sanitized observation and a local fallback,
    not an unmounted board or leaked card payload.
15. [ ] Date presentation uses the injected formatter; the component performs no timezone conversion
    detectable by comparing the adapter input before and after rendering.
