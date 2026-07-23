// Hand-written declarations for check-plugin.mjs.
//
// TypeScript test files import this plain ESM script directly (no build step), so it needs a
// companion .d.mts to resolve under NodeNext. Only the surface the tests actually import is
// declared here — types are transcribed from the implementation's own JSDoc, not invented.

/** One deterministic drift finding: an undocumented `@jsvision/ui` widget or a drifted snippet. */
export type DriftFinding = { kind: 'undocumented-widget'; name: string } | { kind: 'snippet-drift'; module: string };

/** The plugin tree drift detection and fixing operate over — the real tree, or a temp-dir copy in tests. */
export type DriftRoots = {
  catalogPath: string;
  recipeDir: string;
  skillRoot: string;
  listClassExports: () => string[];
};

export declare const CATALOG_DENYLIST: string[];

export declare const DEFAULT_ROOTS: DriftRoots;

export declare function detectDrift(roots?: DriftRoots): DriftFinding[];

export declare function checkArchetypesValid(archetypesDir: string): string[];

export declare function checkBarrelCoverage(classNames: string[], catalogText: string, denylist: string[]): string[];

export declare function checkDrift(mdContent: string, regionText: string): string[];

export declare function checkGotchas(content: string, required: number): string[];

export declare function checkLinksInDir(dir: string): string[];

export declare function checkManifestData(
  manifest: unknown,
  marketplace: unknown,
  pluginName: string,
  sourceExists: boolean,
): string[];

export declare function countGotchas(content: string): number;

export declare function runAllChecks(): { ok: boolean; errors: string[] };
