/** Supported teaching shapes in the Guide curriculum. */
export type GuideProfile = 'orientation' | 'course' | 'integration' | 'specialist';

/** Current implementation state for one curriculum entry. */
export type GuideStage = 'complete' | 'upgrade' | 'planned';

/** One validated Guide curriculum entry. */
export interface GuideCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly page: string;
  readonly profile: GuideProfile;
  readonly stage: GuideStage;
  readonly sidebarOrder: number;
  readonly prerequisites: readonly string[];
  readonly learningOutcomes: readonly string[];
  readonly requiredLiveExamples: number;
  readonly liveExampleException: string | null;
  readonly examples: readonly string[];
}

/** Immutable root document stored in `guides.json`. */
export interface GuideCatalog {
  readonly schemaVersion: 1;
  readonly entries: readonly GuideCatalogEntry[];
}

/** External completion evidence supplied without coupling the catalog module to the registry. */
export interface GuideCatalogValidationOptions {
  readonly registeredExampleIds?: readonly string[];
}

/** One catalog-owned navigation item. */
export interface GuideNavigationItem {
  readonly id: string;
  readonly text: string;
  readonly link: string;
}

/** One catalog-owned Guide sidebar group. */
export interface GuideNavigationGroup {
  readonly text: string;
  readonly items: readonly GuideNavigationItem[];
}

/** Validate an unknown curriculum document and optional registry evidence. */
export declare function validateGuideCatalog(value: unknown, options?: GuideCatalogValidationOptions): GuideCatalog;

/** Parse and validate Guide curriculum JSON. */
export declare function parseGuideCatalog(
  source: string,
  sourceName?: string,
  options?: GuideCatalogValidationOptions,
): GuideCatalog;

/** Project non-planned curriculum entries into stable Guide navigation. */
export declare function projectGuideNavigation(entries: readonly GuideCatalogEntry[]): readonly GuideNavigationGroup[];
