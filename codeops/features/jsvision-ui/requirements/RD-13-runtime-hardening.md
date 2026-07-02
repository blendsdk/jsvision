# RD-13: Runtime Hardening & Defect Remediation — audit-surfaced correctness, fidelity & lifecycle fixes

> **Document**: RD-13-runtime-hardening.md
> **Status**: Draft
> **Created**: 2026-07-02 (deep-audit remediation pass — 5 parallel subsystem audits of `@jsvision/core` + `@jsvision/ui`)
> **Project**: jsvision (`@jsvision/core` + `@jsvision/ui`)
> **Depends On**: RD-01…RD-07, RD-10, RD-11 (all done) + the archived **foundation** feature-set (`@jsvision/core`). This RD does **not** add features; it repairs confirmed defects in already-shipped code across the reactive core, layout, view/render, event loop, app shell, controls, containers, and the core engine (input decoder, render buffer, safety, capability, host).
> **Scoped from**: a five-agent deep audit (2026-07-02) that read every subsystem end-to-end and, for the highest-severity items, reproduced the failure by execution or diffed against the original Turbo Vision C++ (`/home/gevik/workdir/github/tvision`). This RD is the tracked remediation backlog for those findings.
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

A **hardening** RD, not a widget RD. The jsvision stack passed its acceptance gates, ships 500+ green
tests, and its process artifacts (deferred register, acceptance criteria, TV-palette fidelity) audited
clean. But a deep code-path audit surfaced a set of **runtime defects the test suite does not exercise** —
because the tests mount components at the coordinate origin, feed only well-formed input, and never
dispose scopes mid-flush. Every finding below was verified against the live source; the ones marked
*(reproduced)* were confirmed by executing a minimal repro or by cell-by-cell diff against the TV C++.

The work divides into three tiers by blast radius:

| Tier | What | Count |
|------|------|-------|
| **Critical** | Reachable crash / silent data-to-terminal / use-after-dispose in a mainline path | 3 |
| **Major** | User-visible-in-shipped-demos, focus/lifecycle corruption, or a TV-fidelity/security breach | 12 |
| **Minor** | Correctness/fidelity gaps with narrow triggers or cosmetic impact | ~20 |

Each requirement below carries: **the defect** (what is wrong + `file:line`), **the failure scenario**
(concrete inputs → wrong behavior), **how to test** (the regression a spec/impl test must encode), and
**expected result** (the post-fix oracle). Per the project's **NON-NEGOTIABLE TV-fidelity directive**, every
fidelity fix must be re-diffed against the original C++ (`source/tvision/t*.cpp`) before and after — the
C++ outranks any of our current spec oracles.

---

## Functional Requirements

### Must Have (Critical — fix first)

#### HR-01 — Hostile UTF-8 bytes on stdin crash the whole app *(reproduced)*
- **Defect.** `packages/core/src/engine/input/keys.ts:262-319` (`decodePrintable`/`utf8Length`/`decodeUtf8`).
  `utf8Length` accepts lead byte `0xF4` for a 4-byte form, the continuation loop validates only the
  `10xxxxxx` bit pattern (not the numeric range), and the assembled code point is passed to
  `String.fromCodePoint` unchecked. There is **no** overlong / surrogate / >U+10FFFF rejection.
- **Failure scenario.** Bytes `F4 90 80 80` assemble to `0x110000` → `String.fromCodePoint(0x110000)`
  throws `RangeError: Invalid code point 1114112`. In the running host this throws inside the stdin
  `'data'` handler → `uncaughtException` → `handleFatal` → the app calls `exit(1)`. Any process that can
  write to the controlling TTY (a paste, a subshell, a malicious program) can kill the app with 4 bytes.
  Related, same site: `ED A0 80` decodes to a **lone surrogate** key `"\uD800"`; overlong forms
  (`E0 80 80` → U+0000, `C0 80` → NUL) pass validation and surface NUL/C1 code points as "printable" keys —
  violating the decoder's allowlist-only contract (foundation AC-8).
- **How to test.** Add a decoder spec: feed each of `[F4,90,80,80]`, `[ED,A0,80]`, `[E0,80,80]`, `[C0,80]`
  through `decode(createDecoderState(), Uint8Array.of(...))`; assert `decode` **never throws** and emits
  **zero** key events (bytes dropped-and-resynced), and that `flush()` leaves no carry. Add a fuzz seed
  covering the full `0x80–0xFF` lead-byte space × random continuations asserting no throw.
- **Expected result.** Out-of-range (`> U+10FFFF`), surrogate (`U+D800–U+DFFF`), and overlong encodings are
  detected after assembly and dropped (`{status:'drop'}`), exactly as an invalid lead byte already is. The
  decoder stays pure and total: no input sequence can throw or produce a non-scalar-value key.

#### HR-02 — Mouse clicks inside a modal are offset by the modal's ancestor position *(verified in source)*
- **Defect.** `packages/ui/src/event/hit-test.ts:129-137`. When a modal is active the hit path builds
  `rootRect` from `scopeRoot.bounds` **directly** and passes `scopeRoot.bounds.x/y` to `topMost()` as the
  absolute origin. But `View.bounds` is **parent-relative** (`view/view.ts:37`); only the mounted tree root
  is absolute. The capture branch 6 lines above correctly uses `absoluteOrigin(ctx.captureTarget)`; the
  modal-scope branch does not.
- **Failure scenario.** Any app with a `MenuBar` places its `Desktop` at absolute `y=1`. A modal `Dialog`
  opened via `execView` (the flagship kitchen-sink pattern, `examples/kitchen-sink/shell.ts:198-206`) is a
  child of that desktop, so its `bounds` are relative. Every click inside resolves one row too low: a
  `ListBox` row selects the row **below** it, a button's top row computes `local.y = 1`, and clicks on the
  dialog's real bottom row fall outside its believed rect and are silently dropped as "outside modal". The
  suite misses it because modal tests mount the dialog at the origin (offset 0).
- **How to test.** Spec: build a tree with a root offset (desktop at `y≥1`), open a modal child via
  `execView`, dispatch a mouse-down at a known absolute cell over a known child, assert the delivered
  `ev.local` equals the child-local coordinate (not shifted by the ancestor offset), and that a click on
  the modal's last row hits the modal (not "outside").
- **Expected result.** `hitTestRoute` computes the scope origin with `absoluteOrigin(scopeRoot)` (mirroring
  the capture branch) so modal hit-testing is offset-correct at any ancestor depth. One-line fix + oracle.

