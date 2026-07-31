import type { CapabilityProfile } from '@jsvision/core';
import {
  Button,
  Dialog,
  Group,
  Text,
  View,
  at,
  cancelButton,
  createEventLoop,
  noButton,
  signal,
  yesButton,
} from '@jsvision/ui';
import type { DesktopApplication, DispatchEvent, ModalHost } from '@jsvision/ui';

/** Input route reported without relying on colour. */
export type ModalWorkflowActionSource = 'ready' | 'keyboard' | 'mouse';

/** Dialog that exposes the exact value passed through its real modal-host boundary. */
class ObservedDialog extends Dialog {
  /**
   * Build an observed dialog.
   *
   * @param title Frame title.
   * @param width Authored width in cells.
   * @param height Authored height in cells.
   * @param onResolved Called after `endModal()` restores the saved focus.
   */
  public constructor(
    title: string,
    width: number,
    height: number,
    protected readonly onResolved: (result: unknown) => void,
  ) {
    super({ title, width, height });
  }

  /** Observe the actual host result and post-restoration focus without replacing Dialog semantics. */
  public override attachModalHost(host: ModalHost): void {
    super.attachModalHost({
      endModal: (result) => {
        host.endModal(result);
        this.onResolved(result);
      },
      isCommandEnabled: (command) => host.isCommandEnabled(command),
    });
  }
}

/** Outer modal that records any key event which should have been confined to its nested child. */
class CountingOuterDialog extends ObservedDialog {
  /** Number of raw key events delivered to this outer modal. */
  public keyEvents = 0;

  /** Build the fixed outer workflow surface. */
  public constructor(onResolved: (result: unknown) => void) {
    super(' Outer workflow ', 46, 12, onResolved);
  }

  /** Count raw keys only when this dialog is the active dispatch scope. */
  public override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key') this.keyEvents += 1;
    super.onEvent(event);
  }
}

/**
 * Runs a real two-level modal stack and a separate disposal probe while the lesson stays alive.
 */
