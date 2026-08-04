import type { View } from '@jsvision/ui';

/** Package-owned chrome rows associated with a viewport without changing its public options. */
const HOST_CHROME_ROWS = new WeakMap<View, number>();

/**
 * Records package-owned board chrome used only by localized minimum-host guidance.
 *
 * This module is deliberately absent from the package barrel. The board is the only writer, so an
 * application cannot alter viewport geometry through an undocumented export.
 *
 * @example
 * ```ts
 * setViewportHostChromeRows(viewport, 1);
 * ```
 */
export function setViewportHostChromeRows(viewport: View, rows: number): void {
  HOST_CHROME_ROWS.set(viewport, rows);
}

/**
 * Returns the package-owned chrome rows associated with one viewport.
 *
 * @example
 * ```ts
 * const minimumHeight = 4 + readViewportHostChromeRows(viewport);
 * ```
 */
export function readViewportHostChromeRows(viewport: View): number {
  return HOST_CHROME_ROWS.get(viewport) ?? 0;
}
