// Hand-written declaration for inject-back-links.mjs (plain ESM). The `ApiLink`
// shape is inlined here rather than imported from api-map.mjs's JSDoc typedef,
// since that module has no declaration file of its own; declares only the one
// exported function the spec test consumes.

/**
 * One component↔reference link, matching the map's row shape. `pkg` is typed
 * as a plain string rather than the map's `'core' | 'ui' | 'files' | 'forms' | 'datagrid'`
 * union: the consuming test builds a standalone `const` object (not narrowed
 * by an immediate call site), so its property would otherwise widen and fail
 * to satisfy a literal-typed field.
 */
interface ApiLink {
  symbol: string;
  pkg: string;
  apiPath: string;
  componentPage: string;
}

/**
 * Return `markdown` with a "> **Documented in:** [<page>](<componentPage>)"
 * note inserted after the frontmatter block (or, if none, after the first H1
 * heading; or, failing that, at the very top). Applying it to a page that
 * already has the note returns the input unchanged.
 *
 * @param markdown The generated page's markdown.
 * @param link The symbol's map entry.
 * @returns The markdown with the back-link note inserted (or unchanged).
 */
export declare function injectBackLink(markdown: string, link: ApiLink): string;
