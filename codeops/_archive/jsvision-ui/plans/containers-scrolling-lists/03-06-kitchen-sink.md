# 03-06 — Kitchen-sink stories + Navigator upgrade + demo (Phase 5)

> **CodeOps**: 3.1.0 · **PA-11, AR-110, AR-114** · the showcase gate ([`kitchen-sink-gate.md`](../../../../kitchen-sink-gate.md))
> Example code (`packages/examples/`), not published; low fidelity risk but must be polished (UX is the selling point).

## S1. Stories (AR-114) — one per new visual component

Add under `packages/examples/kitchen-sink/stories/` (+ one line each in `stories/index.ts`), category
**"Containers"**, each a `Story` returning a `Group` of absolutely-positioned children within
`ctx.width × ctx.height`, with a blurb + a live component + a visible bound-state echo + interaction
hints (the story contract). Each must pass the headless smoke test (mounts, paints, unique id, metadata).

| Story id | Component | Live demo |
|----------|-----------|-----------|
| `containers/scrollbar` | `ScrollBar` | a vertical + a horizontal bar bound to a `value` signal, with a live `value` echo; arrows/page/drag move it. |
| `containers/scroller` | `Scroller` | a small viewport over oversized text content; ↑↓/PgDn + the owned bar reveal more. |
| `containers/listview` | `ListView`/`ListBox` | a `ListBox` of ~40 items with `typeAhead`, a "selected: …" echo; ↑↓/type-ahead/click. |
| `containers/dialog` | `Dialog` | a **button** that `execView`s a modal dialog (a `Label`+`Input` with a `range` validator + OK/Cancel); shows the resolved command + whether OK was vetoed. |

The Dialog story needs the loop (`execView`); the `StoryContext` exposes `caps` only — pass the dialog
launch through a `command` the story emits + a `CommandSink` the shell already hosts, OR (simpler) the
story builds a button whose `onClick` calls a `ctx`-provided `execView`. **Decision (PA-11 scope):** add
an optional `execView?` to `StoryContext` (populated by the shell, `undefined` in the headless smoke
test) so the Dialog story degrades gracefully headless (renders the launch button; the modal path is
exercised by `demo:containers` + an app-shell e2e, not the smoke test).

## S2. Navigator upgrade (PA-11, AR-110) — `shell.ts` ONLY

Replace the menu-driven navigator with a persistent **`ListView`-in-`Scroller` left sidebar** built from
the very components RD-11 adds (dogfooding). Touches **only** `packages/examples/kitchen-sink/shell.ts`
— every `Story` file and the smoke test are untouched (the CLAUDE.md Navigator-seam guarantee).

- Layout: a left sidebar `Window`/`Group` (width ~22) hosting a `ListBox` of the story titles (grouped
  by category, category headers as disabled/separator rows), + the existing grey `StoryWindow` canvas on
  the right (shrunk to `[sidebar | canvas]`).
- **Row→Story mapping (PF-003):** because category-header rows are interleaved (and the list may be
  ordered independently of the flat `STORIES` array), the sidebar row index is **not** a `STORIES`
  index. Build a parallel `rows: Array<{ header: true } | { story: Story }>` and select →
  `showStory(row.story)` (skip header rows) — mirroring the existing menu path, which already passes the
  `Story` object, not an index (`shell.ts:232`). **Never** `showStory(STORIES[i])`. Reuse the existing
  `showStory`/`disposePrevious`/`createRoot` machinery. Focus starts in the sidebar; Tab moves
  sidebar↔canvas.
- Keep the menu bar as a redundant path (no regression); the status line gains a hint. The welcome screen
  stays as the initial canvas.
- The sidebar `ListBox` type-ahead lets you filter-as-you-type (the payoff AR-104 called out).

## S3. `demo:containers` (AR-114) — headless walkthrough

`packages/examples/containers-demo/` + a `demo:containers` script (matches `demo:controls`): a
dispatch-driven headless walkthrough with an ASCII frame per step — (1) a `ScrollBar` stepped by arrow/
page; (2) a `Scroller` revealing lower content; (3) a `ListView` navigated by ↑↓ + type-ahead + select;
(4) a modal `Dialog` with a `range`-invalid field vetoing OK, then corrected + OK resolving `Commands.ok`.
An e2e (`containers-demo.e2e`) asserts the narration + key glyphs (`▲`/`■`/the list colours/the frame).

## Spec oracle

- **ST-16** — every new story passes `kitchen-sink.smoke.spec` (mounts headlessly, paints, unique id,
  metadata); the navigator sidebar renders a `ListBox` (only `shell.ts` changed); `demo:containers` runs
  headless with an ASCII frame per step. *(AC-15)*

## Gate note
The stories/navigator are example code, but the components they show are TV-derived — the fidelity GATE-2
for each component (Phases 1–4) is what guarantees the story renders faithfully; the story itself just
composes them.
