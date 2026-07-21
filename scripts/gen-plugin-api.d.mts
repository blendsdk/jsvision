// Hand-written declaration for the JS plugin-API-reference generator (gen-plugin-api.mjs).
// The script has no build step of its own, so this file exists only to let TS test files
// import it without TS7016/TS7006. It declares just the four exports the spec test consumes,
// not the full module surface (renderExport/renderCategory/writeApiDocs/PACKAGES stay untyped).

/** One entry in the API reference's category index (`gen-plugin-api.mjs`'s `CATEGORIES`). */
export interface ApiCategory {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
}

/** Category order + titles; the slug doubles as each generated page's file name (sans `.md`). */
export declare const CATEGORIES: readonly ApiCategory[];

/**
 * The category slug an export belongs to, given the package it came from and its declaration
 * file's repo-relative path.
 */
export declare function categoryFor(pkg: string, file: string): string;

/**
 * Generate the whole API reference in memory: every rendered page keyed by its relative file
 * name, plus the flat, sorted list of every covered export's name.
 */
export declare function generateApiDocs(rootDir?: string): {
  files: Record<string, string>;
  names: string[];
};

/**
 * Compare the committed API reference on disk against a fresh generation. Returns one
 * human-readable message per file that is missing, stale, or out of date; empty when in sync.
 */
export declare function checkApiDrift(rootDir?: string): string[];
