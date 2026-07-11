# 07 — Testing Strategy

> Owning doc for test cases. Specification tests (ST-*) are immutable oracles derived from the
> requirements (01) + decisions (register), never from imagined implementation. Ordering per phase:
> spec tests → red → implement → green → impl tests → verify.

## A. New specification oracles (ST-01…ST-10)

All new status-line specs live in a new `packages/ui/test/status-bar.spec.test.ts`; new menu specs in
`packages/ui/test/menu-flex.spec.test.ts`. Each drives a real composed `createApplication` (no mocks),
with a hidden post-process `CommandSpy` recording emitted commands, exactly like the existing status
oracle. Pixel assertions read `app.loop.renderRoot.buffer().get(x, y)`.

### Status line

| ST | Scenario | Input → Expected |
|----|----------|------------------|
| **ST-01** | `spacer()` right-aligns | `statusLine([statusItem('~H~elp','help'), spacer(), statusItem('~Q~uit','quit')])`, viewport width W. → "Help" packs at columns 0–5 (` Help `); "Quit" is flush right: its ` Quit ` span ends at column W−1 (last text cell at W−2). The gap between them is empty (`statusBar` bg). |
| **ST-02** | fixed spacer gap | `[itemA, spacer({fixed:3}), itemB]`. → exactly 3 empty cells between A's right edge and B's left edge; B starts at A.end+3. |
| **ST-03** | embedded ProgressBar paints + repaints | `[exit, spacer(), bar]` with `bar = new ProgressBar({value})`, `value=signal(0.5)`, bar width 10. → the bar's fill glyphs render at its laid-out columns; after `value.set(1.0)` + a tick, the last bar cell is full (`█`) with **no manual redraw**. |
| **ST-04** | accessor text repaints | `statusItem(() => label())`, `label=signal('AA')`. → renders "AA"; after `label.set('BBBB')` the item shows "BBBB" (its span widens) with no manual redraw. |
| **ST-05** | command-less item is passive | `statusItem('~X~ Info')` (no command). → a press+release over it emits nothing; the accelerator sweep ignores it (pressing any letter emits nothing for it). |
| **ST-06** | packaging parity (guards the immutable oracle) | `const e: StatusItem = statusItem('~Q~uit', Commands.quit); e.command === 'quit'`; `statusItem(() => 'x')` compiles; `statusLine([]) instanceof StatusLine`. |
| **ST-07** | widget doesn't break drag-retarget | `[itemFile('file'), progressBar, itemEdit('edit')]`. → press "File", drag across the bar onto "Edit", release over "Edit" ⇒ emits `edit` (the progress bar between them is skipped, not a target). |

### Menu bar

| ST | Scenario | Input → Expected |
|----|----------|------------------|
| **ST-08** | `menuSpacer()` right-aligns titles + default unchanged | `menuBar([subMenu('~F~ile',…), menuSpacer(), subMenu('~H~elp',…)])`, width W. → "File" at the classic left column (x=1); "Help" flush right (its ` Help ` button ends at W−1). And **without** the spacer, `layoutTitles` output is byte-identical to the current left-pack (regression assert in the same test). |
| **ST-09** | popup anchors under the moved title | With the ST-08 bar: F10→→ (to Help) / a click on Help's moved column / Alt+H each open the **Help** popup, and its level-0 popup's left edge is one column left of Help's flex-computed x (not the old left-pack x). |
| **ST-10** | `titleIndexAt` maps flex titles; gap → null | With the ST-08 bar + width W: `titleIndexAt(items, helpX, W)` returns Help's index; `titleIndexAt(items, midGapX, W)` returns `null`. |

## B. Preserved oracles (regression — must pass UNMODIFIED)

These are **not** edited; they are the safety net proving the refactor is behavior-preserving.

- `app-shell.status.spec.test.ts` — ST-19, RD-10 ST-01, RD-10 ST-02/03 (pixel columns, press
  highlight, drag-retarget, emit-on-release, disabled non-activatable).
- `app-shell.menu.spec.test.ts` — ST-16, ST-17, ST-18.
- `app-shell.menu.impl.test.ts` — `layoutTitles + titleIndexAt` default, right-edge popup clamp, TV
  popup width/box/shadow/right-aligned key.
- `app-shell.packaging.spec.test.ts` — the `statusItem`/`statusLine`/`menuBar` structural block
  (the ST-06 driver above additionally guards it).
- `app-shell.lifecycle/desktop/window/seams` suites — unaffected (app-shell integration is a layout
  merge only).

> If any preserved **spec** oracle fails after implementation, the code is wrong — fix the code
> (spec-first). Only **impl** tests that asserted a now-relocated internal (e.g. an `itemBoxes`
> internal) may be updated to the new internals.

## C. Impl tests (internals & edges)

- `pack-row.impl.test.ts` — `packRow`: empty, all-fixed (== left-pack), one flex (fill), multi-flex
  (largest-remainder integer split, exact sum), fixed-overflow (flex→0, fixed keeps width), non-zero
  `startX` (menu `TITLE_MARGIN`).
- `status-bar.impl.test.ts` — `StatusItemView.measure()` width (static + accessor), pressed/enabled
  style matrix, command-less skip in `itemAt`, accelerator sweep skipping passive/command-less.
- `menu-flex.impl.test.ts` — `menuSpacer` skipped by `menuItemHotkey`/`menuItemLabel`/`titleOf`;
  width-aware `layoutTitles` with 0/1/2 spacers; controller `openTop` anchor x with a right-aligned
  title.

## D. Kitchen-sink smoke (AR-15)

`kitchen-sink.smoke.spec.test.ts` picks up the new `app-shell/status-bar` story automatically (mounts
headlessly, paints, unique id, required metadata).

## E. Verify

`yarn verify` — lint + typecheck + build + unit tests + `check:docs` (JSDoc governance) across
packages. Green is the done-criterion (AR-17).