#### HR-03 — Disposing a scope does not neutralize its queued effects → use-after-dispose + permanent resurrection *(verified in source)*
- **Defect.** `packages/ui/src/reactive/owner.ts:141-158` + `scheduler.ts:205-216`. `dispose()` severs each
  owned computation's source edges and runs its cleanups, but **never resets `computation.state`** (there is
  no `disposed` flag on `Computation`, and disposed effects are not removed from `pendingEffects`). The flush
  loop's only skip test is `if (effect.state === NodeState.CLEAN) continue` — and disposal leaves a queued
  effect at `DIRTY`. The loop comment even claims it skips "disposed this drain", but nothing sets it clean.
- **Failure scenario.** `batch(() => { s.set(1); dispose(scope); })`: the write marks an effect in `scope`
  DIRTY and queues it (flush deferred by the batch); `dispose()` clears its edges but leaves state DIRTY;
  batch close → flush → `updateIfNecessary` → `execute` runs the **disposed** effect's body, which
  **re-collects its dependency edges** (re-subscribes). Since `owner.owned` was already emptied, nothing can
  ever dispose it again — it re-runs on every future write to `s`, forever. The same happens with no batch:
  an effect earlier in a drain that disposes a sibling scope containing an already-queued effect (exactly
  what a `Show` branch flip or `For` row removal does mid-flush) resurrects it.
- **How to test.** Impl spec: create a root, inside it an effect tracking signal `s`; in a `batch`, write
  `s` then `dispose` the root; assert the effect body does **not** run after disposal and that a subsequent
  `s.set(...)` triggers **zero** re-runs. A second oracle: a `Show`/`For` whose branch/row is torn down in
  the same flush that also dirtied a child effect — assert no post-teardown execution and no leaked
  subscription (the removed node is not in any source's `observers`).
- **Expected result.** `dispose()` marks each owned computation disposed (a flag checked at the top of
  `execute`/`updateIfNecessary`, and/or the flush loop), so a queued-but-disposed effect is skipped and can
  never re-subscribe. Disposal is final: no computation runs after its owner is disposed.

### Must Have (Major)

#### HR-04 — Chunk-split DCS terminal reply leaks into the app as keystrokes *(reproduced)*
- **Defect.** `packages/core/src/engine/capability/responses.ts:118-130` + `input/decoder.ts:154-160`.
  `matchResponse` returns `null` for an **incomplete** DCS (`ESC P … ` with no `ST` terminator yet) —
  indistinguishable from "not a response" — so the decoder falls through to the keyboard branch. CSI-shaped
  replies survive chunk boundaries only by accident (the CSI fallback reports `incomplete`); DCS has no
  incomplete path.
- **Failure scenario.** The first chunk of an `XTVERSION` reply `\x1bP>|kitty 0.32` arriving split yields
  13 key events (`alt+P`, `>`, `|`, `k`, `i`, …) and 0 query results — reproduced. Violates foundation AC-6
  and the module's own JSDoc claim that "a terminal reply physically cannot leak as a keystroke".
- **How to test.** Decoder spec: feed a DCS reply split at every interior byte offset; assert each split
  yields the same single query result (or `incomplete` carry) and **zero** key events.
- **Expected result.** An in-progress DCS (opened `ESC P` with no `ST`) returns `incomplete` so the decoder
  carries it to the next chunk, identical to the CSI path.

#### HR-05 — `sanitize` passes `\t`/`\n` into the cell grid, desyncing the damage-diff *(reproduced)*
- **Defect.** `packages/core/src/engine/safety/sanitize.ts:41-44` keeps tab/newline (correct for the
  logger), but `render/buffer.ts:109-128` then stores them as **width-1 cells holding the raw control byte**
  (`charWidth('\t') === 0`).
- **Failure scenario.** `text(0,0,'a\t')` → `serialize` output literally contains `\t`
  (`"\x1b[1;1Ha\t   \x1b[0m"`); the terminal jumps to the next tab stop and every subsequent column in that
  row is mis-addressed by the diff for the frame's life. Mid-string, `'a\tb'` renders `"ab"` (the next glyph
  overwrites the control cell) — silent text corruption. Reproduced both.
- **How to test.** Render spec: write `'a\tb'`, `'a\nb'`, and a lone `'\t'` via `ScreenBuffer.text`; assert
  the serialized bytes contain **no** raw `\t`/`\n`/C0 controls and that column addressing stays consistent
  (glyph count and positions match a tab-expanded-or-stripped oracle).
- **Expected result.** The **grid boundary** (`ScreenBuffer.text`/`set`) strips or space-expands `\t`/`\n`
  and other C0 controls before storing cells (the logger keeps its own newline-preserving sanitize). No raw
  control byte can enter a cell or the serialized ANSI stream.

#### HR-06 — The "screen-safe" logger writes onto the live TUI in the common config *(verified in source)*
- **Defect.** `packages/core/src/engine/safety/logger.ts:176-189`. The stderr sink's UI guard is a
  **file-descriptor-number** compare (`if (2 === uiFd) throw`). Interactively, stdout (fd 1, the UI) and
  stderr (fd 2) are the **same terminal device**, so the guard never fires. The file-path sink correctly
  compares `{dev,ino}` (`assertFileNotUiStream`); the stderr path never stats.
- **Failure scenario.** `BLENDTUI_DEBUG=1` with no `BLENDTUI_LOG` → sink resolves to `'auto'` → stderr →
  every log line scribbles over the raw-mode alt-screen. Defeats foundation AC-7 exactly when logging is
  most wanted.
- **How to test.** Safety spec: with a fake runtime where fd 1 and fd 2 share a `{dev,ino}`, constructing a
  stderr/auto logger while the UI owns that device **throws** (or degrades to a no-op sink); with distinct
  devices it is allowed.
- **Expected result.** The stderr sink stats its target and compares device identity to the UI stream (same
  test the file path uses), not the raw fd number. Logging can never land on the UI device.

#### HR-07 — Capability detection never enables glyphs → box-drawing degrades to ASCII on every terminal *(reproduced)*
- **Defect.** `packages/core/src/engine/capability/defaults.ts:30` sets `glyphs: {all false}`, and **no**
  layer ever turns them on: `env.ts` sets only `unicode.utf8`/`multiplexer`; `table.ts` (kitty/iTerm2/VTE/WT)
  asserts truecolor/OSC/mouse but never `glyphs`; the runtime query parses only `sync2026`.
