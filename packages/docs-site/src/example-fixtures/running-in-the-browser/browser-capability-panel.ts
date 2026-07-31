import { attachKeyReclaim, buildBrowserCaps, createBrowserFileSystem, setClipboard } from '@jsvision/web';
import type { TerminalLike } from '@jsvision/web';
import { Group, Text, at, signal } from '@jsvision/ui';

type ReclaimEvent = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  preventDefault(): void;
};

/** Minimal terminal handle required by the document-level key-reclaim seam. */
const NOOP_TERMINAL: TerminalLike = {
  write: () => undefined,
  onData: () => ({ dispose: () => undefined }),
  onResize: () => ({ dispose: () => undefined }),
};

/**
 * Exercises browser authorization and capability seams using only deterministic injected fixtures.
 */
export class BrowserCapabilityPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Browser capability boundaries';

  /** Number of focused keys reclaimed from the fake browser target. */
  public reclaimedKeys = 0;

  /** Number of authorized outbound-only clipboard writes. */
  public clipboardWrites = 0;

  /** Number of denied writes caught and surfaced by the lesson. */
  public deniedClipboardWrites = 0;

  /** Number of completed virtual-file round trips. */
  public virtualFileOperations = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  protected readonly reclaimState = signal('not run');
  protected readonly clipboardState = signal('not run');
  protected readonly fileState = signal('not run');
  protected readonly actionSource = signal('ready');
  protected readonly fileSystem = createBrowserFileSystem({
    tree: { '/workspace': { 'readme.txt': 'hello browser' } },
    home: '/workspace',
  });

  /** Build the bounded authorization and isolation readout. */
  public constructor() {
    super();
    this.add(at(new Text('Fixture: bounded in-memory seams · Visitor access: none'), 0, 0, 56, 1));
    this.add(at(new Text(() => `Reclaim: ${this.reclaimState()}`), 0, 1, 56, 1));
    this.add(at(new Text(() => `Clipboard: ${this.clipboardState()}`), 0, 2, 56, 1));
    this.add(at(new Text(() => `Virtual file: ${this.fileState()} · Network: none`), 0, 3, 56, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()} · non-colour text status`), 0, 4, 56, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Prove that reclaim is focus-scoped and that detaching removes the capture listener. */
  public checkReclaim(source: 'keyboard' | 'mouse'): void {
    let handler: ((event: ReclaimEvent) => void) | undefined;
    const target = {
      addEventListener: (_type: string, next: (event: ReclaimEvent) => void) => {
        handler = next;
      },
      removeEventListener: () => {
        handler = undefined;
      },
    };
    let focused = true;
    let focusedPrevented = false;
    let unfocusedPrevented = false;
    const detach = attachKeyReclaim(NOOP_TERMINAL, { target, isFocused: () => focused });
    const event = {
      key: 'F1',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: () => {
        focusedPrevented = true;
      },
    };
    handler?.(event);
    focused = false;
    handler?.({
      ...event,
      preventDefault: () => {
        unfocusedPrevented = true;
      },
    });
    detach();
    const passed = focusedPrevented && !unfocusedPrevented && handler === undefined;
    if (passed) this.reclaimedKeys += 1;
    this.reclaimState.set(passed ? 'focused only · pass' : 'FAIL');
    this.actionSource.set(source);
  }

  /** Perform one authorized write through an injected outbound-only clipboard. */
  public copyAuthorized(source: 'keyboard' | 'mouse'): Promise<void> {
    const clipboard = {
      writeText: (_text: string) => Promise.resolve(),
    };
    this.actionSource.set(source);
    return setClipboard('bounded lesson text', buildBrowserCaps(), clipboard).then(() => {
      this.clipboardWrites += 1;
      this.clipboardState.set('authorized · written');
    });
  }

  /** Surface a deterministic permission denial without reading or logging clipboard content. */
  public copyDenied(source: 'keyboard' | 'mouse'): Promise<void> {
    this.actionSource.set(source);
    const denied = { writeText: (_text: string) => Promise.reject(new Error('permission denied')) };
    return setClipboard('bounded lesson text', buildBrowserCaps(), denied).then(
      () => {
        this.clipboardState.set('FAIL · denial unexpectedly resolved');
      },
      () => {
        this.deniedClipboardWrites += 1;
        this.clipboardState.set('denied · caught with feedback');
      },
    );
  }

  /** Read and mutate one bounded in-memory POSIX tree without disk or network access. */
  public useVirtualFile(source: 'keyboard' | 'mouse'): void {
    const original = this.fileSystem.readFile('/workspace/readme.txt');
    this.fileSystem.writeFile('/workspace/result.txt', `${original} · pass`);
    const result = this.fileSystem.readFile('/workspace/result.txt');
    this.virtualFileOperations += 1;
    this.fileState.set(result.endsWith('pass') ? 'read + written · pass' : 'FAIL');
    this.actionSource.set(source);
  }
}
