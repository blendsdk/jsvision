/**
 * The center panel — hosts the curated preview {@link buildGallery gallery}. It carries no theme logic
 * of its own: because the whole app repaints on `app.setTheme`, the gallery re-colors live on every
 * edit. (The color-depth toggle is a display-only inspector strip; the gallery is not re-rendered at a
 * lower depth — the app's render root has a single, fixed capability profile.)
 */
import { Group, Text } from '@jsvision/ui';

import { buildGallery } from './gallery.js';

/**
 * Build the center preview panel: a titled column whose body is the live theme gallery.
 *
 * @returns A {@link Group} laid out as a column `[title, gallery-fills]`; the app sizes it `fr` in the workspace row.
 * @example
 * import { buildPreviewPanel } from './view/preview-panel.js';
 * const preview = buildPreviewPanel();
 */
export function buildPreviewPanel(): Group {
  const view = new Group();
  const title = new Text('Live preview');
  title.layout = { size: { kind: 'fixed', cells: 1 } };
  const gallery = buildGallery();
  gallery.layout = { size: { kind: 'fr', weight: 1 } };
  view.add(title);
  view.add(gallery);
  return view;
}