- **Failure scenario.** `resolveCapabilities({env:{TERM:'xterm-kitty',COLORTERM:'truecolor',LANG:'en_US.UTF-8'}})`
  returns `glyphs.boxDrawing/halfBlocks/ambiguousWide = false` even with `utf8:true` — reproduced — so
  `fallbackGlyph` turns every `┌─│` into `+-|` and `█▒` into `#`. **Every** live demo hand-overrides caps to
  compensate (`kitchen-sink/main.ts:32`, `controls-live/main.ts:72`, `tvision-demo/main.ts:128`). The
  "zero-config adaptation" contract is unfinished.
- **How to test.** Capability spec: `resolveCapabilities` with a UTF-8 locale (and/or a known Unicode-capable
  `TERM`) yields `glyphs.boxDrawing = true` and `halfBlocks = true`; a non-UTF-8/`TERM=dumb` locale keeps
  them false. Then remove the manual glyph override from one demo and assert its golden frame still renders
  box-drawing (not ASCII).
- **Expected result.** A UTF-8 locale (at minimum) implies `boxDrawing`+`halfBlocks` in the env/table layer,
  with `ambiguousWide` staying conservative (off) per the glyph-auto-swap design (DEF-23). Demos drop their
  hand-overrides.

#### HR-08 — `Commands.close` is emitted by shipped chrome but handled by nothing *(verified in source)*
- **Defect.** `packages/ui/src/desktop/desktop.ts:223-231` (`handleCommand`) covers
  `zoom/next/prev/cascade/tile` only; `close` falls through to `return false`, and no other view handles a
  `'close'` `CommandEvent` (`Window.onEvent` handles mouse-down only, `Dialog` only the four terminating
  commands). Yet `status/commands.ts:5-8` documents `close` as "handled by the Desktop's post-process
  `onEvent`", and `examples/tvision-demo/main.ts:92,104` binds it twice (a `Cl~o~se` menu item + an
  `~F3~ Close` status item / F3 accelerator).
- **Failure scenario.** In tvision-demo, pressing F3 or picking File→Close does nothing, silently.
- **How to test.** App-shell spec: emit `Commands.close` while a `Window` is focused on the desktop; assert
  the focused window is removed (and the next window focused). Assert the tvision-demo F3 path closes the
  active window.
- **Expected result.** `Desktop.handleCommand` handles `close` by closing the active window (mirroring TV
  `cmClose`), setting `ev.handled`. The documented status/menu bindings work.

#### HR-09 — Close/zoom/resize hit-zones are live on inactive windows → click-to-activate can instantly close *(TV-fidelity, verified against `tframe.cpp`)*
- **Defect.** `packages/ui/src/window/window.ts:140-158` raises the window, then maps `frameZoneAt`
  **unconditionally**; `window/frame.ts:203-222` gates no zone on `active`. TV gates every frame affordance
  on `sfActive` (`tvision/source/tvision/tframe.cpp:150-153` close, `:168-169` zoom, `:186-193` grips) — an
  inactive window's first click only selects/drags. Our frame **draws** the `[×]`/`[↑]` boxes and grips only
  when active (`frame.ts:170,186`), so the affordances are invisible but still hot.
- **Failure scenario.** Clicking the left end of an **inactive** window's title bar (a natural "click to
  activate" spot) activates it **and immediately closes it** via the invisible close box; the zoom zone and
  both bottom-corner grips likewise trigger surprise zoom/drag on first click. Destructive UX + fidelity
  breach.
- **How to test.** App-shell spec: with window B inactive (A focused), dispatch a mouse-down over B's
  `close`/`zoom`/grip columns; assert B is raised/activated and **not** closed/zoomed/resized; a **second**
  click on the now-active zone performs the action. Re-diff against `tframe.cpp:150-193`.
- **Expected result.** `frameZoneAt` returns `title`/`interior` (select+drag only) for close/zoom/grip
  columns while inactive; the affordance activates only once the window is active — matching TV `sfActive`
  gating.

#### HR-10 — Removing the focused child leaves a dangling `current` pointer → keys flow to an unmounted view *(verified in source)*
- **Defect.** `packages/ui/src/view/group.ts:68-75` (`remove`) and `:139-144` (`unmountDynamicChild`) never
  clear `this.current`. The focus chain **is** those pointers (`event/focus.ts:73-80`), so after removal
  `getFocused()` returns the unmounted leaf and dispatch Phase-2 delivers every key to it.
- **Failure scenario.** Close the **last** window while an `Input` inside it is focused (click its `[×]`):
  `Desktop.removeWindow` (`desktop.ts:104-113`) re-focuses only when another window remains, so with zero
  windows `desktop.current` still points at the removed window and subsequent typing mutates the dead
  `Input`'s signal until a Tab/click heals focus. `Group.remove` in general never heals.
- **How to test.** Focus spec: build a group with two focusable children, focus one, `remove` it; assert
  `getFocused()` is `null` or the sibling (not the removed view) and that a dispatched key does not reach the
  removed view. Repeat via `unmountDynamicChild` (a `Show`/`For` removal).
- **Expected result.** `remove`/`unmountDynamicChild` clear `current` when it points at (or descends into)
  the removed child, and `Group` re-homes focus to a remaining focusable sibling (or clears it). No keystroke
  reaches an unmounted view.

#### HR-11 — `isFocusable` returns true for detached views → focus-restore after modal/menu close blurs the real leaf *(verified in source)*
- **Defect.** `packages/ui/src/event/focus.ts:44-55`. An unmounted view has `parent === null`
  (`view.ts:215-222`), so `noBlockingAncestor` trivially passes and `visible && !disabled && focusable`
  still holds. `event/modal.ts:71-72` and `menu/controller.ts:234-236` both rely on "focusView is a no-op if
  the saved target is no longer focusable" — a false assumption.
