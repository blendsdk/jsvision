/**
 * Describes the optional Node-only runtime adapter entry point.
 */
export interface CodeEditorNodeRuntime {
  readonly runtime: 'node';
}

/**
 * Creates metadata for the optional Node-only runtime adapter.
 *
 * @example
 * ```ts
 * import { createCodeEditorNodeRuntime } from '@jsvision/code-editor/node';
 *
 * const runtime = createCodeEditorNodeRuntime();
 * ```
 */
export function createCodeEditorNodeRuntime(): CodeEditorNodeRuntime {
  return { runtime: 'node' };
}
