/**
 * The center panel — hosts the curated preview {@link buildGallery gallery} inside a scroller so the
 * broad widget canvas is never clipped. It carries no theme logic of its own: because the whole app
 * repaints on `app.setTheme`, the gallery re-colors live on every edit. The panel title shows the
 * active preview depth, which the app downsamples the whole preview to.
 */
import { Group, Text, Scroller } from '@jsvision/ui';

import { buildGallery, GALLERY_SIZE } from './gallery.js';
import type { DesignerModel } from '../model/index.js';

/**
 * Build the center preview panel: a titled column whose body is the live theme gallery in a scroller.
 *
 * @param model The designer model (its `depth` drives the reactive title).
 * @returns A {@link Group} laid out as a column `[title, scroller-fills]`; the app sizes it `fr` in the workspace row.
 * @example
 * import { buildPreviewPanel } from './view/preview-panel.js';
 * const preview = buildPreviewPanel(model);
 */
export function buildPreviewPanel(model: DesignerModel): Group {
  const view = new Group();
  const title = new Text(() => `Live preview — ${model.state().depth}`);
  title.layout = { size: { kind: 'fixed', cells: 1 } };
  const scroller = new Scroller({ content: buildGallery(), extent: GALLERY_SIZE, scrollbars: 'both' });
  scroller.layout = { size: { kind: 'fr', weight: 1 } };
  view.add(title);
  view.add(scroller);
  return view;
}