- **Failure scenario.** Window W focused → confirm-`Dialog` via `execView` (savedFocus = W's leaf) → the
  handler removes W then calls `endModal` → `focusView(detached leaf)` runs `focusLeaf`: it **blurs the real
  focused leaf** while `setCurrentChain` no-ops (parent null). `current` still points at the old leaf, so
  `getFocused()` returns a view whose `focused` flag is false and dispatch keeps routing to it while nothing
  renders focused. Same path from menu `close()` if the saved focus target was removed while the menu was
  open.
- **How to test.** Focus spec: `isFocusable(view)` is **false** once the view is unmounted (parent null and
  not the tree root); `focusView(detachedLeaf)` is a genuine no-op (does not blur the current real leaf).
- **Expected result.** `isFocusable` requires the view to be mounted (reachable to the scope root), so
  restoring focus to a since-removed target is a real no-op and never corrupts the live focus flag.

#### HR-12 — `flush()` clears `needsReflow`/`dirty` *after* the work, dropping invalidations raised during flush *(verified in source)*
- **Defect.** `packages/ui/src/view/render-root.ts:255-259` runs `reflow()` then sets
  `this.needsReflow = false`, and `:278` does `this.dirty.clear()` after compose. `reflow()` fires pending
  `onMount` callbacks (`reflow.ts:35`) — the documented `bind()` site — and a bind effect (or a
  `group.add(child)` inside `onMount`) sets `needsReflow = true` / marks a view dirty **mid-flush**, which
  the trailing assignment immediately clobbers.
- **Failure scenario.** `onMount(() => group.add(child))` → the child is composed with `bounds {0,0,0,0}`
  and stays invisible until an unrelated resize/relayout. Symmetrically, a `draw()` that calls another
  view's `invalidate()` during partial compose has its mark erased by `dirty.clear()`.
- **How to test.** Render spec: mount a group whose child registers `onMount(() => group.add(grandchild))`;
  after the initial flush settles, assert the grandchild has non-degenerate bounds and painted. A second
  oracle: a `draw()` that invalidates a sibling causes that sibling to recompose on the next scheduled flush.
- **Expected result.** `flush()` snapshots/clears `needsReflow` and the dirty set **before** doing the work
  (or re-checks after), so invalidations raised during reflow/compose survive into the next tick. Deferred
  mounts become visible without an unrelated trigger.

#### HR-13 — Unowned `Show`/`For` in the documented `addDynamic(...)` pattern leak after unmount *(verified in source)*
- **Defect.** `packages/ui/src/reactive/for.ts:119-124` and `show.ts:26-45` attach their driving
  effect/computeds to the **ambient owner at call time**. The spec-blessed usage
  `group.addDynamic(Show(...))` (`view/group.ts:88-91`; see `test/view.dynamic.spec.test.ts:36,63`) runs
  during widget construction, outside any scope → they attach to `null` (only a dev-warn).
- **Failure scenario.** After the group unmounts, the group's reconcile effect dies with the group scope,
  but `For`'s effect stays subscribed to `each` and keeps reconciling — calling `render()` and creating
  fresh item `createRoot` scopes (also parented to `null`, also never disposed) for views nobody mounts;
  `Show` keeps rebuilding branches on every condition flip. A structural leak in the documented pattern, not
  user error.
- **How to test.** View spec: mount a group with an `addDynamic(For(sig, …))`, unmount the group, then write
  `sig`; assert the `For` render function is **not** called again and no new scopes are created (track via a
  side-effect counter / `onCleanup` firing).
- **Expected result.** `addDynamic` runs the combinator under the group's owner scope (via `runWithOwner`),
  so the combinator's lifetime is tied to the group; on unmount its effect/computeds dispose and stop
  reconciling.

#### HR-14 — Stale drag gesture survives external capture loss → later mouse-move teleports the window *(verified in source)*
- **Defect.** `packages/ui/src/desktop/desktop.ts:186-203` clears `gesture` only on a delivered mouse-`up`.
  But `execView`/`endModal` clear `captureTarget` directly (`event/event-loop.ts:138,155`) and `routeContext`
  auto-releases capture on unmount (`:237-239`) — none notify the Desktop. A stray `up` over a *window*
  doesn't clear it either (non-down mouse is delivered top-most-only; `Window.onEvent` ignores `up`).
- **Failure scenario.** A modal opens mid-drag (a timer/async `execView`, or a key-triggered command while
  the button is held) → the `gesture` object persists → after the modal closes, the next plain desktop
  mouse-move re-enters the gesture branch and teleports the target window to the cursor (`applyMove` runs,
  `ev.handled = true`). `StatusLine.holding` (`status/statusline.ts:167-189`) has the same latent flag,
  though it self-heals on the next press.
- **How to test.** App-shell spec: begin a drag gesture, open+close a modal (clearing capture) without a
  mouse-up, then dispatch a mouse-move over the desktop; assert **no** window moves and the gesture is
  cleared.
- **Expected result.** The Desktop clears `gesture` whenever its capture is released (a capture-release
  notification / an "am I still the capture target?" guard before applying a gesture). No stale gesture
  re-applies.

### Should Have (Minor — same-cycle cleanups)

Each is a confirmed defect with a narrow trigger or cosmetic impact. Group into the plan by subsystem.

**Core engine**
- **HR-15** — Host restart diffs against a stale baseline (`host/host.ts:79-81`): `stop()`→`start()` never
  resets `prev`/`lastBuffer`/`decoderState`; the first post-restart frame paints only changed cells onto a
  fresh alt-screen, leaving garbage. *Test:* start→render→stop→start→render a differing frame; assert full
  repaint. *Expected:* `start()` (or `stop()`) resets the diff baseline + decoder carry.
- **HR-16** — `ESC ESC` (and Alt+Escape) swallows both bytes (`input/keys.ts:106-127`) *(reproduced: 0
  events)*. *Test:* `decode([0x1b,0x1b])` → assert two `escape` events (or one + carry that flushes to a
  second), and Alt+Escape decodes. *Expected:* double-Esc yields two escapes; the Alt-prefix branch handles
  a second ESC.
- **HR-17** — Combining marks stored as standalone cells, accent lost (`render/buffer.ts:123-127`)
  *(reproduced: `'éx'` → `["e","x"]`)*. *Test:* write `'é'`; assert the mark composes onto the
  base cell (width unchanged, glyph carries the mark). *Expected:* zero-width combining marks attach to the
  preceding cell.
- **HR-18** — Wide-glyph fallback under `unicode.utf8:false` shifts columns (`render/glyphs.ts:100-103` +
  `serialize.ts:87-94`): a width-2 lead falls back to a single `?` but the run assumes 2 columns. *Test:*
  serialize a wide glyph with utf8 off; assert two fallback cells (`??` or blank+`?`), no column drift.
  *Expected:* wide-lead fallback emits two columns.
- **HR-19** — `width.ts` WIDE table misses many EAW-Wide code points (`render/width.ts:48-65`: `U+2B50`,
  `U+231A/B`, `U+23E9–23F3`, `U+2705`, `U+2728`, `U+274C`, `U+1F004`, `U+1F200–1F2FF`, Tangut `U+17000+`,
  emoji). *Test:* table-driven `charWidth` over a sample of these; assert width 2. *Expected:* the WIDE table
  matches Unicode EAW `W`/`F` for the common ranges (import or generate the ranges).
- **HR-20** — Changed continuation cell with an unchanged lead serializes to an empty styled run
  (`render/serialize.ts:80-99`) *(reproduced: `shadow()` over a wide glyph emits zero-glyph bytes; the
  recolor never appears)*. *Test:* recolor only the continuation of a wide glyph; assert the visible glyph is
  re-emitted (or the lead is included in the damage run). *Expected:* a continuation change re-emits its lead
  glyph.
- **HR-21** — `setClipboard` sanitizes before base64, mutating clipboard content (`render/osc.ts:47-51`)
  *(reproduced: `'line1\r\nline2'` → CR stripped)*. *Test:* round-trip text with CR/control chars through
  `setClipboard`; assert the base64 payload decodes to the **exact** input. *Expected:* base64 already
  prevents breakout; drop the pre-encode sanitize (or make it lossless).
- **HR-22** — Layer-2 `passthrough` bytes documented as forwarded (AC-4) but dropped
  (`capability/query.ts:36-41` returns them; `capability/index.ts:105` destructures only `parsed`). *Test:*
  bytes typed during async detection surface as key events after detection. *Expected:* passthrough bytes are
  re-injected into the decoder.
- **HR-23** — `KEY_NAMES` (and `PasteState`, part of the exported `DecoderState`) referenced by public JSDoc
  but not exported from `input/index.ts`/`engine/index.ts`. *Test:* import both from `@jsvision/core`.
  *Expected:* both are public exports (single-entry-point rule).
- **HR-24** — `ESC [` (Alt+`[`) carried forever; the next keypress fuses into a phantom key
  (`decoder.ts:114-122` arms the flush timer only for `carry.length === 1`). *Test:* `decode([0x1b,0x5b])`
  then `flush()`; assert an Alt+`[` (or escape+`[`), not a fused CSI on the next key. *Expected:* the host
  arms the flush timer for any ESC-prefixed carry.
- **HR-25** — `box()` title centering uses code-point count, not display width (`render/buffer.ts:198-202`):
  a CJK/emoji title mis-centers and can overflow. *Test:* a wide-char title centers by display width and
  clips to the box. *Expected:* width-aware centering + clip. *(Same class as HR-30 in ui `draw-context`.)*
- **HR-26** — Env-var branding split: logger gates on `BLENDTUI_DEBUG`/`BLENDTUI_LOG`
  (`safety/logger.ts:53,172,217`) while the host uses `JSVISION_ASCII` (`host/host.ts:72`). *Test/Expected:*
  pick one brand prefix; document the switches. (Decision item — see Scope Decisions.)

**Reactive core**
- **HR-27** — A throwing `computed` is left `CLEAN` with an uninitialized memo; later reads silently return
  `undefined` and never retry (`scheduler.ts:90` sets CLEAN before running `fn`; `computed.ts:56-66`).
  *Test:* `computed(() => { throw })`; first read throws, a second read **also** throws (not `undefined`).
  *Expected:* a throwing compute leaves the node re-evaluable (state not settled CLEAN on throw; error
  re-thrown on read).
- **HR-28** — Computed dependency cycles bypass the runaway guard and yield `undefined` silently
  (`scheduler.ts:81-106,171-188`): the guard counts flush iterations (effect loops), not compute recursion.
  *Test:* `a ⇄ b` computeds; reading throws `ReactiveCycleError` (not a silent `undefined`). *Expected:*
  compute recursion is cycle-detected.
- **HR-29** — `batch()` masks the body's exception when the closing flush also throws
  (`scheduler.ts:255-263`): the `finally` flush's error replaces the in-flight one. *Test:* a batch whose
  body throws **and** whose flush throws surfaces the body error (flush error attached/aggregated).
  *Expected:* the original exception is not lost.

**View / draw**
- **HR-30** — `box()` centers title by code-point count and `text()` drops zero-width glyphs
  (`view/draw-context.ts:104,69`). *Test/Expected:* as HR-25 (display-width centering; combining marks
  composed, not skipped).
- **HR-31** — Toggling `state.visible` with only `invalidate()` is silently ineffective both directions
  (`render-root.ts:119-123,272`): hidden→shown has no cache entry so the partial path drops the repaint;
  shown→hidden leaves stale pixels. *Test:* flip `visible` and call `invalidate()` (not
  `invalidateLayout()`); assert the view appears/disappears. *Expected:* `invalidate()` alone honors a
  visibility flip (or the API documents `invalidateLayout()` as required and `invalidate()` no-ops loudly).
- **HR-32** — `View.onCleanup()` called inside a running effect attaches to that effect, not the view scope
  (`view.ts:188-193` + `owner.ts:109-121`): fires on every effect re-run, contradicting its "once on unmount"
  JSDoc. *Test:* `view.onCleanup(fn)` inside a `bind` body; `fn` fires once at unmount, not per re-run.
  *Expected:* `View.onCleanup` binds to the view scope (guard with `untrack`, mirroring `View.mount`).
- **HR-33** — `naturalSize` counts `position:'absolute'` children toward intrinsic size
  (`layout/measure.ts:49-53` vs `layout.ts:73-75`). *Test:* an `auto` container with a small flow child + a
  large absolute child reports the flow child's natural size. *Expected:* `naturalSize` filters out absolute
  children (as the flow layout does).
- **HR-34** — Partial recompose's occlusion test ignores shadow overhang → repainting a view wipes an
  adjacent window's drop-shadow (`render-root.ts:297-311,84-106`). *Test:* two side-by-side windows, the
  front casting a shadow onto the back; invalidate the back; assert the shadow survives. *Expected:*
  occlusion/dirty rects include the 2×1 shadow margin (or re-cast shadows after a partial recompose).

**Event loop / app shell**
- **HR-35** — Menu controller stuck state via `switchTop` onto a bare top-level `item`
  (`menu/controller.ts:249-257,184-188`): leaves `openTopIndex` set with zero levels and never emits the
  command; Esc then early-returns and the menu stays open (arrow/Enter dead). *Test:* a menu bar with a bare
  top-level command item; arrow onto it, press Esc; assert the menu closes. *Expected:* `switchTop` onto a
  bare item either emits+closes or is disallowed; Esc always closes.
- **HR-36** — Outside-click catcher/popups frozen at open-time geometry across a resize
  (`controller.ts:201-205`; `run.ts:86-91` resizes only the overlay). *Test:* open a menu, resize the
  viewport larger, click in the new region; assert the click hits the catcher (menu closes / inert outer
  tree). *Expected:* the catcher rect tracks viewport resizes while a menu is open.
- **HR-37** — `Dialog.modalHost` never cleared after `endModal` (`dialog/dialog.ts:68-70,145-161`): a
  retained post-modal dialog swallows every later Esc and could pop a *later* modal's frame with `'cancel'`.
  *Test:* keep a dialog mounted after its modal ends; assert a global Esc is not consumed by it and does not
  end an unrelated modal. *Expected:* `modalHost` is cleared when the modal session ends.
- **HR-38** — `quit` silently unreachable while a modal is open (`event-loop.ts:230-232` confines sweeps to
  the modal subtree; the `QuitCommandSink` is at the root). *Test/Expected:* a keymap-bound quit chord during
  a modal either reaches the sink or is explicitly, visibly refused (design decision — see Scope Decisions).
- **HR-39** — `advance()` loses position when the focused child is no longer a candidate
  (`focus.ts:149-159`, `indexOf → -1`); and disabling the focused view doesn't evict focus (Phase-2 keeps
  delivering to a `disabled` view). *Test:* disable the focused child, press Tab; assert focus moves to the
  neighbor and no key reaches the disabled view. *Expected:* disabling the focused view evicts focus; Tab
  resumes from the nearest candidate.
