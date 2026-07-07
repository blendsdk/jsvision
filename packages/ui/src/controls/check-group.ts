/**
 * A column of independent checkboxes (`[ ]` / `[X]`), where any number of items can be checked at
 * once. Bound two-way to a `Signal<boolean[]>` — one flag per item, in the same order as the labels.
 * `Space` or a click toggles the focused/clicked item; `↑`/`↓` move between items; `Alt`+a label's
 * hotkey toggles that item. Mark a hotkey letter with tildes, e.g. `'~B~old'`.
 */
import { Cluster } from './cluster.js';
import type { ClusterBox } from './cluster.js';
import type { Signal } from '../reactive/index.js';

/**
 * A checkbox group bound to a `boolean[]` signal.
 *
 * @example
 * import { Group, CheckGroup, signal } from '@jsvision/ui';
 *
 * // One flag per label; the array reflects (and is updated by) the group.
 * const styles = signal([true, false]); // Bold on, Italic off
 * const group = new CheckGroup(['~B~old', '~I~talic'], styles);
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
   * @param labels One label per item (each may mark its hotkey with `~X~`).
   * @param value  A `Signal<boolean[]>` — one flag per item, in label order.
   */
  constructor(labels: readonly string[], value: Signal<boolean[]>) {
    super(labels);
    this.value = value;
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
