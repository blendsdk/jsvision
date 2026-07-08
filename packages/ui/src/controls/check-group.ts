/**
 * A column of independent checkboxes (`[ ]` / `[X]`), where any number of items can be checked at
 * once. Bound two-way to a `Signal<boolean[]>` — one flag per item, in the same order as the labels.
 * `Space` or a click toggles the focused/clicked item; `↑`/`↓` move between items; `Alt`+a label's
 * hotkey toggles that item. Mark a hotkey letter with tildes, e.g. `'~B~old'`.
 */
import { Cluster } from './cluster.js';
import type { ClusterBox } from './cluster.js';
import type { Signal } from '../reactive/index.js';

/** Options for a {@link CheckGroup}. */
export interface CheckGroupOptions {
  /** One label per checkbox; each may mark its hotkey letter with `~X~` (e.g. `'~B~old'`). */
  readonly labels: readonly string[];
  /** Two-way binding: one boolean flag per item, in label order. */
  readonly value: Signal<boolean[]>;
}

/**
 * A checkbox group bound to a `boolean[]` signal.
 *
 * @example
 * import { Group, CheckGroup, signal } from '@jsvision/ui';
 *
 * // One flag per label; the array reflects (and is updated by) the group.
 * const styles = signal([true, false]); // Bold on, Italic off
 * const group = new CheckGroup({ labels: ['~B~old', '~I~talic'], value: styles });
 * group.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 20, height: 2 } };
 *
 * const panel = new Group();
 * panel.add(group);
 * // styles() now tracks the checkbox states, e.g. after toggling Italic: [true, true]
 */
export class CheckGroup extends Cluster {
  /** One flag per item; the two-way source of truth. */
  protected readonly value: Signal<boolean[]>;

  /**
   * @param opts The `labels` (one per checkbox, each optionally marking a `~X~` hotkey) and the
   *             two-way `value` signal — one boolean flag per item, in label order.
   */
  constructor(opts: CheckGroupOptions) {
    super(opts.labels);
    this.value = opts.value;
    // Repaint when the bound array changes. Bind on mount, when this view's reactive scope exists.
    this.onMount(() => this.bind(() => this.value()));
  }

  protected override markIndex(i: number): number {
    return (this.value()[i] ?? false) ? 1 : 0; // 0 = off (space), 1 = on ('X'); a missing flag reads unchecked
  }

  protected override press(i: number): void {
    // Write back a full-length array, so a bound value shorter than the label list is normalized.
    const cur = this.value();
    const next = this.rawLabels.map((_, idx) => cur[idx] ?? false);
    next[i] = !next[i];
    this.value.set(next);
  }

  protected override box(): ClusterBox {
    return { icon: ' [ ] ', markers: ' X' }; // off / on
  }
}