- **HR-40** — Clicking a different menu-bar title while a menu is open needs two clicks (the full-viewport
  catcher sits above the `MenuBar` in z; `controller.ts:83-89`). *Test:* open menu A, click title B; assert
  menu B opens directly. *Expected:* a click on another title switches menus (TV behavior).
- **HR-41** — Zoom/restore rect staleness across desktop resize (`window.ts:96-106`): a zoomed window keeps
  its old size after a terminal resize; `restoredRect` may lie off a shrunken desktop. *Test:* zoom, resize
  the desktop, assert the zoomed window re-maximizes and the restore rect stays on-screen. *Expected:*
  re-maximize on resize; clamp `restoredRect` into the desktop.
- **HR-42** — Sweep delivery to views unmounted earlier in the same sweep (`dispatch.ts:62-72,144-158`):
  `collectSweep` snapshots, then delivers without a `mounted` check. *Test:* a handler that removes a later
  view mid-sweep; assert the removed view is not delivered to. *Expected:* `deliver` skips unmounted views.

**Controls / containers (TV fidelity + editor correctness)**

> Re-diff each fidelity fix against the cited `.cpp` before/after (GATE-1/GATE-2).

- **HR-43** — Bracketed paste inserts raw control chars into the `Input`'s bound signal
  (`controls/input.ts:300-308` → `input-clipboard.ts:91-108`); TV converts `\t\r\n`→spaces
  (`tinputli.cpp:430-431`). *Test:* paste two-line text; assert the bound `Signal<string>` contains no
  control chars. *Expected:* paste maps `\t\r\n`→space (and drops other C0) before insert.
