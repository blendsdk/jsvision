# 03-03 — MultiCheckGroup

> New `packages/ui/src/controls/multi-check-group.ts` (+ `src/index.ts` re-export). Extends the internal
> `Cluster` base. TV source: `TMultiCheckBoxes` (`tmulchkb.cpp`) + `TCluster::drawMultiBox` (`tcluster.cpp`).

## TV decode (GATE-1)

> Decoded 2026-07-01 from `/home/gevik/workdir/github/tvision/source/tvision/tmulchkb.cpp`, `tcluster.cpp`,
> `dialogs.h`.

### Multi-state model (TV — we modernize the binding, keep the visual)
- Ctor `TMultiCheckBoxes(bounds, strings, aSelRange, aFlags, aStates)` (`tmulchkb.cpp:20-28`): `selRange` =
  number of states; `flags` = bit-packing (`cfOneBit/cfTwoBits/...`, `dialogs.h:578-581`); `states` = marker
  string. Per-item state packed into a `uint32 value`.
- `multiMark(item)` (`:75-80`) unpacks the state index; `press(item)` (`:88-103`): `curState++; if
  (curState >= selRange) curState = 0;` then repacks — i.e. **cycle `(state+1) % selRange`**.

### Draw + geometry + color
- `draw()` (`tmulchkb.cpp:65-68`): `drawMultiBox(" [ ] ", states)` — the box is the **5-cell** `" [ ] "`.
- `drawMultiBox(icon, marker)` (`tcluster.cpp:87-129`): per item at `col`: `moveCStr(col, icon)` then
  **`putChar(col+2, marker[multiMark(cur)])`** (marker at the center of `[ ]`), label at **`col+5`**. Cursor
  `setCursor(column(sel)+2, row(sel))` (on the marker of the focused item — Input-only for us, PA-11).
- Colors (`tcluster.cpp:39` `cpCluster="\x10\x11\x12\x12\x1f"`, `dialogs.h:359-365`): normal `getColor(0x0301)`
  → slot 1 (`0x10`); selected/focused `getColor(0x0402)` → slot 2 (`0x11`); disabled `getColor(0x0505)` →
  slot 5 (`0x1f`); shortcut → slots 3/4 (`0x12`). These map to the existing RD-06 roles `clusterNormal`/
  `clusterSelected`/`clusterShortcut`/`clusterDisabled` — **confirm the mapping at GATE-1**; no new role.
- Nav (`tcluster.cpp:161-296`): ↑↓ move `sel` ±1 (wrap, skip disabled); Space/click `press`; `~hotkey~`;
  disabled skipped. **Already implemented by the TS `Cluster` base** — MultiCheckGroup inherits it.

## Spec (this implementation)

### API (PA-10 — idiomatic, not the packed bitfield)
```ts
export interface MultiCheckGroupOptions {
  items: readonly string[];        // labels, ~hotkey~ supported (Cluster)
  states: string;                  // marker per state, e.g. " xX" (selRange = states.length)
  value: Signal<number[]>;         // one state index (0..states.length-1) per item; two-way
}
export class MultiCheckGroup extends Cluster { /* ... */ }
```
- `selRange = states.length`. `press(i)` sets `value()[i] = (value()[i] + 1) % selRange` (immutable update
  → new array through the signal, matching AR-100). `markIndex(i)` returns `value()[i]` (the state index into
  `box().markers`); `box()` returns `{ icon: ' [ ] ', markers: states }`; the drawn marker is
  `markers[markIndex(i)]` = `states[value()[i]]` at the box center (col+2), label at col+5.
- Inherits ↑↓ / Space / click / hotkey / disabled-skip from `Cluster` unchanged (behavior seam is untouched).
- Uses the RD-06 `clusterNormal/clusterSelected/clusterShortcut/clusterDisabled` roles.

### Cluster base change (PF-001) — mandatory prerequisite
`MultiCheckGroup` **cannot** inherit today's `Cluster.draw()`: it hardcodes a boolean 2-state marker
(`cluster.ts:91` — `ctx.text(2, i, this.mark(i) ? on : off, base)`), so a multi-state `states[value[i]]`
glyph has no path to col 2. Rather than override `draw()` (which would duplicate the box/label/role/hotkey/
enabled loop — a DRY violation), **generalize the `Cluster` base to Turbo Vision's marker-string model**
(TV `drawMultiBox(icon, marker)` + `multiMark(item)`, `tcluster.cpp:87-129`) — the shape our TS base
collapsed. All three clusters then share one `draw()`:

```ts
// cluster.ts — the generalized seam (replaces mark(i):boolean + box().on/off)
export interface ClusterBox {
  readonly icon: string;      // 5-cell " [ ] " / " ( ) "
  readonly markers: string;   // ordered state glyphs, drawn at col 2, indexed by markIndex(i)
}
protected abstract markIndex(i: number): number;   // state index into box().markers (was: mark(i):boolean)
// draw(): ctx.text(2, i, box.markers[this.markIndex(i)] ?? ' ', base)
```

Migrate the two shipped RD-06 clusters to the new seam (behavior + rendered output **identical** — a pure
refactor):
- `CheckGroup`  → `box() = { icon: ' [ ] ', markers: ' X' }`,  `markIndex(i) = (value()[i] ?? false) ? 1 : 0`.
- `RadioGroup`  → `box() = { icon: ' ( ) ', markers: ' •' }`,  `markIndex(i) = value() === i ? 1 : 0`.
- `MultiCheckGroup` → `box() = { icon: ' [ ] ', markers: states }`,  `markIndex(i) = value()[i]`.

The existing `controls.cluster.*`/`controls.foundation.*` RD-06 specs + the check/radio goldens are the
regression net; they must stay green after the refactor (see 99 P4.7). No public API of `CheckGroup`/
`RadioGroup` changes (the seam is `protected`).

### Faithful visual (GATE-2 checks)
5-cell `" [ ] "`, marker at the middle cell, label at col+5, colors per the `cpCluster` mapping — diffed
cell-by-cell against `drawMultiBox` after implementation.

### Kitchen-sink story (NON-NEGOTIABLE)
`packages/examples/kitchen-sink/stories/multi-check-group.story.ts` (+ one line in `stories/index.ts`): a
live `MultiCheckGroup` (e.g. states `" ·X"` over 3 items) with a **bound-state echo** (`value()` shown) and
interaction hints; passes `kitchen-sink.smoke.spec` (mounts, paints, unique id, metadata).

## Security
No new input boundary beyond `Cluster` nav (bounded item indices); state indices are clamped to
`0..selRange-1` by the cycle. Draw via `DrawContext`+`sanitize` (AC-15 inherited).
