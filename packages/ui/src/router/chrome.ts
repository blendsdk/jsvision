/**
 * Chrome-contribution helpers for the navigation router.
 *
 * A screen's `build` returns `{ view, status?, menu? }`; a present `status`/`menu` fully replaces that
 * bar on activation (the router carries no merge rules). {@link withBase} is the opt-in compose helper
 * for the common "global affordances + per-screen hints" case — plain array composition, so a screen
 * chooses base-plus-extras explicitly.
 */
import type { View } from '../view/index.js';

/**
 * Compose a chrome contribution from a base list plus per-screen extras: `[...base, ...extra]`. Works
 * for either bar — a status contribution (`View[]`) or a menu contribution (`MenuItem[]`).
 *
 * Pass **fresh** base items (e.g. from `app.statusBase()`), not a shared live list: a `View` has one
 * parent, so composing with the live base bar's own item instances would re-parent them.
 *
 * @param base  The base items (a fresh list — see above).
 * @param extra The per-screen items to append.
 * @returns A new array of the base items followed by the extras.
 * @example
 * import { createApplication, withBase, statusItem } from '@jsvision/ui';
 * import type { ScreenBundle } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const app = createApplication({ caps });
 *
 * // In a route build, keep the app's base status affordances and add a screen-specific one:
 * const screen: ScreenBundle = {
 *   view: app.desktop,
 *   status: withBase(app.statusBase(), [statusItem('~E~dit', 'detail.edit')]),
 * };
 */
export function withBase<T extends View | { readonly kind: string }>(base: readonly T[], extra: readonly T[]): T[] {
  return [...base, ...extra];
}
