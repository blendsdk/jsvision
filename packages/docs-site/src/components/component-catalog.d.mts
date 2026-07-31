/** Package names that may own public visual symbols. */
export type ComponentPackage = 'ui' | 'forms' | 'files' | 'datagrid' | 'code-editor';

/** Common navigation and relationship fields shared by every catalog entry. */
export interface CatalogEntryBase {
  readonly id: string;
  readonly title: string;
  readonly family: string;
  readonly page: string;
  readonly related: readonly string[];
  readonly sidebarOrder: number;
}

/** Public API symbol linked from a component page. */
export interface CatalogApiSymbol {
  readonly package: ComponentPackage;
  readonly symbol: string;
}

/** Catalog row that owns one or more public visual symbols. */
export interface CatalogComponent extends CatalogEntryBase {
  readonly kind: 'component';
  readonly package: ComponentPackage;
  readonly symbols: readonly string[];
  readonly complexity: 'standard' | 'data-grid-hub' | 'code-editor-hub';
  readonly examples: readonly string[];
  readonly apiSymbols: readonly CatalogApiSymbol[];
  readonly primary: boolean;
}

/** Catalog row that owns a specialist hub teaching route. */
export interface CatalogTopic extends CatalogEntryBase {
  readonly kind: 'topic';
  readonly hub: 'data-grid' | 'code-editor';
  readonly profile: 'landing' | 'capability' | 'api';
  readonly examples: readonly string[];
}

/** One validated component or specialist-topic row. */
export type CatalogEntry = CatalogComponent | CatalogTopic;

/** Immutable root document stored in `components.json`. */
export interface ComponentCatalog {
  readonly schemaVersion: 1;
  readonly entries: readonly CatalogEntry[];
}

/** One VitePress-compatible navigation link. */
export interface CatalogNavigationItem {
  readonly id: string;
  readonly text: string;
  readonly link: string;
}

/** Standard navigation family. */
export interface CatalogNavigationGroup {
  readonly text: string;
  readonly items: readonly CatalogNavigationItem[];
}

/** Stable navigation projections for standard pages and both specialist hubs. */
export interface ComponentNavigation {
  readonly components: readonly CatalogNavigationGroup[];
  readonly dataGrid: readonly CatalogNavigationItem[];
  readonly codeEditor: readonly CatalogNavigationItem[];
}

/** Validate an unknown value and return an immutable component catalog. */
export declare function validateComponentCatalog(value: unknown): ComponentCatalog;

/** Parse JSON source and validate the resulting component catalog. */
export declare function parseComponentCatalog(source: string, sourceName?: string): ComponentCatalog;

/** Build lookup maps for IDs and `package:symbol` ownership keys. */
export declare function createComponentCatalogIndexes(entries: readonly CatalogEntry[]): Readonly<{
  byId: ReadonlyMap<string, CatalogEntry>;
  symbolOwner: ReadonlyMap<string, CatalogComponent>;
}>;

/** Project stable standard and specialist navigation from entries in any order. */
export declare function projectComponentNavigation(entries: readonly CatalogEntry[]): ComponentNavigation;

/** Compare catalog symbol ownership with an independent `package:symbol` inventory. */
export declare function compareVisualSymbolInventory(
  entries: readonly CatalogEntry[],
  expected: readonly string[],
): Readonly<{ missing: readonly string[]; unexpected: readonly string[] }>;
