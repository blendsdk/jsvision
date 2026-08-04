// Hand-written declarations for plugin-impact.mjs.
//
// TypeScript specification tests import this repository script directly under NodeNext. Keeping the
// companion declaration beside the script makes that public test seam type-safe without adding a
// build step to the maintenance command.

/** One source area and the canonical skill references that its changes can affect. */
export interface PluginImpactArea {
  readonly name: string;
  readonly paths: readonly string[];
  readonly references: readonly string[];
}

/** The persisted source-impact snapshot consumed by plugin update and integrity checks. */
export interface PluginImpactRegistry {
  readonly version: number;
  readonly areas: readonly PluginImpactArea[];
  readonly fingerprints: Readonly<Record<string, string>>;
}

/** One source area whose current fingerprint no longer matches the reviewed snapshot. */
export interface PluginImpactFinding {
  readonly name: string;
  readonly references: readonly string[];
}

/** Read and validate the repository's source-impact registry. */
export declare function readImpactRegistry(): PluginImpactRegistry;

/** Report source areas that need their mapped skill references reviewed. */
export declare function checkPluginImpact(): PluginImpactFinding[];

/** Record fresh fingerprints after every mapped reference has been reviewed. */
export declare function updatePluginImpact(): string[];
