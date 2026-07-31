import {
  Button,
  Commands,
  Dialog,
  Group,
  Input,
  Label,
  Text,
  at,
  cancelButton,
  okButton,
  range,
  signal,
} from '@jsvision/ui';
import type { DesktopApplication, DispatchEvent, ModalHost } from '@jsvision/ui';

/** Command shared by the outer launcher keymap and an already-open validated dialog. */
export const DIALOG_RESULTS_TRY_OK_COMMAND = 'guide.dialog-results.try-ok';

/** Input route reported without relying on colour. */
export type DialogResultActionSource = 'ready' | 'keyboard' | 'mouse';

/**
 * Dialog specialization that makes validation outcomes observable before the modal promise settles.
 */
class ObservableResultsDialog extends Dialog {
  /**
   * @param onInvalid Called when OK is vetoed by the descendant validation sweep.
   * @param onResolved Called with the exact result passed through the modal host.
   */
  public constructor(
    protected readonly onInvalid: () => void,
    protected readonly onResolved: (result: unknown) => void,
  ) {
    super({ title: ' Validated result ', width: 48, height: 14 });
  }

  /** Report the same close-gate result that the modal host will apply. */
  public override valid(command: string): boolean {
    const allowed = super.valid(command);
    if (command === Commands.ok && !allowed) this.onInvalid();
    return allowed;
  }

  /** Observe the real modal-host result after focus restoration, then retain normal Dialog behavior. */
  public override attachModalHost(host: ModalHost): void {
    super.attachModalHost({
      endModal: (result) => {
        host.endModal(result);
        this.onResolved(result);
      },
      isCommandEnabled: (command) => host.isCommandEnabled(command),
    });
  }

  /** Map the lesson's outer Alt+O route to the standard OK termination path while modal. */
  public override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'command' && event.event.command === DIALOG_RESULTS_TRY_OK_COMMAND) {
      this.handleTerminating(Commands.ok, event);
      return;
    }
    super.onEvent(event);
  }
}

/**
 * Drives a real validation-gated dialog and exposes its command/value outcomes as visible state.
 */
