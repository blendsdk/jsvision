import { View } from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';

/** Primitive state exposed to the visible lesson rail and specification runner. */
export type CodeEditorLabProbeValue = string | number | boolean;

/**
 * Non-painting controller that exposes public editor state and handles lesson accelerators.
 */
export class CodeEditorLabProbe extends View {
  override preProcess = true;
  override focusable = false;
  protected readonly values = new Map<string, CodeEditorLabProbeValue>();
  protected readonly readers = new Map<string, () => CodeEditorLabProbeValue>();
  protected readonly runCheck: () => void;
  protected readonly resetLesson: (() => void) | undefined;

  /**
   * @param initial Initial observable state.
   * @param runCheck Focused scenario operation driven by the visible action control.
   * @param resetLesson Optional reset operation used by the shared non-pilot lesson shell.
   */
  constructor(
    initial: Readonly<Record<string, CodeEditorLabProbeValue>>,
    runCheck: () => void,
    resetLesson?: () => void,
  ) {
    super();
    for (const [name, value] of Object.entries(initial)) this.values.set(name, value);
    this.runCheck = runCheck;
    this.resetLesson = resetLesson;
  }

  /** Read one named target-owned value. */
  read(name: string): CodeEditorLabProbeValue | undefined {
    return this.readers.get(name)?.() ?? this.values.get(name);
  }

  /** Publish one value after its public operation completes. */
  set(name: string, value: CodeEditorLabProbeValue): void {
    this.values.set(name, value);
    this.invalidate();
  }

  /** Bind a value directly to a public target getter. */
  bindProbe(name: string, read: () => CodeEditorLabProbeValue): void {
    this.readers.set(name, read);
  }

  /** Intercept shared action and reset accelerators before shell menus consume them. */
  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && event.event.alt && event.event.key.toLowerCase() === 'r') {
      this.runCheck();
      event.handled = true;
      return;
    }
    if (
      event.event.type === 'key' &&
      event.event.alt &&
      event.event.key.toLowerCase() === 'c' &&
      this.resetLesson !== undefined
    ) {
      this.resetLesson();
      event.handled = true;
    }
  }

  /** The probe is intentionally invisible; sibling Text views render its state. */
  override draw(_context: DrawContext): void {}
}
