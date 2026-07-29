/** Page profiles enforced by the component documentation parser. */
export type ComponentPageProfile = 'standard' | 'landing' | 'capability' | 'api';

/** Staged expectations supplied by a family or specialist-hub specification. */
export interface ComponentPageContractOptions {
  readonly filePath: string;
  readonly profile: ComponentPageProfile;
  readonly expectedExamples: readonly string[];
  readonly componentSpecificHeadings?: readonly string[];
  /** Public symbols that must appear in the Props/public-state section. */
  readonly requiredPublicSymbols?: readonly string[];
  /** Exact theme roles that the Theming section must teach. */
  readonly requiredThemeRoles?: readonly string[];
  /** Complete allowlist of valid root-absolute links for controlled contract checks. */
  readonly validLinks?: readonly string[];
}

/** Immutable structural evidence extracted from one validated teaching page. */
export interface ComponentPageEvidence {
  readonly title: string;
  readonly description: string;
  readonly h1: string;
  readonly headings: readonly string[];
  readonly anchors: readonly string[];
  readonly exampleIds: readonly string[];
  readonly snippetCount: number;
  readonly relatedLinks: readonly string[];
}

/**
 * Validate Markdown against a standard or specialist component-page contract.
 *
 * @param source Markdown source.
 * @param options Selected profile and staged population.
 * @returns Immutable structural evidence for catalog integrations.
 * @throws TypeError with the source path when the teaching contract is violated.
 */
export declare function validateComponentPage(
  source: string,
  options: ComponentPageContractOptions,
): ComponentPageEvidence;