export class DialogResultsPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Dialog results';

  /** Number of actual OK commands vetoed by the hosted validator. */
  public invalidAttempts = 0;

  /** Number of actual OK commands that resolved with the corrected value. */
  public acceptedResults = 0;

  /** Number of actual Cancel commands that bypassed an invalid value. */
  public cancelBypasses = 0;

  /** Number of transient dialogs whose mounted cleanup callback actually ran. */
  public cleanupCount = 0;

  /** Modal command values observed from settled `execView()` promises. */
  public get settledCommands(): readonly string[] {
    return this.observedSettledCommands;
  }

  /** Value interpretations paired with the settled commands. */
  public get settledValues(): readonly string[] {
    return this.observedSettledValues;
  }

  /** Current fixture value mirrored outside the transient dialog. */
  protected readonly value = signal('150');

  /** Last modal command rendered as a durable result. */
  protected readonly commandResult = signal('pending');

  /** Last accepted value, or a non-mutating cancellation marker. */
  protected readonly valueResult = signal('pending');

  /** Validation outcome rendered as text as well as control styling. */
  protected readonly validation = signal('pending');

  /** Focus outcome rendered as text so monochrome users receive the same information. */
  protected readonly focusResult = signal('launcher');

  /** Most recent input route. */
  protected readonly actionSource = signal<DialogResultActionSource>('ready');

  /** Visible evidence derived only from the settled modal promise. */
  protected readonly settledEvidence = signal('pending');

  /** Settled command history retained for exact implementation assertions. */
  protected readonly observedSettledCommands: string[] = [];

  /** Settled value history retained for exact implementation assertions. */
  protected readonly observedSettledValues: string[] = [];

  /** Dialog currently owning the modal scope, if any. */
  protected activeDialog: Dialog | null = null;

  /** Every transient dialog created by the panel, retained for unmount cleanup. */
  protected readonly ownedDialogs = new Set<Dialog>();

  /**
   * Build the result readout over the application that owns the real modal stack.
   *
   * @param app Complete docs application used to mount and execute transient dialogs.
   */
  public constructor(protected readonly app: DesktopApplication) {
    super();
    this.add(
      at(new Text(() => `Value: ${this.value()} (${this.value() === '50' ? 'valid' : 'invalid'})`), 0, 0, 62, 1),
    );
    this.add(at(new Text(() => `Command result: ${this.commandResult()}`), 0, 1, 62, 1));
    this.add(at(new Text(() => `Value result: ${this.valueResult()}`), 0, 2, 62, 1));
    this.add(at(new Text(() => `Validation: ${this.validation()}`), 0, 3, 62, 1));
    this.add(at(new Text(() => `Focus: ${this.focusResult()}`), 0, 4, 62, 1));
    this.add(
      at(
        new Text(() => `Action source: ${this.actionSource()} · Settled promise: ${this.settledEvidence()}`),
        0,
        5,
        62,
        1,
      ),
    );

    this.onMount(() => {
      this.onCleanup(() => {
        for (const dialog of this.ownedDialogs) {
          if (dialog.parent === this.app.desktop) this.app.desktop.removeWindow(dialog);
        }
        this.ownedDialogs.clear();
        this.activeDialog = null;
      });
    });
  }

  /** Open a validated dialog and immediately exercise its OK command. */
  public tryOk(source: Exclude<DialogResultActionSource, 'ready'>): void {
    if (this.activeDialog === null) this.openDialog(source);
    this.actionSource.set(source);
    this.app.loop.emitCommand(Commands.ok);
  }

  /** Restore the invalid fixture and open it without submitting, ready for the Cancel path. */
  public resetForCancel(source: Exclude<DialogResultActionSource, 'ready'>): void {
    this.value.set('150');
    this.commandResult.set('pending');
    this.valueResult.set('pending');
    this.validation.set('pending');
    this.focusResult.set('invalid field');
    this.actionSource.set(source);
    if (this.activeDialog === null) this.openDialog(source);
  }

  /** Build, mount, and execute one transient dialog while retaining explicit cleanup ownership. */
  protected openDialog(source: Exclude<DialogResultActionSource, 'ready'>): void {
    const restoreFocus = this.app.loop.getFocused();
    const input = new Input({ value: this.value, validator: range(0, 100) });
    let valueAtClose = 'no change';
    const dialog = new ObservableResultsDialog(
      () => {
        this.invalidAttempts += 1;
        this.validation.set('vetoed');
        this.focusResult.set('invalid field');
      },
      (result) => {
        const command = typeof result === 'string' ? result : 'undefined';
        this.commandResult.set(command);
        if (result === Commands.ok) {
          this.acceptedResults += 1;
          valueAtClose = this.value.peek();
          this.valueResult.set(valueAtClose);
          this.validation.set('passed');
        } else if (result === Commands.cancel) {
          this.cancelBypasses += 1;
          this.valueResult.set(valueAtClose);
          this.validation.set('bypassed');
        }
        this.focusResult.set(this.app.loop.getFocused() === restoreFocus ? 'launcher' : 'unexpected');
        this.activeDialog = null;
      },
    );
    const fix = new Button('~F~ix value', {
      onClick: () => {
        this.value.set('50');
        this.validation.set('ready');
        this.focusResult.set('validated field');
      },
    });
    dialog.add(at(new Text('OK validates; Cancel never traps the user.'), 1, 1, 42, 1));
    dialog.add(at(new Label('~V~alue:', input), 1, 3, 9, 1));
    dialog.add(at(input, 11, 3, 25, 1));
    dialog.add(at(new Text(() => `Close request command result: ${this.commandResult()}`), 1, 5, 42, 1));
    dialog.add(at(new Text(() => `Close request value result: ${this.valueResult()}`), 1, 6, 42, 1));
    dialog.add(at(new Text(() => `Validation: ${this.validation()}`), 1, 7, 42, 1));
    dialog.add(at(new Text(() => `Focus: ${this.focusResult()}`), 1, 8, 42, 1));
    dialog.add(at(new Text(() => `Action source: ${this.actionSource()}`), 1, 9, 42, 1));
    dialog.add(at(fix, 1, 10, 12, 2));
    dialog.add(at(okButton(this.app.i18n), 17, 10, 10, 2));
    dialog.add(at(cancelButton(this.app.i18n), 30, 10, 12, 2));

    this.actionSource.set(source);
    this.settledEvidence.set('pending');
    this.activeDialog = dialog;
    this.ownedDialogs.add(dialog);
    dialog.onMount(() => {
      dialog.onCleanup(() => {
        this.cleanupCount += 1;
      });
    });
    this.app.desktop.addWindow(dialog);
    if (restoreFocus !== null) this.app.loop.focusView(restoreFocus);
    const result = this.app.loop.execView<string>(dialog);
    void result
      .then((settledCommand) => {
        const command = settledCommand ?? 'undefined';
        this.observedSettledCommands.push(command);
        this.observedSettledValues.push(valueAtClose);
        this.settledEvidence.set(`${command} / ${valueAtClose}`);
      })
      .finally(() => {
        if (dialog.parent === this.app.desktop) this.app.desktop.removeWindow(dialog);
        this.ownedDialogs.delete(dialog);
      });
  }
}
