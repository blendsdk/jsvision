// Hand-written declaration for the JS static footgun linter (jsvision-doctor.mjs). It has no
// build step of its own, so this file exists only to let TS test files import it without
// TS7016/TS7006. It declares just the two exports the spec test consumes (lintText, lintPaths);
// formatFindings stays untyped since no test imports it.

/** One footgun finding: a source location plus the rule that fired and its human-readable fix. */
export interface DoctorFinding {
  readonly file: string;
  readonly line: number;
  readonly level: 'error' | 'warn' | 'info';
  readonly rule: string;
  readonly message: string;
}

/**
 * Lint one file's TypeScript source text for the documented jsvision footguns. Pure — parses the
 * syntax tree only, no type-checking and no filesystem access. Findings are line-sorted.
 */
export declare function lintText(source: string, fileName?: string): DoctorFinding[];

/**
 * Lint every `.ts` source file under the given files/directories (skipping node_modules, dist,
 * .turbo, and test files), reusing `lintText` per file.
 */
export declare function lintPaths(paths: readonly string[], cwd?: string): DoctorFinding[];
