# Task T-05: Repaint when the last window on the desktop closes (fix #67; closes the #68 exemplar)

> **Type**: Task (lightweight) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.4.1
> **Progress**: 6/6 tasks (100%) · **Last Updated**: 2026-07-12 (change green on all relevant gates; committed)
> **Tracks**: GitHub issues [#67](https://github.com/blendsdk/jsvision/issues/67) (closed by this task) ·
> [#68](https://github.com/blendsdk/jsvision/issues/68) (this task fixes the *exemplar*; the broad
> systemic audit stays open as a follow-up — see "Scope" below).

## Objective

On a desktop with **no persistent window** (dialogs are the only windows), closing the sole window
does not repaint. The dialog closes internally on the first click, but the terminal keeps showing it
until the *next* input event happens to run a loop tick — the "click twice" symptom. The button fired
on the first click; the screen just did not refresh.

Land the one-line `Desktop.removeWindow` fix in the **SDK source** (`packages/ui/src/desktop/desktop.ts`)
so it survives a `yarn install` / reinstall, and guard it with an **`onFrame`-based** regression test
(assert the *painted* frame, not a manual `renderRoot.flush()`) so this class of bug can never pass
the suite green again.

**Root cause (verified @ 2026-07-12).** The loop paints a frame only at the end of a `runTick`:
`runTick` ends with `this.renderRoot.flush(); this.onFrame?.(this.renderRoot.buffer())`
(`packages/ui/src/event/event-loop.ts:375-376`), and the render root is built with a **no-op
`schedule`** (`event-loop.ts:193-195`) so it never self-repaints. `Desktop.removeWindow` repaints only
as a **side effect** of `focusInto` (which runs a tick), and only when another window remains
(`packages/ui/src/desktop/desktop.ts:147-155`):

```ts
this.active = windows.length > 0 ? windows[windows.length - 1] : null;
if (this.active !== null) {
  this.active.active.set(true);
  this.loop?.focusInto(this.active);   // incidental repaint via the tick
}
// else: nothing — no tick, no flush
```

When the closed window was the **only** window, `this.active` becomes `null`, that branch is skipped,
and nothing flushes. Dialogs are removed from an **async `finally`** — `runDialog`'s
`finally { host.desktop.removeWindow(dlg) }` (`packages/ui/src/dialog/message-box.ts:79`), and the same
`execView(...).finally(...)` pattern in app code — i.e. **outside any tick** — so the stale dialog
frame persists until the next input. Apps with a persistent main window never hit it, because the
underlying window catches the focus and the incidental tick repaints.

Confirmed the fix mechanism is safe on an emptied desktop: `loop.focusInto(this)` wraps
`focus.focusInto(desktop)` in `runTick` (`event-loop.ts:263-267`). On an empty desktop
`focus.focusInto` finds no focusable child (`children.find(canReceiveFocus)` → `null`,
`packages/ui/src/event/focus.ts:122-134`) and the `Desktop` is not itself focusable, so it is a **no-op
on focus state** — but the enclosing `runTick` still flushes one frame and calls `onFrame`, which is
exactly the repaint we need. No new loop seam is required.

## Scope (user-confirmed 2026-07-12)

- **IN** — the `removeWindow` else-branch fix + an `onFrame` regression test. This **fully closes #67**
  and closes the **exemplar** called out in #68.
- **OUT** — #68's *broad* systemic audit (enumerate/classify every public mutator + `invalidate`/
  `invalidateLayout` site as in-tick vs out-of-tick, fix each gap, and weigh systemic options A
  (coalesced `schedule`) / B (enforce "never mutate outside a tick") / C (per-site)). That is a
  larger, separate effort tracked by #68, which stays **open**.

## Design (user-confirmed 2026-07-12)

- **D1 — the fix.** Add an `else` branch to `removeWindow`'s `wasActive` block: when no window remains,
  call `this.loop?.focusInto(this)` so the emptied desktop runs a tick and repaints. This is the exact
  fix prescribed in #67/#68 and the minimal change — it reuses the sibling branch's mechanism (a tick
  via the existing `DesktopLoopSeam.focusInto`), rather than widening the seam with a bespoke
  `requestFlush`. (Rejected: adding a new flush-only seam — unnecessary surface for a one-line repaint;
  `focusInto(this)` already runs exactly one coalesced frame and, per the root-cause note, has no
  focus side effect on an empty desktop.)
- **D2 — test against the painted frame.** The regression test wires `app.loop.onFrame` and asserts the
  **last painted frame** — never `renderRoot.flush()`. The existing desktop suite calls
  `app.loop.renderRoot.flush()` manually (e.g. `packages/ui/test/app-shell.desktop.spec.test.ts:69,85,98`),
  which force-paints and thereby **masks** this whole bug class; a flush-based test would stay green
  against the broken code. `onFrame` fires only from a real tick, so it observes exactly what the
  terminal would show.
