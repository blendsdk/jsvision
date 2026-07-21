/**
 * The example-module contract. Every runnable docs example is a module whose
 * default export is a `defineExample({ title, blurb, build })` — placement-
 * agnostic: it knows what it is and how to compose itself, but nothing about
 * where it is shown or how it is mounted.
 *
 * An example module composes with `@jsvision/ui` only and must be SSR/headless-
 * safe: no `@xterm/*` import and no DOM globals (`document`/`window`) — mounting
 * a terminal is the Play component's job, not the example's. The one sanctioned
 * cross-package exception is `@jsvision/web`'s pure in-memory
 * `createBrowserFileSystem` (it is `node:`/DOM-free and runs headlessly), used
 * by the file-dialog example to seed a virtual tree.
 */
import type { Application, View } from '@jsvision/ui';
import type { CapabilityProfile } from '@jsvision/core';

/** What an example's `build()` receives: the cell grid and terminal profile to compose into. */
export interface ExampleContext {
  /** Available width in cells. */
  readonly width: number;
  /** Available height in cells. */
  readonly height: number;
  /**
   * The terminal capability profile (colour depth, Unicode, etc.). A single-`View`
   * example can ignore it — the demo shell builds its app. An example that returns
   * a whole `Application` must thread it into `createApplication({ caps })` (use the
   * `demoApp(ctx)` helper) so colours and the Depth control resolve correctly.
   */
  readonly caps: CapabilityProfile;
  /**
   * Register a teardown callback the host runs when this example is torn down — the Play widget
   * closes, or it remounts at a new size/depth. Use it to release anything `build()` started that the
   * view tree does not own, most commonly an animation `setInterval`. Called at most once.
   *
   * Absent in a pure-headless mount (the paint-smoke test builds an example without a host), so an
   * animated example must also make its timer harmless there — `timer.unref()` in Node lets the test
   * process exit regardless; this seam is what actually stops it in the browser.
   *
   * @param fn - the teardown callback.
   */
  onCleanup?(fn: () => void): void;
}

/**
 * A self-describing, placement-agnostic example. The registry supplies the
 * example's id/category/chrome/sourcePath; the module owns only its title,
 * blurb, and how to build itself.
 */
export interface ExampleDefinition {
  /** Short human title (e.g. `'Button'`). */
  readonly title: string;
  /** One-sentence description shown beside the example. */
  readonly blurb: string;
  /**
   * Compose the demo for the given cell grid. Return an `Application` (a full
   * app — menu/status/windows) or a bare `View` (a single component); the demo
   * shell normalizes either into the mountable application.
   */
  build(ctx: ExampleContext): Application | View;
}

/**
 * Identity helper for authoring an example: returns its argument unchanged,
 * giving type inference and a single documented shape at every call site.
 *
 * @param def - the example definition.
 * @returns the same definition, typed as an {@link ExampleDefinition}.
 * @example
 * // examples/controls/button.ts
 * import { Button, Text, Group, signal } from '@jsvision/ui';
 * import { defineExample } from '../_contract.js';
 *
 * export default defineExample({
 *   title: 'Button',
 *   blurb: 'A push button bound to a click counter.',
 *   build: () => {
 *     const clicks = signal(0);
 *     const g = new Group();
 *     // …compose the button + a live count echo…
 *     return g;
 *   },
 * });
 */
export function defineExample(def: ExampleDefinition): ExampleDefinition {
  return def;
}
