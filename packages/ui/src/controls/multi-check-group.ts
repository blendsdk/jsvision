/**
 * `MultiCheckGroup` — a column of multi-state checkboxes (Turbo Vision `TMultiCheckBoxes`, RD-07
 * AC-9/AC-10, PA-10). Extends the internal {@link Cluster} base. The `.js` extension in import
 * specifiers is required by NodeNext ESM resolution.
 *
 * ## GATE-1 decode (`tmulchkb.cpp`, `tcluster.cpp`)
 * - **Draw** (`tmulchkb.cpp:65-68`): `drawMultiBox(" [ ] ", states)` — the 5-cell `" [ ] "` icon, the
 *   marker `states[multiMark(item)]` at **col+2** (box centre), the label at **col+5**
 *   (`tcluster.cpp:110-116`). Colours: normal `getColor(0x0301)` → `clusterNormal`; selected
 *   `getColor(0x0402)` → `clusterSelected`; disabled `getColor(0x0505)` → `clusterDisabled`
 *   (`tcluster.cpp:39,93-105`). Nav (↑↓/Space/click/hotkey/disabled-skip) is inherited from `Cluster`.
 * - **Press** (`tmulchkb.cpp:88-103`): `curState++; if (curState >= selRange) curState = 0;` — cycle
 *   `(state+1) % selRange`.
 * - **Binding** (PA-10, idiomatic — not TV's packed `uint32`): `{ items, states, value: Signal<number[]> }`;
 *   `selRange = states.length`; each item's state index is `value()[i]`, drawn as `states[value()[i]]`.
 */
import { Cluster } from './cluster.js';
import type { ClusterBox } from './cluster.js';
import type { Signal } from '../reactive/index.js';

/** Construction options for {@link MultiCheckGroup} (PA-10). */
export interface MultiCheckGroupOptions {
  /** One label per item; each may mark its hotkey with `~X~` (Cluster). */
  readonly items: readonly string[];
  /** The ordered marker glyphs, one per state (e.g. `' xX'`); `selRange = states.length`. */
  readonly states: string;
  /** Two-way binding: one state index (`0..states.length-1`) per item. */
  readonly value: Signal<number[]>;
}

/** A column of multi-state checkboxes bound to a `Signal<number[]>` (one state index per item). */
export class MultiCheckGroup extends Cluster {
  /** The ordered marker glyphs; `markers[value()[i]]` is drawn at col 2. */
  protected readonly states: string;
  /** The number of states (`states.length`); `press` cycles `(state+1) % selRange`. */
  protected readonly selRange: number;
  /** One state index per item; the source of truth (two-way). */
  protected readonly value: Signal<number[]>;

  /**
   * @param opts `{ items, states, value }` — see {@link MultiCheckGroupOptions}.
   */
  constructor(opts: MultiCheckGroupOptions) {
    super(opts.items);
    this.states = opts.states;
    this.selRange = [...opts.states].length;
    this.value = opts.value;
    this.onMount(() => this.bind(() => this.value())); // repaint when the bound array changes
  }

  protected override markIndex(i: number): number {
    const s = this.value()[i] ?? 0;
    return s >= 0 && s < this.selRange ? s : 0; // clamp to a valid state (PA-10)
  }

  protected override press(i: number): void {
    // Cycle (state+1) % selRange, writing a full-length array so a short bound value is normalized.
    // HR-60: use a FLOORED modulo — JS `%` keeps the sign, so a negative externally-bound state would
    // cycle further negative; `((n % m) + m) % m` normalizes any state back into `[0, selRange)`.
    const cur = this.value();
    const next = this.rawLabels.map((_, idx) => cur[idx] ?? 0);
    const m = this.selRange;
    next[i] = (((next[i] + 1) % m) + m) % m;
    this.value.set(next);
  }

  protected override box(): ClusterBox {
    return { icon: ' [ ] ', markers: this.states };
  }
}
