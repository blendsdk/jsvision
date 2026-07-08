# Kanban app on @jsvision/ui — feasibility & UI exploration

> **Status:** exploration / parked idea (not committed; no requirements or plan yet)
> **Date:** 2026-07-08
> **Prompted by:** "Could we build a simplified Azure Boards / Kanboard / Trello as a TUI on jsvision?"
> **Design pitch artifact (live DOS-palette mockups):**
> https://claude.ai/code/artifact/cc392caf-f7bd-4fba-b152-3fe5b1e8c6f7
> (regenerate with WebFetch on that URL, or from the local source at
> `packages/examples/`-adjacent scratch — the artifact renders the board/dialog from an in-page data model)

## Verdict

**Feasible.** A kanban board is mostly chrome, dialogs, and lists — all of which `@jsvision/ui`
already ships. The genuinely kanban-specific parts are a short list of ~4 new views + 2 interaction
behaviors. The data model / backend was explicitly out of scope for this pass (the user's interest
was the UI).

## What already ships (reuse as-is)

| Kanban element | jsvision component | Package |
| --- | --- | --- |
| App frame, menus, F-key hint bar | `MenuBar` + `StatusLine` | app shell |
| Card editor modal (whole dialog) | `Dialog` + `Input` + `RadioGroup` + `CheckGroup` + `Button` | containers + controls |
| Due date | `DatePicker` / `Calendar` | date family |
| Label color | `ColorPicker` | color family |
| Checklist + sub-task % | `CheckGroup` + `ProgressBar` | controls + feedback |
| Multiple boards / projects | `TabView` · `ListView` | tabs · list |

The **card editor dialog is 100% existing controls** — that's the proof the data side isn't the
hard part.

## Compose (existing primitives, thin wiring)

| Kanban element | Built from | Evidence |
| --- | --- | --- |
| Column / lane (scrolls vertically) | `Scroller` is a **generic** viewport, hosts any `View`/`Group` | `packages/ui/src/scroll/scroller.ts:52-59` |
| Board (scrolls horizontally) | `Scroller` (horizontal mode) | `scroller.ts` (vertical is default `:95`) |
| Move card — **mouse drag** | `ev.setCapture` / `releaseCapture` pointer-capture seam (same one ScrollBar-thumb + Window-drag use) | `packages/ui/src/event/dispatch.ts:39-42`, `event/event-loop.ts:271-276` |
| Card hand-placement | `Group` absolute positioning (`position:'absolute'`, `rect`) | `packages/ui/src/layout/types.ts:73,79`; engine `layout/layout.ts:80,101` |

## Components to imagine (net-new)

None are exotic — each is a thin composition over `View`, `Group`, or the event-loop capture seam.

| Component | What it is | Builds on | Risk |
| --- | --- | --- | --- |
| **Card** | 2-line tile: priority stripe + wrapped title + meta row (chip · assignee · due); owns normal/focused/grabbed states | `View` + `DrawContext` | low |
| **Chip / Badge** | short colored pill (`bug`, `P0`); reusable well beyond kanban (tags, filters, status) | `View` + a theme role | trivial |
| **BoardColumn / Lane** | header (title · count · WIP-limit that reddens when exceeded) over a vertical `Scroller` of Cards + "+ Add card" | wraps `Scroller` | low |
| **Board** | horizontal band of BoardColumns with H-scroll + sticky headers | wraps `Scroller` (horizontal) | medium |
| **Memo** | multi-line text editor for the description field (`Input` is single-line) — `memoNormal` theme roles already exist, so intent is there | `Input` / editor | medium |
| **Card-move behaviors** | *not widgets*: keyboard grab → arrows → drop state machine, + mouse drag-between-columns | event-loop `setCapture` | medium |

### The key gap that forces a new `Card`

List rows render exactly **one line of text per item** — `ListRows.draw()` paints
`ctx.text(..., getText(item))` where `getText: (item) => string` returns a single string
(`packages/ui/src/list/list-rows.ts:248-249`, `:65`). A multi-line card tile (title + chips + meta)
cannot be a list row. But `Scroller` hosting a `Group` of card views sidesteps this entirely — so
`BoardColumn` and `Board` are compositions, only `Card` is a from-scratch leaf.

There is **no** existing board / multi-column-of-lists / drag-to-reorder / drag-between-containers
primitive anywhere in `packages/ui/src/`, and **no** keyboard "grab an item and move it with arrows"
gesture (Cluster arrows move a selection highlight, not the item). Those are the genuinely new bits.

## Design decisions worth keeping

- **Priority as form, not just text.** Each card's left stripe encodes priority
  (red = P0, brown = P1, green = done) so state reads at a glance; it doubles as the anchor for the
  focused (green select bar, the classic TV selection look) and grabbed (lifted + shadow) states.
- **Palette:** stays entirely within the shipped DOS-16 core palette + existing `list*` theme roles.
  No new theme roles strictly required (a dedicated `chip*`/`card*` role set would be a nicety, not a
  necessity).

## Recommended build order (if it graduates to a plan)

1. **Chip** — trivial; unblocks the card meta row.
2. **Card** — the one leaf view; ship its 3 states + a kitchen-sink story.
3. **BoardColumn** — wraps `Scroller`; header + WIP limit.
4. **Board** — horizontal `Scroller` of columns.
5. **Card-move** — keyboard grab first, then mouse drag (the only real risk).
6. **Memo** — only needed for the editor's description field.

Land a `board/kanban` kitchen-sink story alongside (per `codeops/kitchen-sink-gate.md`).

## Fidelity posture (note current directive state)

Card / Chip / Board have **no** Turbo Vision original, so they are plain new components — the
TV-fidelity gate was **demoted 2026-07-07** to a porting-guideline (decode TV source only when
porting an existing TV component). Any chrome these borrow (frames, block shadows, the green select
bar) reuses shipped, already-decoded primitives. Per the JSDoc directive, **no TV/C++ provenance or
CodeOps IDs** go in the shipped code/JSDoc — those live here in `codeops/` only.

## Open questions for a future grill_me / make_requirements

- Single board vs. multi-project / multi-board; swimlanes (horizontal lanes) or columns only?
- Persistence & data model (JSON file? SQLite? out-of-process backend?) — deferred this pass.
- WIP limits: hard block vs. soft warning on over-limit moves?
- Filtering / search / labels taxonomy; assignee source.
- Does `Card` warrant dedicated `card*`/`chip*` theme roles, or reuse `list*`?
- Scope of the app itself: a `@jsvision/examples` demo, or a new publishable package?
