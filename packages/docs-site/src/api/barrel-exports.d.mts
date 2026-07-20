// Hand-written declaration for barrel-exports.mjs (plain ESM, no TypeScript
// loader so the generation/gate scripts can import it directly). Declares only
// the one symbol the vitest specs consume — not the internal `isInternal` helper.

/**
 * Return the sorted list of public symbol names a package barrel exports,
 * following `export *` re-exports transitively and excluding `@internal`-tagged
 * exports.
 *
 * @param entryFilePath Absolute path to a package's public entry `.ts`.
 * @returns The public export names, sorted ascending.
 */
export declare function barrelExports(entryFilePath: string): string[];
