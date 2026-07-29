/**
 * Shared headless harness for docs examples that follow the centered-dialog laboratory template.
 * It builds through the real browser demo shell so geometry, theme colors, focus, and event routing
 * are exercised exactly as they are in the live documentation.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Dialog, Group, View } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { demoShell } from '../src/demo-shell.js';

/** Standard terminal size used by the browser example host. */
export const EXAMPLE_VIEWPORT = { width: 80, height: 24 };

/** True-color Linux capabilities used for deterministic docs-example rendering. */
export const EXAMPLE_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Create a decoded keyboard event suitable for the real application event loop. */
export function key(keyName: string, mods: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: keyName, ctrl: false, alt: false, shift: false, ...mods };
}

/** Flatten the rendered terminal frame into searchable text. */
export function frameText(app: Application): string {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Walk a mounted view tree in depth-first display order. */
export function viewsIn(view: View): View[] {
  const descendants = view instanceof Group ? view.children.flatMap((child) => viewsIn(child)) : [];
  return [view, ...descendants];
}

/** Resolve a view's top-left cell in the application render buffer. */
export function absoluteOrigin(view: View): { x: number; y: number } {
  let x = view.bounds.x;
  let y = view.bounds.y;
  let parent = view.parent;
  while (parent !== null) {
    x += parent.bounds.x;
    y += parent.bounds.y;
    parent = parent.parent;
  }
  return { x, y };
}

/**
 * Build a registered app example and return its centered laboratory dialog.
 *
 * @param id Stable example registry identifier.
 * @param definition Loaded example module definition.
 * @returns The mounted application and its first desktop dialog.
 * @throws When the registry entry is absent or the example does not create a dialog.
 */
export function buildLabExample(id: string, definition: ExampleDefinition): { app: Application; dialog: Dialog } {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`the ${id} example is not registered`);
  const app = demoShell({
    build: (ctx) => definition.build(ctx),
    title: definition.title,
    kind: entry.kind,
    themeMenu: entry.themeMenu,
    caps: EXAMPLE_CAPS,
    viewport: EXAMPLE_VIEWPORT,
  });
  app.loop.resize(EXAMPLE_VIEWPORT);
  const dialog = app.desktop?.children.find((child): child is Dialog => child instanceof Dialog);
  if (dialog === undefined) throw new Error(`the ${id} example did not render in a dialog`);
  return { app, dialog };
}
