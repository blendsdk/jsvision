import { createLogger, redactEvent, sanitize } from '@jsvision/core';
import type { Logger } from '@jsvision/core';
import { Group, Text, at, signal } from '@jsvision/ui';

/** One bounded hostile fixture and the non-sensitive name shown to learners. */
interface HostileTextSample {
  readonly name: string;
  readonly raw: string;
  readonly sensitive?: true;
}

const SAMPLES: readonly HostileTextSample[] = [
  { name: 'OSC title', raw: 'report\x1b]0;owned\x07.txt' },
  { name: 'CSI colour', raw: 'status\x1b[31mRED\x1b[0m' },
  { name: 'C0 + C1 controls', raw: 'user\x01name\x85' },
  { name: 'multiline Unicode', raw: 'café 😀\tcolumn\nnext line' },
  { name: 'sensitive paste', raw: 'visitor-secret-token\x1b]0;owned\x07', sensitive: true },
] as const;

/** Return whether one code point is removed by the public terminal sanitizer. */
function isRemovedTerminalControl(codePoint: number): boolean {
  return (
    codePoint === 0x1b ||
    (codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a) ||
    (codePoint >= 0x80 && codePoint <= 0x9f)
  );
}

/** Count terminal-control code points that must not reach a rendered cell. */
function countRemovedTerminalControls(text: string): number {
  return Array.from(text).filter((character) => isRemovedTerminalControl(character.codePointAt(0) ?? 0)).length;
}

/**
 * Render text as inert bounded notation without replaying its control bytes.
 *
 * Printable sequence tails intentionally remain visible. This lets learners see why removing ESC
 * neutralizes a command without pretending that the printable parameters disappear.
 */
function escapedNotation(text: string): string {
  return Array.from(text)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      if (character === '\t') return '\\t';
      if (character === '\n') return '\\n';
      if (codePoint === 0x1b) return '\\x1b';
      if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
        return `\\x${codePoint.toString(16).padStart(2, '0')}`;
      }
      return character;
    })
    .join('')
    .slice(0, 62);
}

/** Sanitize a fixture while replacing deliberately sensitive printable content before retention. */
function safeFixtureDisplay(sample: HostileTextSample): string {
  const sanitized = sanitize(sample.raw);
  return sample.sensitive === true ? '[SENSITIVE printable content preserved]' : sanitized;
}

/**
 * Drives the deterministic unsafe-input, sanitized-output, and redacted-diagnostic comparison.
 *
 * Raw fixture bytes are retained only in the bounded in-memory sample table. The panel displays
 * escaped notation, routes visible output through `sanitize`, and logs only redacted event shapes
 * plus structural counts.
 */
export class UntrustedTextPanel extends Group {
  /** Stable teaching identity used by the course specification. */
  public readonly lessonName = 'Untrusted text boundary';

  /** Number of explicit sanitize actions accepted while mounted. */
  public sanitizations = 0;

  /** Number of diagnostic-redaction actions accepted while mounted. */
  public redactions = 0;

  /** Number of active-to-disposed owner transitions. */
  public cleanupCount = 0;

  /** Maximum number of structural diagnostic records retained by the laboratory. */
  public readonly diagnosticCapacity = 4;

  protected readonly selected = signal(0);
  protected readonly safeOutput = signal(safeFixtureDisplay(SAMPLES[0]!));
  protected readonly sanitizeStatus = signal('Sanitizer: READY');
  protected readonly redactionStatus = signal('Redaction: READY · payloads leaked: 0');
  protected readonly logger: Logger = createLogger({ sink: 'ring', size: this.diagnosticCapacity });
  protected active = false;

