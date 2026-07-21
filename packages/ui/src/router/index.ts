/**
 * Router subsystem entry point — the full-screen {@link createRouter} screen stack and its seams.
 *
 * A router is an application body (the complement to `Desktop`): it shows one screen at a time,
 * navigated as a stack (`push`/`back`/`replace`/`reset`), with typed per-route params, opt-in
 * keep-alive, reactive `location()`/`canGoBack()`, per-screen chrome contributions, and focus that
 * survives navigation. Pass one as `createApplication({ content: router })`.
 *
 * These are re-exported from the package barrel `src/index.ts` (EXPLICIT named re-exports, matching
 * the layout/view/event convention). The `.js` extension in import specifiers is required by NodeNext
 * ESM resolution.
 */
export { createRouter } from './router.js';
export type { Router, NavArgs } from './router.js';
export { withBase } from './chrome.js';
export type {
  Route,
  RouteMap,
  RouteContext,
  ScreenBundle,
  RouterLocation,
  InitialRoute,
  RouterOptions,
  ChromeHost,
  ChromeHostAware,
  FocusHost,
  FocusHostAware,
} from './types.js';
