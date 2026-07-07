/**
 * A column of mutually-exclusive radio buttons (`( )` / `(•)`), where exactly one item is selected.
 * Bound two-way to a `Signal<number>` holding the selected index. `↑`/`↓` move *and* select (moving
 * the highlight picks that option); `Space`, a click, or `Alt`+a label's hotkey also select. Mark a
 * hotkey letter with tildes, e.g. `'~L~eft'`.
 */
import { Cluster } from './cluster.js';
import type { ClusterBox } from './cluster.js';
import type { Signal } from '../reactive/index.js';

/**
 * A radio-button group bound to a `number` signal (the selected index).
 *
 * @example
 * import { Group, RadioGroup, signal } from '@jsvision/ui';
 *
 * const align = signal(0); // 0 = Left
 * const group = new RadioGroup(['~L~eft', '~C~enter', '~R~ight'], align);
 * group.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 20, height: 3 } };
 *
 * const panel = new Group();
 * panel.add(group);
 * // Pressing ↓ moves the selection: align() becomes 1 (Center), then 2 (Right).
 */
export class RadioGroup extends Cluster {
  /** The selected item index; the two-way source of truth. */
  protected readonly value: Signal<number>;

  /**
   * @param labels One label per item (each may mark its hotkey with `~X~`).
   * @param value  A `Signal<number>` — the selected index.
   */
  constructor(labels: readonly string[], value: Signal<number>) {
    super(labels);
    this.value = value;
    this.sel = value(); // start the highlight on the currently-selected item
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
