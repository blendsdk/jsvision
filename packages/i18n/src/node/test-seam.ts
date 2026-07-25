/** Test-only callbacks for deterministic Node loader race coverage. */
export interface NodeLoaderTestHooks {
  /**
   * Runs after a candidate pathname is canonicalized and before its metadata is captured.
   *
   * @param path Canonical pathname returned by the platform.
   */
  readonly afterRealpath?: (path: string) => void | Promise<void>;
  /**
   * Runs after canonicalization-time metadata is rechecked and immediately before opening.
   *
   * @param path Canonical path about to be opened.
   */
  readonly beforeOpen?: (path: string) => void | Promise<void>;
  /**
   * Runs after a canonical regular-file handle is checked and before its bytes are read.
   *
   * @param path Canonical path associated with the checked handle.
   */
  readonly afterOpen?: (path: string) => void | Promise<void>;
}

let installedHooks: NodeLoaderTestHooks = Object.freeze({});

/**
 * Install temporary Node loader hooks for a focused test.
 *
 * This module is not exported by the package. Production consumers cannot reach the seam through
 * the supported export map.
 *
 * @param hooks Hooks to install until the returned restore function runs.
 * @returns Idempotent function that restores the previously installed hooks.
 */
export function installNodeLoaderTestHooks(hooks: NodeLoaderTestHooks): () => void {
  const previous = installedHooks;
  installedHooks = Object.freeze({ ...hooks });
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    installedHooks = previous;
  };
}

/**
 * Run the installed post-open hook when a test has configured one.
 *
 * @param path Canonical checked file path.
 */
export async function runAfterOpenTestHook(path: string): Promise<void> {
  await installedHooks.afterOpen?.(path);
}

/**
 * Run the installed post-canonicalization hook when a test has configured one.
 *
 * @param path Canonical pathname awaiting metadata capture.
 */
export async function runAfterRealpathTestHook(path: string): Promise<void> {
  await installedHooks.afterRealpath?.(path);
}

/**
 * Run the installed pre-open hook when a test has configured one.
 *
 * @param path Canonical path whose metadata has just been rechecked.
 */
export async function runBeforeOpenTestHook(path: string): Promise<void> {
  await installedHooks.beforeOpen?.(path);
}
