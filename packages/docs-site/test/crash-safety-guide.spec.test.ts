/**
 * Immutable oracle for the Crash safety & terminal restore course and its authentic native artifact.
 *
 * Browser examples cannot prove process-signal or native terminal restoration. These contracts
 * therefore require a deterministic lifecycle trace and runnable test that exercise the public host.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createHost, createLogger, evaluateEssentials, resolveCapabilities } from '@jsvision/core';
import type { HostSignal, RuntimeAdapter, TimerHandle } from '@jsvision/core';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';

const guidePath = fileURLToPath(new URL('../guide/crash-safety.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const fixturePath = fileURLToPath(new URL('../src/example-fixtures/crash-safety/lifecycle-trace.ts', import.meta.url));
const artifactPath = fileURLToPath(new URL('./crash-safety-example.spec.test.ts', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const fixtureSource = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : '';
const artifactSource = existsSync(artifactPath) ? readFileSync(artifactPath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'crash-safety');
const exactException =
  'A browser terminal cannot prove native raw-mode, alternate-screen, cursor, or process-signal restoration.';
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    mouse: { sgr: true, drag: true, wheel: true },
    altScreen: true,
    bracketedPaste: true,
  },
}).profile;

class ExitRequest extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

class RecordingRuntime implements RuntimeAdapter {
  readonly platform = 'linux';
  readonly trace: string[] = [];
  private readonly signals = new Map<HostSignal, Set<() => void>>();
  private readonly uncaught = new Set<(error: unknown) => void>();
  private readonly rejections = new Set<(reason: unknown) => void>();
  private readonly processExit = new Set<() => void>();

  setRawMode(_stream: NodeJS.ReadStream, on: boolean): void {
    this.trace.push(`raw:${String(on)}`);
  }

  on(signal: HostSignal, handler: () => void): () => void {
    const handlers = this.signals.get(signal) ?? new Set<() => void>();
    handlers.add(handler);
    this.signals.set(signal, handlers);
    return () => handlers.delete(handler);
  }

  onUncaughtException(handler: (error: unknown) => void): () => void {
    this.uncaught.add(handler);
    return () => this.uncaught.delete(handler);
  }

  onUnhandledRejection(handler: (reason: unknown) => void): () => void {
    this.rejections.add(handler);
    return () => this.rejections.delete(handler);
  }

  suspendSelf(): void {
    this.trace.push('suspend');
  }

  scheduleImmediate(fn: () => void): void {
    fn();
  }

  setTimer(fn: () => void, _ms: number): TimerHandle {
    return fn;
  }

  clearTimer(_handle: TimerHandle): void {}

  onProcessExit(handler: () => void): () => void {
    this.processExit.add(handler);
    return () => this.processExit.delete(handler);
  }

  writeSync(_fd: number, _data: string): void {
    this.trace.push('restore:sync');
  }

  exit(code: number): never {
    this.trace.push(`exit:${code}`);
    throw new ExitRequest(code);
  }

  writeError(message: string): void {
    this.trace.push(`diagnostic:${message.includes('secret') ? 'unsafe' : 'safe'}`);
  }

  warn(_message: string): void {
    this.trace.push('warning');
  }

  emit(signal: HostSignal): void {
    for (const handler of [...(this.signals.get(signal) ?? [])]) handler();
  }

  emitUncaught(error: unknown): void {
    for (const handler of [...this.uncaught]) handler(error);
  }

  get ownedHandlers(): number {
    return (
      [...this.signals.values()].reduce((total, handlers) => total + handlers.size, 0) +
      this.uncaught.size +
      this.rejections.size +
      this.processExit.size
    );
  }
}

function terminalStreams(): {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
  writes: string[];
} {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    setRawMode(on: boolean): void;
  };
  input.isTTY = true;
  input.setRawMode = () => {};
  const writes: string[] = [];
  const output = new PassThrough() as PassThrough & {
    isTTY: boolean;
    columns: number;
    rows: number;
    fd: number;
  };
  output.isTTY = true;
  output.columns = 80;
  output.rows = 24;
  output.fd = 1;
  output.on('data', (chunk: Buffer) => writes.push(chunk.toString()));
  return {
    input: input as unknown as NodeJS.ReadStream,
    output: output as unknown as NodeJS.WriteStream,
    writes,
  };
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

describe('Crash safety course and authentic-substitute contract', () => {
  test('should publish the completed zero-lab catalog contract with its exact exception', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Crash safety & terminal restore',
      group: 'Operating a real app',
      page: '/guide/crash-safety',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 2,
      prerequisites: ['application-shell', 'debugging'],
      learningOutcomes: [
        'Explain restoration guarantees across normal exit, exceptions, and process signals.',
        'Distinguish essential terminal requirements from graceful capability degradations.',
      ],
      requiredLiveExamples: 0,
      liveExampleException: exactException,
      examples: [],
    });
    expect(source).toContain('](/guide/application-shell)');
    expect(source).toContain('](/guide/debugging)');
    expect(source).not.toContain('<PlayExample');
    expect(EXAMPLES.some((candidate) => candidate.id.startsWith('guides/crash-safety'))).toBe(false);
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the terminal-ownership mental model?',
      '## How do I get the first safe lifecycle?',
      '## What is the authentic lifecycle artifact?',
      '## What does the host own?',
      '## What happens on normal exit?',
      '## What happens when work throws or rejects?',
      '## What happens on process signals?',
      '## How does partial startup remain recoverable?',
      '## Why must restoration be idempotent?',
      '## Who owns process handlers?',
      '## What is essential and what degrades gracefully?',
      '## How do I collect safe lifecycle diagnostics?',
      '## How do I compose crash safety with the application shell?',
      '## What belongs in advanced restoration?',
      '## How do I diagnose restoration failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:normal|exit).+(?:exception|signal).+(?:restore|terminal)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach one owner and one restoration invariant across every exit path', () => {
    expect(source).toMatch(/(?:host|Application\.run|app\.run)[\s\S]{0,400}(?:owns|owner)[\s\S]{0,300}terminal/iu);
    expect(source).toMatch(
      /(?:raw mode|cooked mode)[\s\S]{0,350}(?:alternate screen|main screen)[\s\S]{0,350}cursor/iu,
    );
    expect(source).toMatch(/normal exit[\s\S]{0,450}(?:finally|stop\(\)|restore)/iu);
    expect(source).toMatch(
      /(?:uncaught exception|exception|throw)[\s\S]{0,450}(?:restore|diagnostic)[\s\S]{0,250}(?:exit 1|code 1)/iu,
    );
    expect(source).toMatch(/unhandled rejection[\s\S]{0,450}(?:restore|diagnostic)[\s\S]{0,250}(?:exit 1|code 1)/iu);
    expect(source).toMatch(/(?:SIGINT|interrupt)[\s\S]{0,250}130[\s\S]{0,400}(?:SIGTERM|terminate)[\s\S]{0,250}143/iu);
    expect(source).toMatch(/(?:SIGHUP|hangup)[\s\S]{0,250}129/iu);
    expect(source).toMatch(/restore[\s\S]{0,250}(?:before|then)[\s\S]{0,250}(?:diagnostic|onBeforeExit|exit)/iu);
  });

  test('should teach partial start, the synchronous backstop, and idempotent best-effort restore', () => {
    expect(source).toMatch(
      /(?:backstop|process exit handler)[\s\S]{0,450}(?:before|first)[\s\S]{0,300}(?:raw|alternate|enter|setup)/iu,
    );
    expect(source).toMatch(/partial(?:ly)? (?:start|setup)|mid-setup|start\(\) throws/iu);
    expect(source).toMatch(/(?:writeSync|synchronous write)[\s\S]{0,350}(?:event loop|draining|exit)/iu);
    expect(source).toMatch(/(?:idempotent|at most once|exactly once)[\s\S]{0,350}(?:signal|stop|backstop|repeated)/iu);
    expect(source).toMatch(/(?:best-effort|swallow)[\s\S]{0,350}(?:secondary|restore)[\s\S]{0,300}(?:failure|throw)/iu);
    expect(source).toMatch(/(?:non-TTY|not entered)[\s\S]{0,350}(?:nothing to restore|no-op|skip)/iu);
  });

  test('should teach exact handler ownership, chaining boundaries, and removal', () => {
    expect(source).toMatch(
      /(?:installs|registers)[\s\S]{0,350}(?:SIGINT|signal)[\s\S]{0,300}(?:uncaughtException|unhandledRejection)/iu,
    );
    expect(source).toMatch(
      /(?:unsubscribe|remove|detach)[\s\S]{0,350}(?:handler|listener)[\s\S]{0,250}(?:stop|teardown)/iu,
    );
    expect(source).toMatch(
      /(?:does not remove|must not remove|preserve)[\s\S]{0,350}(?:pre-existing|application-owned|other) handler/iu,
    );
    expect(source).toMatch(
      /(?:chain|delegate|onBeforeExit)[\s\S]{0,400}(?:supervisor|telemetry|application cleanup)/iu,
    );
    expect(source).toMatch(
      /(?:never|do not|avoid)[\s\S]{0,350}(?:competing|duplicate|second)[\s\S]{0,250}(?:signal|uncaught|restore) handler/iu,
    );
    expect(source).toMatch(/exitOnSignal[\s\S]{0,300}(?:default|true)[\s\S]{0,300}(?:false|embed|supervisor)/iu);
  });

  test('should separate the one essential requirement from capability degradation', () => {
    expect(source).toMatch(/interactive TTY[\s\S]{0,350}(?:only|single)[\s\S]{0,250}(?:essential|hard requirement)/iu);
    expect(source).toMatch(/evaluateEssentials\([\s\S]{0,350}(?:met|missing|degradations)/iu);
    expect(source).toMatch(/assertEssentials\([\s\S]{0,350}(?:before|start|throws)/iu);
    expect(source).toMatch(/mouse[\s\S]{0,250}keyboard-only/iu);
    expect(source).toMatch(/(?:no colour|no color|mono)[\s\S]{0,250}monochrome/iu);
    expect(source).toMatch(/(?:no alternate screen|altScreen)[\s\S]{0,250}inline/iu);
    expect(source).toMatch(
      /(?:degradation|fallback)[\s\S]{0,300}(?:must not|does not|never)[\s\S]{0,200}(?:prevent|block|refuse|fail) (?:start|startup)/iu,
    );
  });

  test('should teach signal suspension separately from terminating signals', () => {
    expect(source).toMatch(
      /(?:SIGTSTP|suspend)[\s\S]{0,350}(?:soft leave|cooked|raw off)[\s\S]{0,300}(?:backstop|armed)/iu,
    );
    expect(source).toMatch(
      /(?:SIGCONT|continue|resume)[\s\S]{0,350}(?:re-enter|re-assert)[\s\S]{0,300}(?:repaint|last frame)/iu,
    );
    expect(source).toMatch(/(?:Windows|win32)[\s\S]{0,350}(?:inert|not available|no-op|platform)/iu);
    expect(source).not.toMatch(/(?:SIGTSTP|suspend)[\s\S]{0,250}(?:exit 148|terminating exit)/iu);
  });

  test('should keep crash diagnostics safe, ordered, and distinct from active-screen logging', () => {
    expect(source).toMatch(
      /(?:restore|leave terminal)[\s\S]{0,300}(?:before|then)[\s\S]{0,250}(?:writeError|stderr|diagnostic)/iu,
    );
    expect(source).toMatch(/createLogger\([\s\S]{0,350}(?:ring|file|screen-safe)/iu);
    expect(source).toMatch(/(?:never|do not|avoid)[\s\S]{0,350}(?:raw input|paste|token|secret)/iu);
    expect(source).toMatch(/(?:redact|sanitize)[\s\S]{0,350}(?:error|diagnostic|field|context)/iu);
    expect(source).toMatch(/(?:bounded|size|capacity)[\s\S]{0,300}(?:log|trace|diagnostic)/iu);
    expect(source).toMatch(/(?:console\.log|stdout)[\s\S]{0,350}(?:corrupt|active terminal|UI stream)/iu);
  });

  test('should keep snippets concise and public and close with failure evidence and next steps', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/core\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui', 'vitest']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const api of [
      'createApplication',
      'run',
      'createHost',
      'start',
      'stop',
      'evaluateEssentials',
      'assertEssentials',
      'onBeforeExit',
      'exitOnSignal',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(
      /(?:exercise|experiment)[\s\S]{0,1200}(?:normal|exception|signal|partial|idempotent|degradation)/iu,
    );
    expect(source).toContain('](/api/core/functions/createHost)');
    expect(source).toContain('](/api/core/functions/evaluateEssentials)');
    expect(source).toContain('](/api/core/functions/assertEssentials)');
    expect(source).toContain('](/api/ui/functions/createApplication)');
  });

  test('should provide a deterministic annotated trace and authentic runnable test', () => {
    expect(fixtureSource, 'missing native lifecycle trace fixture').not.toBe('');
    expect(artifactSource, 'missing authentic crash-safety test artifact').not.toBe('');
    expect(fixtureSource).toMatch(/from\s+['"]@jsvision\/core['"]/u);
    expect(fixtureSource).toMatch(/createHost[\s\S]{0,600}RuntimeAdapter/iu);
    expect(fixtureSource).toMatch(/(?:normal|exception|rejection|interrupt|terminate|hangup|partial-start)/iu);
    expect(fixtureSource).toMatch(/(?:sequence|trace|step)[\s\S]{0,400}(?:restore|raw|screen|cursor|exit)/iu);
    expect(fixtureSource).toMatch(/(?:redact|safe|secret)[\s\S]{0,400}(?:bounded|capacity|limit)/iu);
    expect(fixtureSource).not.toMatch(/(?:process\.kill|process\.exit|process\.stdin|\/dev\/tty|setTimeout)/u);
    expect(artifactSource).toMatch(/from\s+['"]vitest['"]/u);
    expect(artifactSource).toMatch(/example-fixtures\/crash-safety\/lifecycle-trace/u);
    expect(artifactSource).toMatch(/normal[\s\S]{0,700}(?:exception|rejection)[\s\S]{0,700}(?:signal|interrupt)/iu);
    expect(artifactSource).toMatch(/partial(?:-start| start)[\s\S]{0,500}(?:backstop|sync|restore)/iu);
    expect(artifactSource).toMatch(
      /(?:idempotent|at most once|exactly once)[\s\S]{0,500}(?:handler|remove|teardown)/iu,
    );
    expect(artifactSource).not.toMatch(/(?:document\.|window\.|@xterm|PlayExample|Template1Dialog)/u);
    expect(source).toContain(
      '](https://github.com/blendsdk/jsvision/blob/master/packages/docs-site/src/example-fixtures/crash-safety/lifecycle-trace.ts)',
    );
    expect(source).toContain(
      '](https://github.com/blendsdk/jsvision/blob/master/packages/docs-site/test/crash-safety-example.spec.test.ts)',
    );
  });
});

describe('public crash-safety controls taught by the course', () => {
  test('should reject a missing essential while preserving graceful degradation', () => {
    const reduced = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: {
        colorDepth: 'mono',
        mouse: { sgr: false, drag: false, wheel: false },
        altScreen: false,
      },
    }).profile;

    expect(evaluateEssentials(reduced, { isTTY: false })).toEqual({
      met: false,
      missing: ['interactive TTY (raw-mode keyboard input)'],
      degradations: [
        { cap: 'mouse', mode: 'keyboard-only', message: 'Mouse unavailable: keyboard-only mode.' },
        { cap: 'color', mode: 'monochrome', message: 'No color: monochrome rendering.' },
        { cap: 'altScreen', mode: 'inline', message: 'No alternate screen: inline fallback.' },
      ],
    });
    expect(evaluateEssentials(reduced, { isTTY: true }).met).toBe(true);
  });

  test('should restore normal host ownership once and remove every installed handler', async () => {
    const runtime = new RecordingRuntime();
    const streams = terminalStreams();
    const host = createHost({
      caps,
      runtime,
      input: streams.input,
      output: streams.output,
      warnAmbiguousWidth: false,
    });

    await host.start();
    expect(runtime.ownedHandlers).toBeGreaterThan(0);
    await host.stop();
    await host.stop();
    expect(runtime.trace.filter((step) => step === 'raw:true')).toHaveLength(1);
    expect(runtime.trace.filter((step) => step === 'raw:false')).toHaveLength(1);
    expect(runtime.ownedHandlers).toBe(0);
  });

  test.each([
    ['interrupt', 130],
    ['terminate', 143],
    ['hangup', 129],
  ] as const)('should restore before %s exits with code %i', async (signal, code) => {
    const runtime = new RecordingRuntime();
    const streams = terminalStreams();
    const beforeExit: number[] = [];
    const host = createHost({
      caps,
      runtime,
      input: streams.input,
      output: streams.output,
      warnAmbiguousWidth: false,
      onBeforeExit: (value) => {
        runtime.trace.push(`before-exit:${value}`);
        beforeExit.push(value);
      },
    });
    await host.start();
    expect(() => runtime.emit(signal)).toThrow(ExitRequest);
    expect(beforeExit).toEqual([code]);
    const restoreAt = runtime.trace.indexOf('raw:false');
    const hookAt = runtime.trace.indexOf(`before-exit:${code}`);
    const exitAt = runtime.trace.indexOf(`exit:${code}`);
    expect(restoreAt).toBeGreaterThanOrEqual(0);
    expect(hookAt).toBeGreaterThan(restoreAt);
    expect(exitAt).toBeGreaterThan(hookAt);
  });

  test('should restore before emitting a fatal diagnostic and exit code 1', async () => {
    const runtime = new RecordingRuntime();
    const streams = terminalStreams();
    const logger = createLogger({ sink: 'ring', size: 2 });
    const host = createHost({
      caps,
      runtime,
      input: streams.input,
      output: streams.output,
      warnAmbiguousWidth: false,
      onBeforeExit: (code) => logger.error('lifecycle', 'fatal exit', { code }),
    });
    await host.start();
    expect(() => runtime.emitUncaught(new Error('bounded failure'))).toThrow(ExitRequest);
    const restoreAt = runtime.trace.indexOf('raw:false');
    const diagnosticAt = runtime.trace.indexOf('diagnostic:safe');
    const exitAt = runtime.trace.indexOf('exit:1');
    expect(diagnosticAt).toBeGreaterThan(restoreAt);
    expect(exitAt).toBeGreaterThan(diagnosticAt);
    expect(logger.entries()).toHaveLength(1);
    expect(JSON.stringify(logger.entries())).not.toContain('visitor-secret');
  });
});
