import { createLogger } from '@jsvision/core';
import type { CapabilityProfile, Logger } from '@jsvision/core';
import { Group, Text, View, at, signal } from '@jsvision/ui';

/** Stable command whose deliberately disabled state gives the lab real command evidence. */
export const DEBUGGING_PROBE_COMMAND = 'guide.debugging.probe';

/** Host-neutral seams needed to inspect application-owned focus and command state. */
export interface DebuggingEvidenceSeams {
  /** Return the application's actual focused leaf. */
  getFocused(): View | null;
  /** Report whether an application command is currently enabled. */
  isCommandEnabled(command: string): boolean;
  /** Change command availability when the learner applies the correction. */
  enableCommand(command: string, enabled: boolean): void;
  /** Emit one command through the application's registered command sink. */
  emitCommand(command: string): void;
  /** Focus an exact eligible mounted leaf through the application event loop. */
  focusView(view: View): void;
  /** Flush pending layout and paint work before reading evidence. */
  flush(): void;
  /** Read the exact root-buffer cells occupied by a mounted view. */
  readRendered(view: View): string;
  /** Deterministic capability profile used by the mounted laboratory. */
  readonly caps: CapabilityProfile;
}

/** Concrete application-lifetime resource used to distinguish live and disposed ownership. */
class DiagnosticResource {
  /** Whether the resource may still accept work. */
  public active = true;

  /** Number of accepted uses while the owner is active. */
  public uses = 0;

  /** Number of active-to-disposed transitions. */
  public disposals = 0;

  /** Record one real use while the resource is owned. */
  public use(): void {
    if (this.active) this.uses += 1;
  }

  /** Release the resource exactly once. */
  public dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.disposals += 1;
  }
}

/**
 * Owns one retained callback so the laboratory can prove stale work is rejected after disposal.
 *
 * The callback captures this owner rather than the panel. That makes its post-disposal behavior
 * observable without unmounting the main lesson window.
 */
class StaleWorkProbe {
  /** Whether this callback owner may still accept work. */
  public active = true;

  /** Number of callback attempts rejected after disposal. */
  public rejections = 0;

  /** Number of state mutations accepted while active. */
  public mutations = 0;

  /** Concrete resource whose use count proves rejected work did not cross the owner boundary. */
  public readonly resource = new DiagnosticResource();

  /** Return a callback that remains callable after this owner is disposed. */
  public retain(): () => void {
    return () => {
      if (!this.active) {
        this.rejections += 1;
        return;
      }
      this.resource.use();
      this.mutations += 1;
    };
  }

  /** Dispose the callback owner and its resource exactly once. */
  public dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.resource.dispose();
  }
}

/** Supported diagnostic categories exposed by the evidence ladder. */
type DiagnosticKind = 'layout' | 'focus' | 'command' | 'render' | 'capability' | 'lifecycle';

/** Human-readable lesson facts for one diagnosed boundary. */
interface DiagnosticLesson {
  readonly symptom: string;
  readonly cause: string;
  readonly evidence: string;
  readonly correction: string;
}

/**
 * Drives a systematic debugging lesson from authentic mounted application facts.
 *
 * The panel deliberately starts with one zero-width child, one disabled focus target, and one
 * disabled command. Its render, capability, and lifecycle probes read the same public boundaries a
 * real application would inspect. Diagnostics retain stable codes only; the synthetic unsafe
 * payload is discarded before it reaches the bounded logger.
 */
export class DebuggingEvidencePanel extends Group {
  /** Stable teaching identity used by the course laboratory oracle. */
  public readonly lessonName = 'Debugging evidence ladder';

  /** Number of mounted-geometry inspections. */
  public layoutDiagnoses = 0;

  /** Number of focus-route inspections. */
  public focusDiagnoses = 0;

  /** Number of command-availability inspections. */
  public commandDiagnoses = 0;

  /** Number of reactive publication and render inspections. */
  public renderDiagnoses = 0;

  /** Number of capability-profile inspections. */
  public capabilityDiagnoses = 0;

  /** Number of application-resource lifetime inspections. */
  public lifecycleDiagnoses = 0;

