# 03-02 — StatusLine as a General Child-View Container

> Implements F-2…F-5, F-7. Decisions: AR-2, AR-3, AR-4, AR-5, AR-9, AR-10, AR-12, AR-20.
> References current state 02 § "StatusLine".

## Target shape

`StatusLine` becomes a `row`-direction `Group` whose children are views: interactive `StatusItemView`
command items **and** passive segments (`spacer()`, `ProgressBar`, `Spinner`, `Text`, any 1-row view).
StatusLine stays the **single interaction owner** — it keeps `postProcess` mouse handling, the
accelerator sweep, and pointer capture; the item views are presentational (AR-4).

```
StatusLine (Group, layout.direction = 'row', gap 0)
├── StatusItemView  " Alt-X Exit "   (command 'quit', accel 'Alt+X')   fixed width = text+2
├── Empty (spacer)  fr:1                                                fill
├── ProgressBar     fixed width 20                                     passive, self-repaints
└── StatusItemView  " 12:34:56 "     (accessor text, no command)       fixed, repaints on signal
```

## Public API (AR-2, AR-3, AR-9)

```ts
/** A status entry's readable contract — retained so `const e: StatusItem = statusItem(...)` still types. */
interface StatusItem {                    // kept as the public type (AR-10)
  readonly text: string | (() => string); // accessor allowed (AR-3)
  readonly command?: string;               // optional — command-less = passive (AR-9)
  readonly key?: string;
}

/** A presentational, interactive-or-passive status entry view. `statusItem()` returns one. */
class StatusItemView extends View implements StatusItem { … }

/** Build a status entry. `command` optional (passive when omitted); `text` may be a live accessor. */
function statusItem(text: string | (() => string), command?: string, key?: string): StatusItemView;

/** Build the status line from a heterogeneous list of views (command items, spacers, widgets). */
function statusLine(children: View[]): StatusLine;
```

- **`StatusItem` retained** (AR-10): kept as the public type so the packaging oracle
  (`const statusEntry: StatusItem = statusItem(...)`, then `.command`) compiles and reads unchanged.
  Simplest realisation: `StatusItem` is an interface exposing `text`/`command`/`key`, and
  `StatusItemView` implements it (its `.command` returns the string or `undefined`). `statusItem()`'s
  declared return is `StatusItemView`, assignable to `StatusItem`.
- **`command` optional** (AR-9): omitted ⇒ passive labelled segment — never emits, skipped by the
  accelerator sweep and by the press/drag/release hit-test (AR-20).
- **`text` accessor** (AR-3): a `() => string` makes the item repaint on signal change (the view binds
  it like `Text` does). A plain `string` is static.

## StatusItemView — the presentational item (faithful render, AR-13)

Ports the current per-item drawing out of `StatusLine.draw` into one view, **cell-for-cell identical** so
the pixel oracles hold:

- Width = display-text length + 2 (one pad each side). `measure()` returns `{ width, height: 1 }`; the
  `row` sizes it `fixed` to that width so items abut with `gap:0` from column 0 (AR-7).
- Draw: fill the ` text ` span in the item's style; draw the `~…~` accelerator run(s) in the accent
  style. Style is chosen from **pressed** + **enabled** state pushed by StatusLine:
  - pressed & enabled → `statusSelected` (green) with `statusSelected.hotkey` accent;
  - pressed & disabled → greyed fg on the selected bg;
  - not pressed & enabled → `statusBar` with `statusBar.hotkey` accent;
  - not pressed & disabled → `shadow.fg` (darkGray) on `statusBar.bg`.
  (Identical to statusline.ts:138-169 today.)
- Accessor text: if `text` is a function, `measure()`/`draw()` read it inside the view's reactive bind so
  a change invalidates just this item; its width tracks the current string.
- A command-less item draws the same but is never highlighted/activated.
- **No focus, no own mouse handling** — StatusLine owns interaction (AR-4). `focusable = false`.

## StatusLine — the interaction owner

- `class StatusLine extends Group`; constructor sets `layout.direction = 'row'` and `postProcess = true`.
- `statusLine(children)` adds the children in order. Passive views (spacer/ProgressBar/…) are added
  as-is; `StatusItemView`s are just views too.
- **Hit-test** against the laid-out child bounds: `itemAt(x)` walks the **command-item** children
  (`StatusItemView` with a `command`), returning the one whose `[bounds.x, bounds.x+width)` contains
  the row-local x, else `null`. Passive segments and command-less items are skipped (AR-20) — a press
  or release over them targets nothing.
- **Mouse** (`onEvent`, unchanged semantics from statusline.ts:180): down → capture + set the pressed
  item (push `pressed`/`enabled` state to the target `StatusItemView` so it highlights); drag →
  re-target across command-item children; up → release capture + emit the command of the command-item
  under the release point if enabled. Off-item / passive-segment release emits nothing.
- **Accelerators** (key events): sweep the command-item children, match `matchesChord`, emit the first
  enabled match. Command-less/passive children carry no accelerator.
- **Seam** `attach(seam: StatusLoopSeam)` unchanged (`emitCommand`/`isCommandEnabled`/`setCapture`/
  `releaseCapture`).

### Pushing pressed/enabled state to items

StatusLine holds the `pressed` target (as today) and, on each relevant change, sets a small per-item
flag (e.g. `item.setPressed(true/false)` or a reactive `pressed` signal the item reads in `draw`) then
`invalidate()`s. Enabled state is read live from the seam in the item's draw (via a callback the item
holds, or StatusLine re-pushes on `enableCommand`). Keep the mechanism minimal and non-reactive where
the current code is imperative (matches statusline.ts).

## File plan (size)

Current `statusline.ts` is 269 lines. Split to stay ≤500:

- `packages/ui/src/status/statusline.ts` — `StatusLine` (Group), `statusLine()`, `matchesChord`, seam.
- `packages/ui/src/status/status-item.ts` — `StatusItemView`, `statusItem()`, the `StatusItem` type.
- `packages/ui/src/status/index.ts` — re-export `StatusLine`, `statusLine`, `statusItem`,
  `StatusItemView`, types `StatusItem`, `StatusLoopSeam` (additive: `StatusItemView`).

## Backward compatibility (AR-10)

- `statusLine([statusItem(...)])` compiles unchanged (statusItem → view, statusLine takes `View[]`).
- `const e: StatusItem = statusItem('~Q~uit', Commands.quit); e.command === 'quit'` holds (packaging).
- `statusLine([]) instanceof StatusLine` holds.
- The existing pixel/behavior oracles (ST-19, RD-10 ST-01/02/03) pass because `StatusItemView`
  reproduces the current per-item geometry + colours and StatusLine reproduces the press/drag/emit flow.
- Audit the 61 `statusItem(` sites: none read `.command`/`.text` off the result except the packaging
  spec (02 § blast radius) — no migration needed beyond the type retention.
