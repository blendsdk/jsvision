import type { FileSystem } from '@jsvision/files';

/** Deterministic failure modes exercised by the file-component documentation. */
export type FileSystemFault = 'none' | 'denied' | 'io-error';

/** A test-only filesystem wrapper with resettable read/write failures and a confined virtual root. */
export interface FaultFileSystem extends FileSystem {
  /** Select the failure returned by subsequent data operations. */
  setFault(fault: FileSystemFault): void;
  /** Restore normal operation. */
  reset(): void;
}

/**
 * Wrap a virtual filesystem with deterministic authorization and I/O failures.
 *
 * Path-taking data operations are confined to `root`. Pure path helpers remain available so widgets
 * can normalize and present a rejected path without touching a host filesystem.
 */
export function createFaultFileSystem(base: FileSystem, root: string): FaultFileSystem {
  const allowedRoot = base.resolve(root);
  let fault: FileSystemFault = 'none';

  const checked = (path: string): string => {
    if (!base.isAbsolute(path)) throw new Error('virtual paths must be absolute');
    const resolved = base.resolve(path);
    if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}${base.sep}`)) {
      throw new Error('virtual path escapes the documentation fixture');
    }
    if (fault === 'denied') throw Object.assign(new Error('EACCES: fixture access denied'), { code: 'EACCES' });
    if (fault === 'io-error') throw Object.assign(new Error('EIO: fixture I/O error'), { code: 'EIO' });
    return resolved;
  };

  return {
    ...base,
    readDir: (path) => base.readDir(checked(path)),
    stat: (path) => base.stat(checked(path)),
    lstat: (path) => base.lstat(checked(path)),
    readFile: (path) => base.readFile(checked(path)),
    writeFile: (path, text) => base.writeFile(checked(path), text),
    rename: (from, to) => base.rename(checked(from), checked(to)),
    unlink: (path) => base.unlink(checked(path)),
    setFault: (next) => {
      fault = next;
    },
    reset: () => {
      fault = 'none';
    },
  };
}
