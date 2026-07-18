/**
 * The "coming soon" roadmap panels — one per not-yet-shipped datagrid RD (RD-14). Each is a
 * `Story` in the `Roadmap` category built by a single {@link placeholderStory} factory: the capability
 * title, a "what this will demonstrate" paragraph, and a coming-soon chip. When an RD lands, its panel
 * is replaced by the real demo cluster in the same navigator slot (as RD-07…RD-13 were).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story } from '../story.js';

/**
 * Build one roadmap placeholder panel.
 *
 * @param rd The provenance RD (e.g. `'RD-07'`), shown as the chip and folded into the id.
 * @param title The capability title (sidebar label + panel heading).
 * @param blurb The one-line "what this will demonstrate" description.
 * @returns A `Story` in the `Roadmap` category.
 */
export function placeholderStory(rd: string, title: string, blurb: string): Story {
  return {
    id: `datagrid/roadmap/${rd.toLowerCase()}`,
    category: 'Roadmap',
    title,
    blurb,
    rd,
    build(ctx) {
      const g = new Group();
      g.add(at(new Text(title), 1, 1, ctx.width - 2, 1));
      g.add(at(new Text('⏳ Coming soon'), 1, 3, ctx.width - 2, 1));
      g.add(at(new Text(`This ${rd} cluster will demonstrate:`), 1, 5, ctx.width - 2, 1));
      g.add(at(new Text(blurb), 3, 6, ctx.width - 4, Math.max(1, ctx.height - 7)));
      return g;
    },
  };
}

/** The roadmap placeholders (RD-14), in RD order — RD-07…RD-13 have shipped as live clusters (RD-13 is the "Export & variants" cluster; the deferred import + personalization-dialog half stays a follow-up). */
export const placeholders: readonly Story[] = [
  placeholderStory(
    'RD-14',
    'Non-functional',
    'Performance budgets, security posture, accessibility, theme roles, and API governance.',
  ),
];