  /** Build the compact comparison surface and its reactive status rows. */
  public constructor() {
    super();
    this.add(at(new Text(() => `UNSAFE escaped input [${this.sample.name}]`), 0, 0, 54, 1));
    this.add(at(new Text(() => `Input notation: ${this.escapedSample}`), 0, 1, 54, 1));
    this.add(at(new Text(() => `SAFE sanitized output: ${this.safeDisplay}`), 0, 2, 54, 1));
    this.add(
      at(
        new Text(() => `Controls: unsafe ${this.unsafeControlCount} · rendered controls: ${this.renderedControlCount}`),
        0,
        3,
        54,
        1,
      ),
    );
    this.add(at(new Text('Threats: ESC · BEL · C0/C1 control · printable tail'), 0, 4, 54, 1));
    this.add(at(new Text(() => this.sanitizeStatus()), 0, 5, 54, 1));
    this.add(at(new Text(() => this.redactionStatus()), 0, 6, 54, 1));
    this.add(at(new Text('Route: shared command · SAFE uses text, not colour'), 0, 7, 54, 1));

    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.logger.close();
        this.cleanupCount += 1;
      });
    });
  }

  /** Current bounded fixture index. */
  public get sampleIndex(): number {
    return this.selected();
  }

  /** Number of removable terminal controls in the selected raw fixture. */
  public get unsafeControlCount(): number {
    return countRemovedTerminalControls(this.sample.raw);
  }

  /** Number of removable terminal controls remaining after the display boundary. */
  public get renderedControlCount(): number {
    return countRemovedTerminalControls(this.safeOutput());
  }

  /** Number of raw fixture payloads found in the bounded diagnostic sink. */
  public get leakedPayloads(): number {
    const retained = JSON.stringify(this.logger.entries());
    return SAMPLES.filter((sample) => {
      const serializedPayload = JSON.stringify(sample.raw).slice(1, -1);
      return (
        retained.includes(serializedPayload) || (sample.sensitive === true && retained.includes('visitor-secret-token'))
      );
    }).length;
  }

  /** Current number of bounded structural diagnostic records. */
  public get diagnosticCount(): number {
    return this.logger.entries().length;
  }

  /** Select the next bounded hostile fixture without displaying its raw control bytes. */
  public nextSample(): void {
    if (!this.active) return;
    const next = (this.selected() + 1) % SAMPLES.length;
    this.selected.set(next);
    this.safeOutput.set(safeFixtureDisplay(this.sample));
    this.sanitizeStatus.set('Sanitizer: READY');
    this.redactionStatus.set(`Redaction: READY · payloads leaked: ${this.leakedPayloads}`);
  }

  /** Apply the public terminal sanitizer at the explicit display boundary. */
  public sanitizeSelected(): void {
    if (!this.active) return;
    const before = this.unsafeControlCount;
    this.safeOutput.set(safeFixtureDisplay(this.sample));
    this.sanitizations += 1;
    this.logger.info('display', 'sanitized', { controlsRemoved: before });
    this.sanitizeStatus.set(`Sanitizer: PASS · controls removed: ${before}`);
  }

  /** Record structural input evidence while discarding pasted and printable-key content. */
  public redactSelected(): void {
    if (!this.active) return;
    this.logger.debug('input', 'paste', {
      event: redactEvent({ type: 'paste', text: this.sample.raw, truncated: false }),
    });
    this.logger.debug('input', 'key', {
      event: redactEvent({
        type: 'key',
        key: 's',
        codepoint: 115,
        ctrl: false,
        alt: false,
        shift: false,
      }),
    });
    this.redactions += 1;
    this.redactionStatus.set(`Redaction: PASS · payloads leaked: ${this.leakedPayloads}`);
  }

  /** Current selected fixture, which is always present because the table is non-empty. */
  protected get sample(): HostileTextSample {
    return SAMPLES[this.selected()] ?? SAMPLES[0]!;
  }

  /** Inert preview that never exposes the deliberately sensitive fixture's printable payload. */
  protected get escapedSample(): string {
    return this.sample.sensitive === true
      ? '[REDACTED printable payload]\\x1b]0;owned\\x07'
      : escapedNotation(this.sample.raw);
  }

  /** Bounded display result that states, but never reveals, preserved sensitive printable content. */
  protected get safeDisplay(): string {
    return escapedNotation(this.safeOutput());
  }
}