- **D3 — exercise the real async-teardown path.** The spec test replicates `runDialog`'s
  `execView(dlg).finally(() => desktop.removeWindow(dlg))` shape (`message-box.ts:79`) so the removal
  runs in an **async continuation outside any tick** — the actual trigger. The test `await`s the modal
  promise before asserting, so the `finally` teardown has run.
- **D4 — snapshot in the callback (footgun).** `onFrame` receives the **live** `renderRoot.buffer()`,
  which is mutated on the next flush. The test must serialize each frame to a string inside the
  `onFrame` callback (not hold the buffer reference), or later frames overwrite the captured one.
- **D5 — no kitchen-sink story.** This is a window-management repaint fix, not a visual component (the
  WM has no story); coverage is the spec/impl tests below.
- **D6 — verify command:** `yarn verify` (fast red/green loop: `yarn workspace @jsvision/ui test`).
- **D7 — issue disposition.** The PR/commit references **`closes #67`**. Post a comment on **#68**
  noting the exemplar is fixed + `onFrame`-tested and the broad audit remains open; do **not** close #68.

## The fix (exact)

`packages/ui/src/desktop/desktop.ts`, in `removeWindow` (currently lines 147-155):

```ts
if (wasActive) {
  w.active.set(false);
  const windows = this.windows();
  this.active = windows.length > 0 ? windows[windows.length - 1] : null;
  if (this.active !== null) {
    this.active.active.set(true);
    this.loop?.focusInto(this.active); // focus the newly active window's inner view
  } else {
    // No window remains: run a tick so the emptied desktop repaints. removeWindow can be called from
    // an async modal teardown (outside any loop tick), and the loop only flushes a frame at tick end;
    // without this the closed dialog's stale frame lingers until the next input event.
    this.loop?.focusInto(this);
  }
}
```

## Affected files (verified)

| File | Change |
|------|--------|
| `packages/ui/src/desktop/desktop.ts` | Add the `else { this.loop?.focusInto(this); }` branch to `removeWindow`'s `wasActive` block (D1), with a plain-language "why" comment (no plan/RD/ID references). |
| `packages/ui/test/desktop-removewindow-repaint.spec.test.ts` | **New** — ST-1, the `onFrame` integration repro (D2/D3/D4). |
| `packages/ui/test/desktop-removewindow-repaint.impl.test.ts` | **New** — ST-2 direct-`removeWindow` unit assert + the multi-window regression guard. |

## Specification test cases

- **ST-1 (spec, integration — the immutable oracle).** Bare-desktop `createApplication` (no persistent
  window), viewport e.g. 60×20. Wire `app.loop.onFrame` to snapshot each painted frame to text (D4).
  Add a `Dialog` carrying an `okButton` at a **known** absolute rect (so the OK cell is deterministic),
  run it via `app.loop.execView(dlg).finally(() => app.desktop.removeWindow(dlg))` (the `runDialog`
  shape, D3). `await` a microtask so the modal opens; **assert the snapshot shows the dialog** (its
  title/border glyphs present) — the precondition. Then dispatch a **single OK click** (`down`+`up` on
  the button cell), `await` the modal promise (runs the async `finally` → `removeWindow`), and
  **assert the latest `onFrame` snapshot no longer shows the dialog** — the previously-covered cells
  now read the desktop pattern (`defaultTheme.desktop.pattern`), and the dialog title/OK glyphs are
  gone. **No `renderRoot.flush()` anywhere in the test.**
  *Expected (pre-fix):* after `await`, the last painted frame still contains the dialog ⇒ **red**.
  *Expected (post-fix):* the last painted frame is the emptied desktop ⇒ **green**.
- **ST-2 (impl, unit — tightest guard on the fixed method).** Mount an app, `addWindow(w)` as the
  **only** window, wire `app.loop.onFrame` (count invocations + snapshot). Call
  `app.desktop.removeWindow(w)` **directly** (synchronously, no surrounding tick). Assert the paint
  count **incremented** and the new frame no longer shows the window.
  *Expected (pre-fix):* the direct call skips the `focusInto` branch ⇒ `onFrame` is **not** called ⇒
  the count is unchanged and the stale frame still shows the window ⇒ **red**. *Post-fix:* the `else`
  branch runs a tick ⇒ `onFrame` fires with the emptied frame ⇒ **green**.
- **ST-2b (impl, regression guard — the sibling branch still works).** Add two windows; `removeWindow`
  the active one. Assert `onFrame` still fires and the painted frame shows the remaining window
  (`activeWindow()` is now the other window). Proves the fix did not disturb the existing
  `this.active !== null` path. Passes both before and after the fix.

## Tasks

**Spec tests first (red):**