- **HR-44** — Cluster item hotkeys only fire while focused (`controls/cluster.ts:31-37` sets only
  `focusable`; TV `TCluster` sets `ofPreProcess|ofPostProcess`, `tcluster.cpp:46,257-284`, and calls
  `focus()`). *Test:* Alt+hotkey on an unfocused `CheckGroup`; assert it selects+presses the item and moves
  focus. *Expected:* `Cluster` is a post-process view; hotkeys work dialog-wide and take focus.
- **HR-45** — Picture autoFill misplaces the caret on a mid-string insert (`input-clipboard.ts:75` applies
  the trailing-append length delta at `pos`) *(reproduced: mask `'@@--'`, value `"a"`, caret 0, type `b` →
  caret 3, not 1)*. *Test:* the repro; assert caret sits after the typed char. *Expected:* caret advances by
  the characters inserted **at** the caret, not by the trailing-literal delta.
- **HR-46** — `Input` mutates selection on drags it never started (`controls/input.ts:465-471`, no
  "am-I-dragging" guard). *Test:* press on a neighbor view, drag across a focused `Input`; assert its
  selection/caret are unchanged. *Expected:* the drag/move handler no-ops unless this Input began the drag
  (mirror `scroll-bar.ts:239-240`).
- **HR-47** — Deletions bypass the validator (`input.ts:355-371` backspace/`delete`, `:286-291` cut never
  consult `isValidInput`); TV reverts an invalid transient delete (`tinputli.cpp:380-413,481-483`). *Test:*
  `picture('(###)###-####')` on `"(12"`, Backspace the `(`; assert the delete is rejected/reverted.
  *Expected:* deletions re-validate transiently and revert if invalid.
- **HR-48** — Ctrl+Backspace deletes one char instead of a word (`input.ts:338-339` ignores modifiers); TV
  `kbCtrlBack`→`prevWord` (`tinputli.cpp:389-397`). *Test:* Ctrl+Backspace mid-word; assert word delete.
  *Expected:* Ctrl+Backspace/Ctrl+Del do word-wise delete. (`kbIns` overwrite + Ctrl+Y clear stay deferred —
  see below.)
- **HR-49** — ScrollBar track (page-area) click page-steps instead of TV's jump-to-position+drag
  (`scroll/scroll-bar.ts:225-236` vs `tscrlbar.cpp:181-208`, whose `default:` jumps the thumb to the mouse
  and follows). *Test:* click mid-track; assert the thumb jumps to that cell and follows a drag. *Expected:*
  track click = jump-to-position + drag (keyboard path keeps page-step).
- **HR-50** — Inactive list loses the focused-row highlight (`list/list-rows.ts:175`); TV keeps
  `getColor(4)`/`listSelected` on the focused row when unfocused (`tlstview.cpp:86-130,208-211`). *Test:*
  focus a list, focus away; assert the focused row keeps a highlight. *Expected:* unfocused list draws its
  focused row in `listSelected`.
