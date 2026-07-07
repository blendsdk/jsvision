/**
 * A column of multi-state checkboxes: like {@link CheckGroup}, but each item cycles through more than
 * two states instead of just on/off. You supply the ordered marker glyphs (e.g. `' xX'` for
 * off / partly / fully), and pressing an item advances it to the next state, wrapping around at the
 * end. Bound two-way to a `Signal<number[]>` holding one state index per item.
 */
import { Cluster } from './cluster.js';
import type { ClusterBox } from './cluster.js';
import type { Signal } from '../reactive/index.js';

/** Options for {@link MultiCheckGroup}. */
export interface MultiCheckGroupOptions {
  /** One label per item; each may mark its hotkey with `~X~`. */
  readonly items: readonly string[];
  /** The ordered marker glyphs, one per state (e.g. `' xX'`). The number of states is this string's length. */
  readonly states: string;
  /** Two-way binding: one state index (`0`..states-1) per item, in item order. */
  readonly value: Signal<number[]>;
}

/**
 * A multi-state checkbox group bound to a `number[]` signal (one state index per item).
 *
 * @example
 * import { Group, MultiCheckGroup, signal } from '@jsvision/ui';
 *
 * // Three states per item: ' ' (off), 'x' (some), 'X' (all).
 * const levels = signal([0, 2]); // Volume off, Treble full
 * const group = new MultiCheckGroup({
 *   items: ['~V~olume', '~T~reble'],
 *   states: ' xX',
 *   value: levels,
 * });
 * group.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 20, height: 2 } };
 *
 * const panel = new Group();
 * panel.add(group);
 * // Pressing Space on Volume cycles it 0 -> 1 -> 2 -> 0.
 */
export class MultiCheckGroup extends Cluster {
  /** The ordered marker glyphs; `states[value()[i]]` is drawn for item `i`. */
  protected readonly states: string;
  /** The number of states; pressing an item advances by one and wraps at this count. */
  protected readonly selRange: number;
  /** One state index per item; the two-way source of truth. */
  protected readonly value: Signal<number[]>;

  /**
   * @param opts `{ items, states, value }` — see {@link MultiCheckGroupOptions}.
   */
  constructor(opts: MultiCheckGroupOptions) {
    super(opts.items);
    this.states = opts.states;
    this.selRange = [...opts.states].length;
    this.value = opts.value;
    // Repaint when the bound array changes. Bind on mount, when this view's reactive scope exists.
    this.onMount(() => this.bind(() => this.value()));
  }

  protected override markIndex(i: number): number {
    const s = this.value()[i] ?? 0;
    return s >= 0 && s < this.selRange ? s : 0; // clamp an out-of-range state to the first one
  }

  protected override press(i: number): void {
    // Advance to the next state, wrapping at the end, and write back a full-length array so a bound
    // value shorter than the label list is normalized. A floored modulo is used deliberately: JS `%`
    // keeps the sign, so a negative externally-bound state would otherwise cycle further negative.
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
