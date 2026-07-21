/**
 * A column of mutually-exclusive radio buttons (`( )` / `(•)`), where exactly one item is selected.
 * Bound two-way to a `Signal<number>` holding the selected index. `↑`/`↓` move *and* select (moving
 * the highlight picks that option); `Space`, a click, or `Alt`+a label's hotkey also select. Mark a
 * hotkey letter with tildes, e.g. `'~L~eft'`.
 */
import { Cluster } from './cluster.js';
import type { ClusterBox } from './cluster.js';
import type { Signal } from '../reactive/index.js';

/** Options for a {@link RadioGroup}. */
export interface RadioGroupOptions {
  /** One label per option; each may mark its hotkey letter with `~X~` (e.g. `'~L~eft'`). */
  readonly labels: readonly string[];
  /** Two-way binding to the selected option index. */
  readonly value: Signal<number>;
}

/**
 * A radio-button group bound to a `number` signal (the selected index).
 *
 * @example
 * import { Group, RadioGroup, signal, at } from '@jsvision/ui';
 *
 * const align = signal(0); // 0 = Left
 * const group = at(new RadioGroup({ labels: ['~L~eft', '~C~enter', '~R~ight'], value: align }), 1, 0, 20, 3);
 *
 * const panel = new Group();
 * panel.add(group);
 * // Pressing ↓ moves the selection: align() becomes 1 (Center), then 2 (Right).
 */
export class RadioGroup extends Cluster {
  /** The selected item index; the two-way source of truth. */
  protected readonly value: Signal<number>;

  /**
   * @param opts The `labels` (one per option, each optionally marking a `~X~` hotkey) and the
   *             two-way `value` signal holding the selected index.
   */
  constructor(opts: RadioGroupOptions) {
    super(opts.labels);
    this.value = opts.value;
    this.sel = opts.value(); // start the highlight on the currently-selected item
    // Repaint when the bound index changes. Bind on mount, when this view's reactive scope exists.
    this.onMount(() => this.bind(() => this.value()));
  }

  protected override markIndex(i: number): number {
    return this.value() === i ? 1 : 0; // 0 = off (space), 1 = on (•)
  }

  protected override press(i: number): void {
    this.value.set(i);
  }

  protected override movedTo(i: number): void {
    this.value.set(i); // a radio group selects the option the highlight lands on
  }

  protected override box(): ClusterBox {
    return { icon: ' ( ) ', markers: ' \u2022' }; // •
  }
}