  /** Number of correction-and-verification runs. */
  public corrections = 0;

  /** Number of panel owner cleanup transitions. */
  public cleanupCount = 0;

  /** Maximum number of diagnostic records retained by the laboratory. */
  public readonly diagnosticCapacity = 4;

  protected readonly selected = signal<DiagnosticKind | 'none'>('none');
  protected readonly symptom = signal('reproduce one bounded failure');
  protected readonly cause = signal('not classified');
  protected readonly evidence = signal('inspect one owning boundary');
  protected readonly correction = signal('not applied');
  protected readonly verification = signal('pending');
  protected readonly renderVersion = signal(0);
  protected readonly fallbackMode = signal('native');
  protected readonly logger: Logger;
  protected readonly seams: DebuggingEvidenceSeams;
  protected readonly resource = new DiagnosticResource();
  protected readonly layoutProbe = new Text('ASCII');
  protected readonly focusProbe = new Text('focus probe');
  protected readonly renderProbe = new Text(
    () => `Alt+L/F/C/R/P/H/V · R${this.renderVersion()}/${this.fallbackMode()} · Redaction PASS · ASCII`,
  );
  protected staleWork = new StaleWorkProbe();
  protected retainedLateWork = this.staleWork.retain();
  protected probeCommandRuns = 0;
  protected active = false;

