/** Parsed metadata for a component documentation target. */
export interface ComponentTarget {
  /** Site-absolute component route without its heading fragment. */
  readonly route: string;
  /** Optional kebab-case heading fragment. */
  readonly fragment?: string;
  /** Human-readable label derived from the route's final segment. */
  readonly label: string;
  /** Fragment-free path of the rendered HTML file below the build directory. */
  readonly buildKey: string;
}

/**
 * Parse a site-absolute component route and optional heading fragment.
 *
 * @param target Target below `/components/`.
 * @returns Validated route metadata for links and build checks.
 * @throws TypeError when the target is malformed or outside the component tree.
 *
 * @example
 * ```ts
 * parseComponentTarget('/components/data-grid/#editing');
 * ```
 */
export declare function parseComponentTarget(target: string): ComponentTarget;
