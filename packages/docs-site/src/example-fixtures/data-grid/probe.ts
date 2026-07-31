import { View } from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';

/** Values that a live Data Grid laboratory can expose to its visible readout and contract runner. */
export type DataGridLabProbeValue = string | number | boolean;

/**
 * Non-painting laboratory controller that exposes target state and handles documented shortcuts.
 *
 * The controller is part of the docs fixture rather than production grid API. Its values are updated
 * from real public grid/source operations, letting the visible readout and headless documentation
 * contract observe the same state without reaching into package internals.
 */
export class DataGridLabProbe extends View {
  override preProcess = true;
  override focusable = false;
  private readonly values = new Map<string, DataGridLabProbeValue>();
  private readonly readers = new Map<string, () => DataGridLabProbeValue>();
  private readonly handleInput: (event: DispatchEvent['event']) => boolean;

  /**
   * @param initial Initial observable target state.
   * @param handleInput Scenario input adapter; returns true only when it consumed the event.
   */
  constructor(
    initial: Readonly<Record<string, DataGridLabProbeValue>>,
    handleInput: (event: DispatchEvent['event']) => boolean,
  ) {
    super();
    for (const [name, value] of Object.entries(initial)) this.values.set(name, value);
    this.handleInput = handleInput;
  }

  /** Read one named target-owned value. */
  read(name: string): DataGridLabProbeValue | undefined {
    return this.readers.get(name)?.() ?? this.values.get(name);
  }

  /** Publish one value after the associated public target operation completes. */
  set(name: string, value: DataGridLabProbeValue): void {
    this.values.set(name, value);
    this.invalidate();
  }

  /** Bind a value directly to a public target getter. */
  bindProbe(name: string, read: () => DataGridLabProbeValue): void {
    this.readers.set(name, read);
  }

  /** Intercept only the documented scenario shortcuts before menus or focused editors consume them. */
  override onEvent(event: DispatchEvent): void {
    if (this.handleInput(event.event)) event.handled = true;
  }

  /** The controller is intentionally invisible; visible evidence is rendered by sibling Text views. */
  override draw(_context: DrawContext): void {}
}