- **HR-51** — `<empty>` text drawn at column 0; TV draws at column 1 (`list/list-rows.ts:159` vs
  `tlstview.cpp:147-148`). *Test/Expected:* draw `<empty>` at col 1.
- **HR-52** — Disabled hotkey glyph drawn in the bright shortcut color (`controls/button.ts:103-104,155`;
  `cluster.ts:88,98-101`); TV uses the disabled color for both bytes (`tbutton.cpp:107-108`,
  `tcluster.cpp:95`). *Test:* a disabled Button/Cluster row; assert the `~hot~` run uses the disabled role.
  *Expected:* disabled hot runs render in the disabled color.
- **HR-53** — List scrollbar page step off by one (`list/list-rows.ts:154` passes `rows`; TV single-column
  `pgStep = size.y - 1`, `tlstview.cpp:48-52`). *Test/Expected:* bar page step = `size.y - 1`.
- **HR-54** — "Double-click" substitute fires on any later second click on the same cell
  (`input.ts:81,452-460`, `lastDownX` never reset by edits/time). *Test:* click cell 5, type, click cell 5;
  assert no select-all. *Expected:* the double-click window resets on edits and on a time/other-cell change.
- **HR-55** — Docs claim leading mask literals auto-appear; they don't (`input.ts:387-388`,
  `input-clipboard.ts:50-55`, plan PA-17) *(reproduced: `picture('(###)###-####').isValidInput('1') ===
  false`)*. Code is TV-faithful (autoFill appends **trailing** literals only); the **docs** overpromise.
  *Expected:* correct the JSDoc/PA wording (no behavior change).
- **HR-56** — Button clickable zone includes column 0 (`button.ts:197-200`, `local.x >= 0`); TV excludes the
  left column (`tbutton.cpp:177-180`, `clickRect.a.x++`). *Test/Expected:* clicks at `local.x === 0` don't
  activate.
- **HR-57** — `Text` collapses whitespace runs (`controls/text.ts:29` tokenizes `/\S+/g`, rejoins single
  spaces); TV draws text verbatim between breaks (`tstatict.cpp:44-105`). *Test:* `"a  b"` renders `"a  b"`.
  *Expected:* preserve internal whitespace/indentation.
- **HR-58** — Keystroke rejected when the *filled* length exceeds `maxLength` (`input-clipboard.ts:73`
  returns null); TV clamps at `maxLen` and accepts (`tinputli.cpp:282-288`). *Test/Expected:* clamp to
  `maxLength` rather than reject.
- **HR-59** — External value writes don't clamp selection state (`input.ts:111-117` clamps `curPos` only).
  *Test:* write a shorter value while a selection points past it; assert `selStart/selEnd/anchor` clamp.
  *Expected:* external writes clamp the full selection state.
- **HR-60** — `MultiCheckGroup.press` with a negative bound state goes more negative
  (`multi-check-group.ts:60`, JS `%` keeps sign). *Test:* press with state `-3`; assert it normalizes.
  *Expected:* use a floored modulo so the state is always in range.
- **HR-61** — Scroller corner cell (both-bars mode) shows content (`scroll/scroller.ts:135-137`). *Test:* a
  scroller with both bars; assert the SE corner cell is blanked/bar-colored, not content. *Expected:* reserve
  the corner cell.
- **HR-62** — Click below the last list row is ignored (`list-rows.ts:200` guards `newItem < length`); TV
  clamps (`tlstview.cpp:185-195`). *Test/Expected:* a click in blank space focuses the last item.

### Won't Have (Out of Scope) — and Deferred (tracked)

These are **not** defects — they are absent features (TV parity items) surfaced by the same audit, or
deliberate design choices. They are recorded so they are not mistaken for regressions and are tracked for a
future control/host RD, not fixed here:

| Item | Where | Target |
|------|-------|--------|
| `Input` insert/overwrite mode + `Ins` toggle (`sfCursorIns`) | `tinputli.cpp:415-426` | **DEF-20** (already deferred, RD-07) |
| `Input` Ctrl+Y clear-line (`kbCtrlY`) | `tinputli.cpp:448-452` | unassigned (control-completion tail) |
| App-initiated OSC-52 clipboard **read** | — | **DEF-25** (already deferred, RD-07) |
| Command drain-loop runaway guard (no shipped component re-emits; guard-by-design) | `event-loop.ts` | unassigned (defensible as-is) |
| Grapheme-cluster caret stepping | — | **DEF-21** (already deferred) |

> The audit **confirmed the deferred register is accurate** — every `DEFERRED.md` "SHIPPED" row
> (DEF-01/02/03/16/19/23) maps to real code+tests, and every still-deferred row is genuinely deferred, none
> half-built. RD-13 adds no new deferrals beyond the tracked tails above.

---

## Technical Requirements

- **No new features, no new subsystems.** RD-13 edits existing files in place across `@jsvision/core`
  (`input/`, `render/`, `safety/`, `capability/`, `host/`) and `@jsvision/ui` (`reactive/`, `layout/`,
  `view/`, `event/`, `desktop/`, `window/`, `menu/`, `controls/`, `scroll/`, `list/`, `dialog/`).
- **Additive-only public surface.** The only public-API changes are **additions** (missing exports HR-23:
  `KEY_NAMES`/`PasteState`) and **bug-for-bug corrections** that make behavior match the documented/TV
  contract. No signature is reshaped. Where a core `Theme`/capability default changes (HR-07 glyph defaults),
  it is an additive/permissive change logged in `CHANGELOG.md` (closes the audit's API-governance note).
- **TV-fidelity gate (NON-NEGOTIABLE).** Every fix tagged *TV-fidelity* (HR-09, HR-43…HR-62 fidelity items)
  carries a GATE-1 decode (cite the exact `source/tvision/*.cpp:line`) in the plan spec and a GATE-2
  before/after diff in the commit; the C++ outranks any current spec oracle, so a fidelity fix that
  contradicts an existing `*.spec.test.ts` **corrects the oracle** (cite the `.cpp`).
- **Spec-first, regression-locked.** Each HR-NN gets a spec test encoding its "how to test / expected result"
  as an immutable oracle (RED before the fix, GREEN after), then impl tests for edges. The critical trio
  (HR-01/02/03) additionally get a fuzz/property test (decoder totality; hit-test offset invariance;
  dispose-finality).
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`yarn check:deps` holds); files ≤ 500 lines;
  `yarn verify` + `yarn gate` green at the end of every phase.

