// Hand-written declaration for new-jsvision-app.mjs (plain Node ESM scaffolder
// script, run directly via `node` and imported cross-root by the examples
// package's tests). Declares only the exports the spec/impl tests consume —
// the CLI parsing/entry point (`parseArgs`, `cli`) has no exported surface.

/** One available archetype: its slug and one-line description. */
interface ArchetypeInfo {
  name: string;
  description: string;
}

/** Options accepted by {@link writeApp}. */
interface WriteAppOptions {
  /** Defaults to the current working directory. */
  root?: string;
  /** Defaults to {@link DEFAULT_ARCHETYPE}. */
  archetype?: string;
}

/** What {@link writeApp} reports after materializing a package on disk. */
interface WriteAppResult {
  /** The chosen (slugified) package slug. */
  slug: string;
  /** The repo-relative package directory, e.g. `packages/todo`. */
  dir: string;
  /** The repo-relative paths written. */
  files: string[];
}

/** The default archetype: the plain starter, using only the base skeleton. */
export declare const DEFAULT_ARCHETYPE: 'basic';

/**
 * List the available archetypes — `basic` first, then the discovered ones,
 * alphabetically.
 *
 * @returns Each archetype's slug and one-line description.
 */
export declare function listArchetypes(): ArchetypeInfo[];

/**
 * Normalize a human app name into a package-safe slug: lowercase,
 * spaces/underscores to dashes, anything outside `[a-z0-9-]` stripped,
 * repeated dashes collapsed, and leading/trailing dashes trimmed. Names that
 * could escape `packages/<slug>/` are rejected outright.
 *
 * @param name The raw app name.
 * @returns The package slug (e.g. `my-app`).
 * @throws If the name is unsafe or normalizes to nothing usable.
 */
export declare function slugify(name: string): string;

/**
 * The `@jsvision/ui` dependency specifier the generated `package.json` uses.
 *
 * @returns The dependency specifier (currently the workspace form `'*'`).
 */
export declare function uiDependency(): string;

/**
 * Build the full set of files for a new app, keyed by their repo-relative
 * path. Pure and fs-free — does not touch disk (see {@link writeApp}).
 *
 * @param name The raw app name (slugified internally; unsafe names throw).
 * @param archetype The archetype slug (default `basic`).
 * @returns A map of `packages/<slug>/…` paths to file contents.
 * @throws If the name is unsafe or the archetype is unknown.
 */
export declare function buildAppFiles(name: string, archetype?: string): Map<string, string>;

/**
 * Materialize a new app on disk under `<root>/packages/<slug>/`, refusing to
 * overwrite an existing package.
 *
 * @param name The raw app name.
 * @param options `root` and `archetype` overrides.
 * @returns The chosen slug, the package directory, and the paths written.
 * @throws If the name is unsafe, the archetype is unknown, or the package
 *   directory already exists.
 */
export declare function writeApp(name: string, options?: WriteAppOptions): WriteAppResult;
