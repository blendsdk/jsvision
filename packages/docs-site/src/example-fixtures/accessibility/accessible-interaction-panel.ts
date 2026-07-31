import { Group, Text, at, signal } from '@jsvision/ui';

/** Input routes that converge on the laboratory's shared activation command. */
export type InteractionSource = 'hotkey' | 'focused-key' | 'mouse';

/**
 * Reports keyboard reachability, visible focus, and input-method parity without relying on colour.
 *
 * The surrounding example owns the actual controls and calls these methods from real focus and
 * activation paths. Keeping the counters in this panel makes each observed outcome available both
 * to the learner and to the headless course contract.
 */
export class AccessibleInteractionPanel extends Group {
  /** Stable teaching identity used by the accessibility course contract. */
  public readonly lessonName = 'Keyboard-complete interaction';

  /** Number of distinct eligible-control focus observations. */
  public keyboardVisits = 0;

  /** Number of accelerator activations. */
  public hotkeyActivations = 0;

  /** Number of focused Space or default Enter activations. */
  public focusedActivations = 0;

  /** Number of pointer activations. */
  public mouseActivations = 0;

  /** Number of completed Inspect command activations. */
  public inspectActivations = 0;

  /** Number of focus observations carrying a textual focus cue. */
  public visibleFocusChecks = 0;

  /** Number of activations whose result includes a non-colour semantic label. */
  public nonColorChecks = 0;

  /** Number of owner cleanup transitions. */
  public cleanupCount = 0;

  protected readonly focus = signal('Activate [FOCUSED]');
  protected readonly activation = signal('ready — no input method required');
  protected readonly lastFocused = signal('');
  protected pendingActivation: InteractionSource | null = null;
  protected active = false;

  /** Build the bounded evidence rows shown above the controls. */
  public constructor() {
    super();
    this.add(at(new Text('Task graph: discover -> focus -> activate -> verify'), 0, 0, 54, 1));
    this.add(at(new Text(() => `Focus: ${this.focus()} · cue: [FOCUSED]`), 0, 1, 54, 1));
    this.add(at(new Text('States: [SELECTED] [DISABLED] [ERROR] text + shape'), 0, 2, 54, 1));
    this.add(at(new Text(() => `Activation: ${this.activation()}`), 0, 3, 54, 1));
    this.add(at(new Text('Accelerators: visible with F12; then press A'), 0, 4, 54, 1));
    this.add(at(new Text('Mouse + keyboard: same outcome · non-color PASS'), 0, 5, 54, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.cleanupCount += 1;
      });
    });
  }

  /**
   * Record one newly focused eligible control.
   *
   * @param label Stable visible label for the focused control.
   */
  public observeFocus(label: string): void {
    if (!this.active) return;
    if (this.lastFocused.peek() === label) return;
    this.lastFocused.set(label);
    this.focus.set(`${label} [FOCUSED]`);
    this.keyboardVisits += 1;
    this.visibleFocusChecks += 1;
  }

  /**
   * Record the input route immediately before the real Button emits its shared command.
   *
   * @param source Actual event route observed by the mounted button.
   */
  public prepareActivation(source: InteractionSource): void {
    if (!this.active) return;
    this.pendingActivation = source;
  }

  /** Complete the prepared route through the application's one shared command handler. */
  public activateSharedCommand(): void {
    if (!this.active) return;
    const source = this.pendingActivation;
    if (source === null) return;
    this.pendingActivation = null;
    if (source === 'hotkey') this.hotkeyActivations += 1;
    else if (source === 'mouse') this.mouseActivations += 1;
    else this.focusedActivations += 1;
    this.nonColorChecks += 1;
    this.activation.set(`PASS — shared command via ${source}`);
  }

  /** Complete the secondary Inspect action with visible non-colour evidence. */
  public inspectSharedCommand(): void {
    if (!this.active) return;
    this.inspectActivations += 1;
    this.nonColorChecks += 1;
    this.activation.set('PASS — Inspect command reported focused state');
  }
}
