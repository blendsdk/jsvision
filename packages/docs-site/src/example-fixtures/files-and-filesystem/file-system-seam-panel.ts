import { scanDirectory } from '@jsvision/files';
import type { FileSystem } from '@jsvision/files';
import { Group, Text, at, signal } from '@jsvision/ui';
import { createBrowserFileSystem } from '@jsvision/web';

/** Input route reported by the laboratory without relying on colour. */
export type FileSystemActionSource = 'ready' | 'keyboard' | 'mouse';

/** Adapter selected by the host-neutral workflow. */
export type FileSystemAdapter = 'browser virtual' | 'application-defined';

const ROOT = '/workspace';
const README = `${ROOT}/readme.txt`;
const MISSING = `${ROOT}/missing.txt`;
const TREE = {
  [ROOT]: {
    'notes.txt': 'safe notes',
    'readme.txt': 'hello from the seam',
    src: { 'main.ts': 'export const answer = 42;' },
  },
};

/**
 * Interactive proof that the same scan/read/write workflow runs over two injected filesystems.
 *
 * The browser adapter is a bounded in-memory tree. The application-defined adapter wraps a second
 * virtual tree with an explicit root policy and deterministic one-shot denial.
 */
export class FileSystemSeamPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Host-neutral file workflows';

  /** Number of real directory scans. */
  public scanRuns = 0;

  /** Number of successful file reads. */
  public readRuns = 0;

  /** Number of successful file writes. */
  public writeRuns = 0;

  /** Number of policy-denied operations. */
  public deniedRuns = 0;

  /** Number of non-policy filesystem failures. */
  public failedRuns = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Pure in-memory filesystem used by the browser route. */
  public readonly browserFileSystem = createBrowserFileSystem({ tree: TREE, home: ROOT });

  /** Application-owned filesystem with a confined root and explicit denial policy. */
  public readonly customFileSystem: FileSystem;

  /** Current adapter label. */
  protected readonly adapter = signal<FileSystemAdapter>('browser virtual');

  /** Latest sorted directory result. */
  protected readonly scanResult = signal('not run');

  /** Latest file read result. */
  protected readonly readResult = signal('not run');

  /** Latest file write result. */
  protected readonly writeResult = signal('not run');

  /** Selection/cancellation result. */
  protected readonly selection = signal('ready');

  /** Current operation status. */
  protected readonly status = signal('idle');

  /** Most recent interaction route. */
  protected readonly actionSource = signal<FileSystemActionSource>('ready');

  /** Reactive invalidation token for public counters. */
  protected readonly counterVersion = signal(0);

  /** One-shot custom-adapter denial switch. */
  private denyNextRead = false;

  /** Build the two adapters and their non-colour evidence readout. */
  public constructor() {
    super();
    const customBase = createBrowserFileSystem({ tree: TREE, home: ROOT });
    const authorize = (path: string): string => {
      const resolved = customBase.resolve(path);
      if (resolved !== ROOT && !resolved.startsWith(`${ROOT}/`)) {
        throw new Error('Access denied by application root policy');
      }
      return resolved;
    };
    this.customFileSystem = {
      ...customBase,
      readDir: (path) => customBase.readDir(authorize(path)),
      stat: (path) => customBase.stat(authorize(path)),
      lstat: (path) => customBase.lstat(authorize(path)),
      readFile: (path) => {
        const resolved = authorize(path);
        if (this.denyNextRead) {
          this.denyNextRead = false;
          throw Object.assign(new Error('Access denied by application policy'), {
            code: 'EACCES',
          });
        }
        return customBase.readFile(resolved);
      },
      writeFile: (path, text) => customBase.writeFile(authorize(path), text),
      rename: (from, to) => customBase.rename(authorize(from), authorize(to)),
      unlink: (path) => customBase.unlink(authorize(path)),
    };

    this.add(at(new Text(() => `Adapter: ${this.adapter()}`), 0, 0, 60, 1));
    this.add(at(new Text('Node: nodeFileSystem runs only in an authorized native host; not run here.'), 0, 1, 60, 1));
    this.add(at(new Text('No visitor files or network · both active adapters are in-memory.'), 0, 2, 60, 1));
    this.add(at(new Text(() => `Scan: *.txt · ${this.scanResult()}`), 0, 4, 60, 1));
    this.add(at(new Text(() => `Read: ${this.readResult()}`), 0, 5, 60, 1));
    this.add(at(new Text(() => `Write: ${this.writeResult()}`), 0, 6, 60, 1));
    this.add(at(new Text(() => `Selection: ${this.selection()}`), 0, 7, 60, 1));
    this.add(at(new Text(() => `Status: ${this.status()}`), 0, 8, 60, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 9, 60, 1));
    this.add(
      at(
        new Text(() => {
          this.counterVersion();
          return `Runs: scan ${this.scanRuns} · read ${this.readRuns} · write ${this.writeRuns} · denied ${this.deniedRuns} · failed ${this.failedRuns}`;
        }),
        0,
        10,
        60,
        1,
      ),
    );
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Scan the deterministic project through the currently selected adapter. */
  public scan(source: Exclude<FileSystemActionSource, 'ready'>): void {
    const entries = scanDirectory(this.activeFileSystem(), ROOT, { wildcard: '*.txt' });
    this.scanRuns += 1;
    this.bump(source);
    this.scanResult.set(
      entries
        .filter((entry) => entry.name !== '..')
        .map((entry) => (entry.kind === 'dir' ? `${entry.name}/ directory` : entry.name))
        .join(', '),
    );
    this.status.set('scan complete');
  }

  /** Read the stable text file or expose a bounded policy-denial diagnostic. */
  public read(source: Exclude<FileSystemActionSource, 'ready'>): void {
    this.readPath(README, 'readme.txt', source);
  }

  /** Read a missing in-root path so operational failure remains distinct from denial. */
  public readMissing(source: Exclude<FileSystemActionSource, 'ready'>): void {
    this.readPath(MISSING, 'missing.txt', source);
  }

  /** Read one path and classify policy denial separately from other adapter failures. */
  protected readPath(path: string, label: string, source: Exclude<FileSystemActionSource, 'ready'>): void {
    try {
      const content = this.activeFileSystem().readFile(path);
      this.readRuns += 1;
      this.readResult.set(`${label} · Content: ${content}`);
      this.status.set('read complete');
    } catch (cause) {
      if (this.hasErrorCode(cause, 'EACCES')) {
        this.deniedRuns += 1;
        this.status.set('denied · bounded safe diagnostic: application policy refused access');
      } else {
        this.failedRuns += 1;
        this.status.set('missing · bounded safe diagnostic: file unavailable');
      }
    }
    this.bump(source);
  }

  /** Replace the stable file through the selected adapter and report the committed value. */
  public write(source: Exclude<FileSystemActionSource, 'ready'>): void {
    this.activeFileSystem().writeFile(README, 'updated through injected seam');
    this.writeRuns += 1;
    this.writeResult.set('success · updated and saved');
    this.status.set('write complete');
    this.bump(source);
  }

  /** Switch the unchanged workflow to the application-owned adapter. */
  public useApplicationAdapter(source: Exclude<FileSystemActionSource, 'ready'>): void {
    this.adapter.set('application-defined');
    this.selection.set('application adapter selected');
    this.status.set('policy adapter ready');
    this.bump(source);
  }

  /** Arm one explicit access denial on the application-owned adapter. */
  public armDenial(source: Exclude<FileSystemActionSource, 'ready'>): void {
    this.adapter.set('application-defined');
    this.selection.set('application adapter selected for denial');
    this.denyNextRead = true;
    this.status.set('denial armed');
    this.bump(source);
  }

  /** Return the adapter currently authorized by the laboratory. */
  protected activeFileSystem(): FileSystem {
    return this.adapter() === 'browser virtual' ? this.browserFileSystem : this.customFileSystem;
  }

  /** Check a host error code without unsafe casts or trusting arbitrary exception shapes. */
  protected hasErrorCode(value: unknown, code: string): boolean {
    return typeof value === 'object' && value !== null && 'code' in value && value.code === code;
  }

  /** Publish the route and invalidate the counter row. */
  protected bump(source: Exclude<FileSystemActionSource, 'ready'>): void {
    this.actionSource.set(source);
    this.counterVersion.update((current) => current + 1);
  }
}