export class ModalWorkflowsPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Modal workflows';

  /** Number of nested workflows opened through the public modal API. */
  public nestedRuns = 0;

  /** Number of outer-dialog events observed while an inner modal should own input. */
  public get confinedOuterEvents(): number {
    return this.outerDialog?.keyEvents ?? this.lastOuterEventCount;
  }

  /** Number of transient modal views released by completed workflows and teardown probes. */
  public cleanupCount = 0;

  /** Number of exact focus identities restored at real modal-host boundaries. */
  public focusRestorations = 0;

  /** Modal values observed in the order their `execView()` promises settled. */
  public get settledResults(): readonly string[] {
    return this.observedSettledResults;
  }

  /** Disposal-probe batches whose two promises both settled to `undefined`. */
  public get teardownSettlements(): number {
    return this.observedTeardownSettlements;
  }

  /** Current stack description. */
  protected readonly stack = signal('none');

  /** Resolution sequence retained as a non-colour outcome. */
  protected readonly resolvedOrder = signal('pending');

  /** Exact focus destination reported to the learner. */
  protected readonly focusResult = signal('launcher');

  /** Whether input remained confined to the current top modal. */
  protected readonly confinement = signal('not tested');

  /** Disposal result from the isolated headless modal stack. */
  protected readonly teardownResult = signal('pending');

  /** Promise settlement order rendered independently from synchronous host resolution. */
  protected readonly promiseOrder = signal('pending');

  /** Number of modal roots still mounted in the disposal probe. */
  protected readonly mountedModals = signal(0);

  /** Most recent input route. */
  protected readonly actionSource = signal<ModalWorkflowActionSource>('ready');

  /** Current outer modal. */
  protected outerDialog: CountingOuterDialog | null = null;

  /** Current inner modal. */
  protected innerDialog: Dialog | null = null;

  /** Launcher focus restored after the outer modal resolves. */
  protected launcher: View | null = null;

  /** Outer event count retained after the transient dialog is removed. */
  protected lastOuterEventCount = 0;

  /** Ordered modal results for the current workflow. */
  protected readonly results: string[] = [];

  /** Ordered values read from settled modal promises across workflow runs. */
  protected readonly observedSettledResults: string[] = [];

  /** Number of disposal probes verified from both settled promises. */
  protected observedTeardownSettlements = 0;

  /** Every transient desktop dialog retained for exact unmount cleanup. */
  protected readonly ownedDialogs = new Set<Dialog>();

  /** Prevent asynchronous evidence from mutating a lesson whose owner has already unmounted. */
  protected active = true;

  /**
   * Build the workflow readout over the application that owns the real modal stack.
   *
   * @param app Complete docs application used for transient modal execution.
   * @param caps Capabilities used by the isolated teardown probe.
   */
  public constructor(
    protected readonly app: DesktopApplication,
    protected readonly caps: CapabilityProfile,
  ) {
    super();
    this.add(at(new Text(() => `Stack: ${this.stack()}`), 0, 0, 62, 1));
    this.add(at(new Text(() => `Resolved order: ${this.resolvedOrder()}`), 0, 1, 62, 1));
    this.add(at(new Text(() => `Focus: ${this.focusResult()} · Focus restored: ${this.focusResult()}`), 0, 2, 62, 1));
    this.add(at(new Text(() => `Input confined: ${this.confinement()}`), 0, 3, 62, 1));
    this.add(
      at(
        new Text(() => `Expected teardown result: undefined · Observed teardown: ${this.teardownResult()}`),
        0,
        4,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Mounted modals: ${this.mountedModals()}`), 0, 5, 62, 1));
    this.add(
      at(new Text(() => `Action source: ${this.actionSource()} · Promise order: ${this.promiseOrder()}`), 0, 6, 62, 1),
    );

    this.onMount(() => {
      this.onCleanup(() => {
        this.active = false;
        for (const dialog of this.ownedDialogs) {
          if (dialog.parent === this.app.desktop) this.app.desktop.removeWindow(dialog);
        }
        this.ownedDialogs.clear();
        this.outerDialog = null;
        this.innerDialog = null;
      });
    });
  }

  /** Start an outer modal and immediately place a confirmation modal above it. */
  public runNested(source: Exclude<ModalWorkflowActionSource, 'ready'>, launcher: View): void {
    if (this.outerDialog !== null || this.innerDialog !== null) return;
    this.nestedRuns += 1;
    this.actionSource.set(source);
    this.launcher = launcher;
    this.results.length = 0;
    this.resolvedOrder.set('pending');
    this.focusResult.set('outer modal');
    this.confinement.set('yes');

    const outerAction = new Button('Outer action');
    const outer = new CountingOuterDialog((result) => {
      this.observeOuterResolution(result, outer);
    });
    const cancel = cancelButton(this.app.i18n);
    outer.add(at(new Text('The inner confirmation must resolve before this modal.'), 1, 1, 40, 1));
    outer.add(at(new Text(() => `Resolved: ${this.results.join(' -> ') || 'pending'}`), 1, 3, 40, 1));
    outer.add(at(new Text(() => `Focus restored: ${this.focusResult()}`), 1, 4, 40, 1));
    outer.add(at(new Text(() => `Input confined: ${this.confinement()}`), 1, 5, 40, 1));
    outer.add(at(outerAction, 4, 8, 14, 2));
    outer.add(at(cancel, 21, 8, 16, 2));

    this.outerDialog = outer;
    this.mountOwnedDialog(outer);
    this.app.loop.focusView(launcher);
    const outerResult = this.app.loop.execView<string>(outer);
    void outerResult.then((result) => {
      if (!this.active) return;
      this.recordSettledResult(`outer ${result ?? 'undefined'}`);
    });

    const inner = new ObservedDialog(' Confirmation ', 38, 9, (result) => {
      this.observeInnerResolution(result, inner, outerAction);
    });
    const yes = yesButton(this.app.i18n);
    const no = noButton(this.app.i18n);
    inner.add(at(new Text('Resolve this top modal first.'), 1, 1, 32, 1));
    inner.add(at(new Text('Stack: outer > inner'), 1, 2, 32, 1));
    inner.add(at(new Text('Input confined: yes'), 1, 3, 32, 1));
    inner.add(at(new Text(() => `Action source: ${this.actionSource()}`), 1, 4, 32, 1));
    inner.add(at(yes, 7, 5, 10, 2));
    inner.add(at(no, 20, 5, 10, 2));
    this.innerDialog = inner;
    this.mountOwnedDialog(inner);
    this.app.loop.focusView(outerAction);
    const innerResult = this.app.loop.execView<string>(inner);
    void innerResult.then((result) => {
      if (!this.active) return;
      this.recordSettledResult(`inner ${result ?? 'undefined'}`);
    });
    this.stack.set('outer > inner');
  }

  /** Record a real inner-host result, exact focus identity, and cleanup callback. */
  protected observeInnerResolution(result: unknown, inner: Dialog, restore: View): void {
    const command = typeof result === 'string' ? result : 'undefined';
    this.results.push(`inner ${command}`);
    this.resolvedOrder.set(`inner ${result}`);
    this.stack.set('outer');
    const restored = this.app.loop.getFocused() === restore;
    if (restored) this.focusRestorations += 1;
    this.focusResult.set(restored ? 'outer modal' : 'unexpected');
    this.lastOuterEventCount = this.outerDialog?.keyEvents ?? 0;
    this.releaseOwnedDialog(inner);
    this.innerDialog = null;
  }

  /** Record a real outer-host result, exact launcher identity, and cleanup callback. */
  protected observeOuterResolution(result: unknown, outer: CountingOuterDialog): void {
    const command = typeof result === 'string' ? result : 'undefined';
    this.results.push(`outer ${command}`);
    this.resolvedOrder.set('inner -> outer');
    this.stack.set('none');
    const restored = this.app.loop.getFocused() === this.launcher;
    if (restored) this.focusRestorations += 1;
    this.focusResult.set(restored ? 'launcher' : 'unexpected');
    this.lastOuterEventCount = outer.keyEvents;
    this.releaseOwnedDialog(outer);
    this.outerDialog = null;
  }

  /** Mount one owned dialog and count its real unmount cleanup exactly once. */
  protected mountOwnedDialog(dialog: Dialog): void {
    this.ownedDialogs.add(dialog);
    dialog.onMount(() => {
      dialog.onCleanup(() => {
        this.cleanupCount += 1;
      });
    });
    this.app.desktop.addWindow(dialog);
  }

  /** Remove one owned dialog through the desktop that mounted it. */
  protected releaseOwnedDialog(dialog: Dialog): void {
    if (dialog.parent === this.app.desktop) this.app.desktop.removeWindow(dialog);
    this.ownedDialogs.delete(dialog);
  }

  /** Append one settled promise value and publish the observed order. */
  protected recordSettledResult(result: string): void {
    this.observedSettledResults.push(result);
    const currentRun = this.observedSettledResults.slice(-2);
    this.promiseOrder.set(currentRun.join(' -> '));
  }

  /** Dispose a separate two-frame modal stack and report its synchronous teardown state. */
  public runTeardown(source: Exclude<ModalWorkflowActionSource, 'ready'>): void {
    const root = new Group();
    const first = new Group();
    first.add(new Button('First'));
    const second = new Group();
    second.add(new Button('Second'));
    root.add(first);
    root.add(second);
    first.onMount(() => first.onCleanup(() => (this.cleanupCount += 1)));
    second.onMount(() => second.onCleanup(() => (this.cleanupCount += 1)));
    const loop = createEventLoop({ width: 24, height: 6 }, { caps: this.caps });
    loop.mount(root);
    const firstResult = loop.execView<string>(first);
    const secondResult = loop.execView<string>(second);
    loop.dispose();

    this.actionSource.set(source);
    this.mountedModals.set(Number(first.mounted) + Number(second.mounted));
    this.teardownResult.set('pending');
    void Promise.all([firstResult, secondResult]).then((results) => {
      if (!this.active) return;
      const released = results.every((result) => result === undefined);
      if (released) this.observedTeardownSettlements += 1;
      this.teardownResult.set(released ? 'undefined' : 'unexpected');
    });
  }
}
