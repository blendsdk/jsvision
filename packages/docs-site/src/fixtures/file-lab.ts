import type { FileSystem } from '@jsvision/files';
import { createBrowserFileSystem } from '@jsvision/web';
import type { FileTree } from '@jsvision/web';

/** Stable root used by every file-component laboratory. */
export const FILE_LAB_HOME = '/workspace';

/** Stable virtual project shared by the file-component laboratories. */
export const FILE_LAB_TREE: FileTree = {
  [FILE_LAB_HOME]: {
    '.env': 'MODE=demo\n',
    'README.md': '# File laboratory\n',
    'notes.txt': 'safe notes\u001b[2J\n',
    src: {
      'main.ts': 'export const answer = 42;\n',
      'view.ts': 'export const view = "classic";\n',
    },
    empty: {},
  },
};

/** Failure selected for the next filesystem data operation. */
export type DemoFileFault = 'none' | 'denied' | 'io-error';

/** Resettable virtual filesystem used by interactive file laboratories. */
export interface DemoFileSystem {
  /** Full injectable filesystem seam. */
  readonly fs: FileSystem;
  /** Select a deterministic failure for subsequent data operations. */
  setFault(fault: DemoFileFault): void;
  /** Restore normal virtual operation. */
  reset(): void;
}

/** Create a fresh isolated virtual project and resettable failure seam. */
export function createDemoFileSystem(): DemoFileSystem {
  const base = createBrowserFileSystem({
    tree: FILE_LAB_TREE,
    home: FILE_LAB_HOME,
    mtime: new Date('2026-07-15T10:30:00.000Z'),
  });
  let fault: DemoFileFault = 'none';
  const fail = (): void => {
    if (fault === 'denied') throw Object.assign(new Error('EACCES: access denied'), { code: 'EACCES' });
    if (fault === 'io-error') throw Object.assign(new Error('EIO: virtual I/O error'), { code: 'EIO' });
  };
  const fs: FileSystem = {
    ...base,
    roots: () => {
      fail();
      return base.roots();
    },
    readDir: (path) => {
      fail();
      return base.readDir(path);
    },
    stat: (path) => {
      fail();
      return base.stat(path);
    },
    lstat: (path) => {
      fail();
      return base.lstat(path);
    },
    readFile: (path) => {
      fail();
      return base.readFile(path);
    },
    writeFile: (path, text) => {
      fail();
      base.writeFile(path, text);
    },
    rename: (from, to) => {
      fail();
      base.rename(from, to);
    },
    unlink: (path) => {
      fail();
      base.unlink(path);
    },
  };
  return {
    fs,
    setFault: (next) => {
      fault = next;
    },
    reset: () => {
      fault = 'none';
    },
  };
}