  /** Build the mounted probes and bounded evidence surface. */
  public constructor(seams: DebuggingEvidenceSeams) {
    super();
    this.seams = seams;
    this.logger = createLogger({ sink: 'ring', size: this.diagnosticCapacity });
    this.focusProbe.focusable = true;
    this.focusProbe.state.disabled = true;

    this.add(at(new Text('Evidence ladder: reproduce classify evidence correct verify'), 0, 0, 54, 1));
    this.add(at(new Text(() => `Boundary: ${this.selected()} · Verification: ${this.verification()}`), 0, 1, 54, 1));
    this.add(at(new Text(() => `Symptom: ${this.symptom()}`), 0, 2, 54, 1));
    this.add(at(new Text(() => `Cause: ${this.cause()}`), 0, 3, 54, 1));
    this.add(at(new Text(() => `Evidence: ${this.evidence()}`), 0, 4, 54, 1));
    this.add(at(new Text(() => `Correction: ${this.correction()}`), 0, 5, 54, 1));
    this.add(at(this.renderProbe, 0, 6, 54, 1));
    this.add(at(this.focusProbe, 46, 6, 0, 1));
    this.add(at(this.layoutProbe, 50, 6, 0, 1));

    this.onMount(() => {
      this.active = true;
      this.resource.use();
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.staleWork.dispose();
        this.resource.dispose();
        this.logger.close();
        this.cleanupCount += 1;
      });
    });
  }

  /** Current number of bounded diagnostic entries. */
  public get diagnosticCount(): number {
    return this.logger.entries().length;
  }

  /** Number of unsafe fixture payloads that crossed the logger boundary. */
  public get leakedPayloads(): number {
    return JSON.stringify(this.logger.entries()).includes('fixture-secret-payload') ? 1 : 0;
  }

  /** Defensive snapshot of the stable diagnostic codes retained by the bounded ring. */
  public get diagnosticCodes(): readonly string[] {
    return this.logger
      .entries()
      .map((entry) => entry.fields?.code)
      .filter((code): code is string => typeof code === 'string');
  }

  /** Number of concrete application-resource disposal transitions. */
  public get resourceDisposals(): number {
    return this.resource.disposals;
  }

  /** Number of real probe-command handler deliveries. */
  public get commandHandlerRuns(): number {
    return this.probeCommandRuns;
  }

  /** Solved width of the deliberately clipped layout probe. */
  public get layoutProbeWidth(): number {
    return this.layoutProbe.bounds.width;
  }

  /** Whether the event loop's exact focused leaf is the corrected focus probe. */
  public get focusProbeOwnsFocus(): boolean {
    return this.seams.getFocused() === this.focusProbe;
  }

  /** Current reactive version rendered by the mounted observation view. */
  public get renderedVersion(): number {
    return this.renderVersion();
  }

  /** Current deterministic presentation mode rendered by the capability correction. */
  public get presentationMode(): string {
    return this.fallbackMode();
  }

  /** Number of retained late-work callbacks rejected by their disposed owner. */
  public get lateWorkRejections(): number {
    return this.staleWork.rejections;
  }

  /** Number of mutations accepted by the retained callback's owner. */
  public get lateWorkMutations(): number {
    return this.staleWork.mutations;
  }

  /** Number of resource uses made by the retained callback's owner. */
  public get lateWorkResourceUses(): number {
    return this.staleWork.resource.uses;
  }

  /** Record delivery through the application's real registered command handler. */
  public recordProbeCommand(): void {
    if (this.active) this.probeCommandRuns += 1;
  }

  /** Invoke the retained callback even after its owner or the panel has been disposed. */
  public invokeRetainedWork(): void {
    this.retainedLateWork();
  }

  /** Inspect the mounted zero-width probe and classify its clipping failure. */
  public inspectLayout(): void {
    if (!this.active) return;
    this.layoutDiagnoses += 1;
    const rect = this.layoutProbe.bounds;
    this.publish('layout', {
      symptom: 'clipped child is absent',
      cause: 'fixed width resolved to zero cells',
      evidence: `probe rect ${rect.width}x${rect.height}; parent ${this.bounds.width}x${this.bounds.height}`,
      correction: 'give the probe a positive measured width',
    });
  }

  /** Inspect a real mounted but disabled focus target. */
  public inspectFocus(): void {
    if (!this.active) return;
    this.focusDiagnoses += 1;
    const focused = this.seams.getFocused();
    this.publish('focus', {
      symptom: 'expected probe does not receive input',
      cause: 'probe is disabled and therefore ineligible',
      evidence: `focused ${focused?.constructor.name ?? 'none'}; probe disabled ${this.focusProbe.state.disabled}`,
      correction: 'enable and focus the mounted probe',
    });
  }

  /** Inspect the application's real command availability. */
  public inspectCommand(): void {
    if (!this.active) return;
    this.commandDiagnoses += 1;
    const enabled = this.seams.isCommandEnabled(DEBUGGING_PROBE_COMMAND);
    const before = this.probeCommandRuns;
    this.seams.emitCommand(DEBUGGING_PROBE_COMMAND);
    const after = this.probeCommandRuns;
    this.publish('command', {
      symptom: 'probe command is dropped',
      cause: 'application command is disabled',
      evidence: `isCommandEnabled ${enabled}; handler runs ${before}->${after}`,
      correction: 'enable, emit, and observe the registered handler',
    });
  }

  /** Publish real reactive state that the mounted text view consumes. */
  public inspectRender(): void {
    if (!this.active) return;
    this.renderDiagnoses += 1;
    const before = this.seams.readRendered(this.renderProbe).trim();
    this.renderVersion.set(this.renderVersion() + 1);
    this.seams.flush();
    const after = this.seams.readRendered(this.renderProbe).trim();
    this.publish('render', {
      symptom: 'published state needs matching frame cells',
      cause: 'a state-only assertion cannot prove painted cells',
      evidence: `published version ${this.renderVersion()}; frame ${before}->${after}`,
      correction: 'publish, flush, and assert the exact rendered version',
    });
  }

  /** Inspect the deterministic capability profile threaded into the application. */
  public inspectCapability(): void {
    if (!this.active) return;
    this.capabilityDiagnoses += 1;
    const { caps } = this.seams;
    this.publish('capability', {
      symptom: 'terminal presentation may degrade',
      cause: 'rendering follows the resolved profile',
      evidence: `colour ${caps.colorDepth}; UTF-8 ${caps.unicode.utf8}; mouse SGR ${caps.mouse.sgr}`,
      correction: 'honour the reasoned ASCII/non-colour fallback',
    });
  }

  /** Inspect the concrete application-owned diagnostic resource. */
  public inspectLifecycle(): void {
    if (!this.active) return;
    this.lifecycleDiagnoses += 1;
    if (!this.staleWork.active) {
      this.staleWork = new StaleWorkProbe();
      this.retainedLateWork = this.staleWork.retain();
    }
    this.publish('lifecycle', {
      symptom: 'late work can outlive its screen',
      cause: 'a retained callback crosses its owner lifetime',
      evidence: `resource active ${this.staleWork.active}; mutations ${this.staleWork.mutations}; rejected ${this.staleWork.rejections}`,
      correction: 'dispose its owner, invoke it, and prove no mutation',
    });
  }

  /** Correct the selected authentic fault and verify it against the same boundary. */
  public verifyCorrection(): void {
    if (!this.active) return;
    this.corrections += 1;
    const kind = this.selected();
    let verified = false;
    switch (kind) {
      case 'layout': {
        this.layoutProbe.setLayout({ position: 'absolute', rect: { x: 48, y: 6, width: 5, height: 1 } });
        this.seams.flush();
        const cells = this.seams.readRendered(this.layoutProbe);
        verified = this.layoutProbe.bounds.width === 5 && cells === 'ASCII';
        this.correction.set(`positive solved width; frame "${cells}"`);
        break;
      }
      case 'focus':
        this.focusProbe.state.disabled = false;
        this.focusProbe.invalidate();
        this.seams.focusView(this.focusProbe);
        verified = this.seams.getFocused() === this.focusProbe;
        this.correction.set(`enabled and focused exact probe: ${verified}`);
        break;
      case 'command': {
        const before = this.probeCommandRuns;
        this.seams.enableCommand(DEBUGGING_PROBE_COMMAND, true);
        this.seams.emitCommand(DEBUGGING_PROBE_COMMAND);
        verified = this.seams.isCommandEnabled(DEBUGGING_PROBE_COMMAND) && this.probeCommandRuns === before + 1;
        this.correction.set(`enabled handler runs ${before}->${this.probeCommandRuns}`);
        break;
      }
      case 'render': {
        const before = this.seams.readRendered(this.renderProbe);
        const version = this.renderVersion() + 1;
        this.renderVersion.set(version);
        this.seams.flush();
        const after = this.seams.readRendered(this.renderProbe);
        verified = after !== before && after.includes(`R${version}/`);
        this.correction.set(`frame changed to R${version}: ${verified}`);
        break;
      }
      case 'capability': {
        this.fallbackMode.set('ASCII');
        this.seams.flush();
        const cells = this.seams.readRendered(this.renderProbe);
        verified = cells.includes('/ASCII');
        this.correction.set(`reasoned fallback rendered: ${verified ? 'ASCII' : 'missing'}`);
        break;
      }
      case 'lifecycle': {
        const mutations = this.staleWork.mutations;
        const uses = this.staleWork.resource.uses;
        this.staleWork.dispose();
        this.invokeRetainedWork();
        verified =
          this.staleWork.rejections === 1 &&
          this.staleWork.mutations === mutations &&
          this.staleWork.resource.uses === uses;
        this.correction.set(`late callback rejected; mutations ${mutations}->${this.staleWork.mutations}`);
        break;
      }
      case 'none':
        this.correction.set('select one boundary before verification');
        break;
    }
    this.verification.set(verified ? `PASS verified: ${kind}` : 'FAIL · evidence disagrees');
    this.logger.info('verify', verified ? 'correction verified' : 'correction failed', {
      code: verified ? 'CORRECTION_VERIFIED' : 'CORRECTION_FAILED',
    });
    this.seams.flush();
  }

  /** Publish one lesson and retain only its stable diagnostic code. */
  protected publish(kind: DiagnosticKind, lesson: DiagnosticLesson): void {
    this.selected.set(kind);
    this.symptom.set(lesson.symptom);
    this.cause.set(lesson.cause);
    this.evidence.set(lesson.evidence);
    this.correction.set(lesson.correction);
    this.verification.set('WARN · correction pending');
    this.recordDiagnostic(`DIAG_${kind.toUpperCase()}`, 'fixture-secret-payload');
  }

  /** Retain the stable category while deliberately discarding unsafe service or host detail. */
  protected recordDiagnostic(code: string, _unsafeDetail: string): void {
    this.logger.warn('debugging', 'boundary diagnosed', { code });
  }
}
