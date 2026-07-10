/**
 * Test harness for the Play controller: synthetic example entries, a counting
 * `@xterm/headless` terminal factory (real emulator buffer, tracked live count),
 * and a hand-mocked keydown target for the key-reclaim assertions. No jsdom.
 *
 * `@xterm/headless` is a CommonJS package: default-import then destructure.
 * The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import xtermHeadless from '@xterm/headless';
import type { Terminal as XTerm } from '@xterm/headless';
import { View } from '@jsvision/ui';
import type { Application, DrawContext } from '@jsvision/ui';
import { defineExample } from '../../examples/_contract.js';
import type { ExampleContext } from '../../examples/_contract.js';
import type { ExampleEntry } from '../../examples/index.js';

const { Terminal } = xtermHeadless;

/** A guaranteed-painting content view (fills its bounds + a marker label). */
class Marker extends View {
  override draw(ctx: DrawContext): void {
    const role = ctx.role('window');
    const style = { fg: role.fg, bg: role.bg };
    ctx.fill(' ', style);
    ctx.text(0, 0, 'BODY', style);
  }
}

/** A sized marker component to hand a synthetic example's `build()`. */
export function markerContent(): View {
  const m = new Marker();
  m.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 4 } };
  return m;
}

/** Build a synthetic registry entry backed by an inline `defineExample`. */
export function fakeEntry(
  kind: 'component' | 'app',
  build: (ctx: ExampleContext) => Application | View,
  id = 'test/example',
): ExampleEntry {
  return {
    id,
    category: 'test',
    kind,
    sourcePath: `examples/${id}.ts`,
    load: () => Promise.resolve({ default: defineExample({ title: 'Test', blurb: 'A synthetic example.', build }) }),
  };
}

/** The narrow terminal shape `mountApp` needs (structurally an `@xterm/web` TerminalLike). */
export interface HarnessTerminal {
  /** Current column count (delegates to the real emulator) — the controller reads this to size the app. */
  readonly cols: number;
  /** Current row count (delegates to the real emulator). */
  readonly rows: number;
  write(data: string): void;
  onData(handler: (data: string) => void): { dispose(): void };
  onResize(handler: (size: { cols: number; rows: number }) => void): { dispose(): void };
  /** Resize the emulator (fires `onResize`) — drives the live-resize path in tests. */
  resize(cols: number, rows: number): void;
  dispose(): void;
}

/** A counting factory: each `createTerminal` wraps a real headless emulator + tracks the live count. */
export interface HeadlessFactory {
  createTerminal(): HarnessTerminal;
  /** Number of live (created but not disposed) terminals. */
  live(): number;
  /** The most recently created real emulator (to read its buffer). */
  lastReal(): XTerm | null;
}

/** Build a {@link HeadlessFactory}. */
export function headlessFactory(cols = 80, rows = 24): HeadlessFactory {
  let count = 0;
  let last: XTerm | null = null;
  return {
    createTerminal(): HarnessTerminal {
      const real = new Terminal({ cols, rows, allowProposedApi: true });
      last = real;
      count += 1;
      return {
        get cols() {
          return real.cols;
        },
        get rows() {
          return real.rows;
        },
        write: (data) => real.write(data),
        onData: (handler) => real.onData(handler),
        onResize: (handler) => real.onResize(handler),
        resize: (c, r) => real.resize(c, r),
        dispose: () => {
          count -= 1;
          real.dispose();
        },
      };
    },
    live: () => count,
    lastReal: () => last,
  };
}

/** Flush the emulator's async write queue (a trailing empty write resolves after prior writes parse). */
export function flushTerminal(term: XTerm): Promise<void> {
  return new Promise<void>((resolve) => term.write('', () => resolve()));
}

/** True if any cell holds a visible (non-space) glyph. */
export function hasContent(term: XTerm): boolean {
  const active = term.buffer.active;
  for (let y = 0; y < term.rows; y += 1) {
    const line = active.getLine(y);
    if (!line) continue;
    for (let x = 0; x < term.cols; x += 1) {
      const chars = line.getCell(x)?.getChars();
      if (chars && chars !== ' ') return true;
    }
  }
  return false;
}

/** The text of one emulator row. */
export function rowText(term: XTerm, y: number): string {
  const line = term.buffer.active.getLine(y);
  if (!line) return '';
  let s = '';
  for (let x = 0; x < term.cols; x += 1) s += line.getCell(x)?.getChars() || ' ';
  return s;
}

/** A minimal keydown event matching the reclaim matcher's `ReclaimKeyEvent`. */
export interface FakeKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  preventDefault(): void;
  readonly defaultPrevented: boolean;
}

/** Build a fake keydown event for `key` (no modifiers). */
export function keydownEvent(key: string): FakeKeyEvent {
  let prevented = false;
  return {
    key,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  };
}

/** A hand-mocked event target the reclaim listener attaches to (no jsdom). */
export interface FakeKeyTarget {
  addEventListener(type: string, handler: (event: FakeKeyEvent) => void, options?: { capture?: boolean }): void;
  removeEventListener(type: string, handler: (event: FakeKeyEvent) => void, options?: { capture?: boolean }): void;
  readonly activeElement: null;
  /** Dispatch `event` to every registered handler for `type`. */
  fire(type: string, event: FakeKeyEvent): void;
}

/** Build a {@link FakeKeyTarget}. */
export function fakeKeyTarget(): FakeKeyTarget {
  const handlers = new Map<string, Set<(event: FakeKeyEvent) => void>>();
  return {
    addEventListener(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
    },
    removeEventListener(type, handler) {
      handlers.get(type)?.delete(handler);
    },
    activeElement: null,
    fire(type, event) {
      for (const handler of handlers.get(type) ?? []) handler(event);
    },
  };
}