---

## Integration Points

- **Core input decoder (HR-01/04/16/22/24):** hardens the byte→event boundary the whole stack sits on; the
  host's stdin handler stops being a crash surface.
- **Core render/serialize (HR-05/17/18/19/20/21/25):** the cell-grid + damage-diff boundary; fixes here make
  every UI frame column-correct and injection-safe.
- **Reactive core (HR-03/13/27/28/29/32):** disposal/flush correctness underpins every widget's lifecycle;
  HR-03/HR-13 remove real leaks in the documented `Show`/`For`/`addDynamic` pattern.
- **View/render root (HR-12/30/31/33/34):** invalidation + partial-recompose correctness; HR-12 unblocks
  `onMount`-time structural changes.
- **Event loop + app shell (HR-02/08/10/11/14/35…42):** focus/modality/gesture integrity; HR-02 fixes mouse
  in every modal, HR-08 wires the shipped Close command.
- **Controls/containers (HR-43…62):** `Input` editor correctness + TV-fidelity across ScrollBar/List/Button/
  Cluster/Text.
- **Governance:** CHANGELOG gains the previously-unlogged core `Theme` additions (RD-06/RD-10/RD-11) +
  RD-13's changes; techdocs/CI ui-coverage gaps noted for a follow-up (not blocking).

---

## Security Considerations

RD-13 is largely a **security-hardening** pass at the two untrusted-input boundaries:

- **stdin is untrusted (HR-01/04/05/16/24).** The decoder must be **total** — no byte sequence may throw,
  and no reply/escape may leak as a keystroke. HR-01 closes a trivial remote-crash (DoS) from any TTY writer;
  HR-04 closes a reply-injection channel; HR-05 stops raw control bytes reaching the ANSI stream.
- **Output boundary (HR-05/21).** No raw control byte may enter a cell or the serialized stream (HR-05); the
  clipboard OSC payload must be exactly the app's bytes, base64-framed (HR-21) — no silent mutation, no
  breakout.
- **Screen-safety (HR-06).** The logger must never write onto the UI device; the guard becomes device-identity
  based, not fd-number based.
- **Bounded parsing (unchanged).** The `picture` mask parser's bounds-safety audited clean and is preserved;
  HR-45/HR-47 fix its caret/validation correctness, not its bounds.

All fixes keep the allowlist posture: validate/normalize at the entry point, drop what doesn't parse, never
throw on hostile input.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test encodes; the "how to test / expected result" under each HR-NN is
the concrete recipe. Grouped by tier.

- **AC-1 (Critical trio).** HR-01 (decoder totality: hostile/overlong/surrogate UTF-8 never throws, emits no
  keys), HR-02 (modal hit-testing is offset-correct at any ancestor depth), and HR-03 (disposal is final: no
  computation runs after its owner is disposed; no resurrection) each have a passing spec + a
  fuzz/property/regression oracle; all three reproduce RED before the fix.
- **AC-2 (Core input/render/safety majors).** HR-04 (DCS chunk-split → `incomplete`, zero key leak), HR-05
  (`\t`/`\n`/C0 never enter a cell or the stream), HR-06 (logger blocked from the UI device), HR-07
  (UTF-8 locale ⇒ `boxDrawing`+`halfBlocks`; one demo drops its override and its golden frame keeps box
  chars) each pass a spec oracle.
- **AC-3 (Reactive/view lifecycle majors).** HR-10 (no key to a removed focused child), HR-11 (`isFocusable`
  false when detached; `focusView` on a detached target is a no-op), HR-12 (`onMount`-time `group.add`
  becomes visible without an unrelated relayout), HR-13 (`addDynamic(For/Show)` stops reconciling after
  unmount — no leaked scopes), HR-14 (no stale-gesture teleport after capture loss) each pass a spec oracle.
- **AC-4 (App-shell majors + TV fidelity).** HR-08 (`Commands.close` closes the active window; tvision-demo
  F3 works), HR-09 (inactive-window close/zoom/grip zones select-only on first click, matching
  `tframe.cpp` `sfActive` gating — GATE-2 diff recorded) each pass a spec oracle.
- **AC-5 (Minor batch — core).** HR-15…HR-26 each have a targeted spec/impl oracle and pass; HR-19 is
  table-driven against Unicode EAW; HR-21/HR-05 assert no raw controls in output.
- **AC-6 (Minor batch — reactive/view).** HR-27…HR-34 each pass a targeted oracle (throwing-computed
  re-evaluable, compute-cycle detected, batch error not masked, `View.onCleanup` once-per-unmount, absolute
  children excluded from `naturalSize`, shadow-aware partial recompose).
- **AC-7 (Minor batch — event/shell).** HR-35…HR-42 each pass a targeted oracle (menu never stuck, catcher
  tracks resize, `modalHost` cleared, focus evicted on disable, second-menu-title one click, zoom
  re-maximizes on resize, no delivery to unmounted views).
- **AC-8 (Minor batch — controls/containers, TV fidelity).** HR-43…HR-62 each pass a spec oracle with a
  GATE-1 decode + GATE-2 diff cited against the corresponding `t*.cpp`; where a fix contradicts a current
  spec oracle, the oracle is corrected against the C++ (fidelity exception) with the `.cpp` cited.
- **AC-9 (No regressions / gate).** After every phase, `yarn verify`, `yarn test:e2e`, `yarn check:deps`,
  `yarn lint`, and `yarn gate` are green; every touched file stays ≤ 500 lines with full JSDoc; the
  previously-unlogged core `Theme` additions + RD-13's changes are recorded in `CHANGELOG.md`.
- **AC-10 (Kitchen-sink intact).** The headless smoke test stays green; any demo that dropped a manual glyph
  override (HR-07) still renders faithfully.

---

> **Next step:** run the make_plan skill on RD-13 to produce the implementation plan. Sequence the **critical
> trio first** (HR-01/02/03 — each a small, localized fix with a fuzz/regression oracle), then the core
> input/render/safety majors, the reactive/view/shell lifecycle majors, and finally the fidelity/controls
> minor batches (each behind a GATE-1/GATE-2 TV decode). Spec-first per HR-NN: encode the "how to test /
> expected result" as a RED oracle, fix, GREEN, add impl/edge tests, re-diff fidelity items against the
> `t*.cpp`, then verify + gate.
