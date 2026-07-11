// Insert a "Documented in →" back-link into a generated symbol page, pointing at
// the hand-written component page that documents it. Runs as the second stage of
// generation (after TypeDoc writes the tree). Idempotent: generation reruns every
// build, so a page that already carries the note is returned unchanged.

import { pageLabel } from './api-map.mjs';

/** The note marker — also the idempotency sentinel. */
const MARKER = '> **Documented in:**';

/** Frontmatter block at the very top of the page (`---\n…\n---\n`), if any. */
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/** The first ATX H1 heading line. */
const HEADING = /^# .*$/m;

/**
 * Return `markdown` with a "> **Documented in:** [<page>](<componentPage>)" note
 * inserted after the frontmatter block (or, if none, after the first H1 heading;
 * or, failing that, at the very top). Applying it to a page that already has the
 * note returns the input unchanged.
 *
 * @param {string} markdown  The generated page's markdown.
 * @param {import('./api-map.mjs').ApiLink} link  The symbol's map entry.
 * @returns {string}
 *
 * @example
 * const page = '---\ntitle: Button\n---\n\n# Class: Button\n';
 * injectBackLink(page, { symbol: 'Button', pkg: 'ui',
 *   apiPath: '/api/ui/classes/Button', componentPage: '/components/controls/button' });
 * // → page with '> **Documented in:** [Button](/components/controls/button)' after the frontmatter
 */
export function injectBackLink(markdown, link) {
  if (markdown.includes(MARKER)) return markdown;

  const note = `${MARKER} [${pageLabel(link.componentPage)}](${link.componentPage})`;

  const frontmatter = FRONTMATTER.exec(markdown);
  if (frontmatter) {
    const end = frontmatter[0].length;
    return `${markdown.slice(0, end)}\n${note}\n${markdown.slice(end)}`;
  }

  const heading = HEADING.exec(markdown);
  if (heading) {
    const end = heading.index + heading[0].length;
    return `${markdown.slice(0, end)}\n\n${note}\n${markdown.slice(end)}`;
  }

  return `${note}\n\n${markdown}`;
}