- [x] T-05.1 Write **ST-1** (`test/desktop-removewindow-repaint.spec.test.ts`) — the `onFrame`
      integration repro per the ST-1 case above. Model the harness on
      `app-shell.desktop.spec.test.ts` (`createApplication` + a 1-based `mouse()` helper) but wire
      `app.loop.onFrame` and **never** call `renderRoot.flush()`. Add a `frameText(buf)` helper that
      serializes the buffer glyphs to a searchable string. *(Implemented + runs 2026-07-12.)*
- [x] T-05.2 Ran ST-1 against the **unchanged** source; confirmed it **fails red** — after `await
      closed`, the last painted frame still shows the `CLOSEME` dialog + pressed OK button (the async
      `finally { removeWindow }` ran outside a tick, no repaint). *(2026-07-12.)*

**Implement (green):**

- [x] T-05.3 Applied the D1 fix to `removeWindow` in `packages/ui/src/desktop/desktop.ts` (the exact
      `else` branch, with a plain-language "why" comment — no plan/RD/ID references). *(2026-07-12.)*
- [x] T-05.4 Ran ST-1; **green** — a single OK click closes the dialog **and** repaints the emptied
      desktop in the same frame (the last `onFrame` frame no longer shows `CLOSEME`). *(2026-07-12.)*

**Impl tests + verify:**

- [x] T-05.5 Wrote **ST-2 + ST-2b** (`test/desktop-removewindow-repaint.impl.test.ts`). Both green
      post-fix; ST-2 confirmed **red** against the stashed pre-fix source (`expected +0 to be 1` — zero
      paints). *(2026-07-12; see Execution notes.)*
- [x] T-05.6 Verify — green on every gate relevant to this change: ui typecheck ✓, eslint ✓, prettier
      on the 3 touched files ✓, ui unit suite 1534/1535 (all 3 new tests green; the sole red is the
      pre-existing `version.spec`). Full `TUI_SKIP_PERF=1 yarn verify` stays red **only** on
      pre-existing v0.1.1 release debt (version-sync + CHANGELOG prettier + a flaky segfault) — **kept
      out of scope by user decision** (surgical PR); reported separately. **Issue disposition (D7):**
      committed (no push) with `closes #67` / `refs #68` in the message; the user reviews/pushes and
      posts the #68 comment (exemplar fixed + `onFrame`-tested, broad audit open). #68 stays open.

## Execution notes (2026-07-12)

- **`healFocus` reshaped ST-2.** The plan's original ST-2 ("direct `removeWindow` of a lone window,
  paint count increments") was based on an incomplete model: `Group.remove` fires `healFocus` — which
  runs a loop tick and repaints — **only when the removed child is the group's focus child**
  (`packages/ui/src/view/group.ts`). A directly-removed *focused* lone window therefore repaints
  incidentally (2 paints: heal + else-branch) even **without** the fix, so it could not go red. The
  bug is load-bearing only when the removed active window is **not** the desktop's focus child — the
  exact state a closed modal leaves (focus restored elsewhere), which is why ST-1 (a real dialog) is
  the faithful oracle. ST-2 was therefore refined to synthesize that precondition directly with a
  **non-focusable** sole window (active but never the focus child), isolating the else-branch — and it
  is genuinely red pre-fix (0 paints) / green post-fix (1 paint). Impl tests are not immutable
  oracles, so refining ST-2's mechanism to match the real code path is the correct move.
- **Assert by glyph, not title.** Narrow window chrome truncates titles (an 18-wide `Window('AAA')`
  renders `AA`), so the impl tests assert window presence/absence by frame-corner vs desktop-pattern
  glyphs at known cells, not by title substrings. (ST-1's 30-wide dialog shows `CLOSEME` in full, so
  its title-substring assertion stands.)
- **T-05.6 verify blocked by PRE-EXISTING release debt (not this change).** `TUI_SKIP_PERF=1 yarn
  verify` is red on the baseline, independent of this task (each reproduced on the stashed baseline):
  (1) `packages/ui/src/version.ts` `VERSION = '0.1.0'` ≠ `package.json` `0.1.1` → `ui/version.spec`
  fails; (2) the equivalent `@jsvision/web` version test fails the same way; (3) five `CHANGELOG.md`
  files (docs-site/examples/spike-data-studio/theme-designer/web) fail `prettier --check`; (4) a
  one-off `Segmentation fault` (exit 139) in the aggregate turbo run, after the ui suite finished
  clean (web/docs-site — native/xterm, likely flaky). **This change is green on every relevant gate:**
  ui typecheck ✓, eslint ✓, prettier on the 3 touched files ✓, ui unit suite 1534/1535 (only the
  pre-existing `version.spec` red), all three new tests green, ST-1 & ST-2 red-confirmed pre-fix.
  Awaiting a user decision on whether to also fix the release debt here.

## Verify

`TUI_SKIP_PERF=1 yarn verify` then `yarn lint`. (`TUI_SKIP_PERF=1` skips the off-CI frame-perf
assertion so it cannot flake the run; fast inner loop: `yarn workspace @jsvision/ui test`.)
