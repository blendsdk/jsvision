/**
 * Shared headless harness for docs examples that follow the centered-dialog laboratory template.
 * It builds through the real browser demo shell so geometry, theme colors, focus, and event routing
 * are exercised exactly as they are in the live documentation.
 */
import { classicTheme, resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent, WheelEvent } from '@jsvision/core';
import { Dialog, Group, View } from '@jsvision/ui';
import type { Application, Rect, Size2D } from '@jsvision/ui';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { demoShell } from '../src/demo-shell.js';
import type { ExampleAction } from './contracts/_contract.js';

/** Standard terminal size used by the browser example host. */
export const EXAMPLE_VIEWPORT = { width: 80, height: 24 };

/** True-color Linux capabilities used for deterministic docs-example rendering. */
export const EXAMPLE_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Runtime proof collected from a real template1 application and rendered dialog. */
export interface Template1Evidence {
  /** Absolute dialog bounds inside the terminal viewport. */
  readonly dialogRect: Rect;
  /** Cell dimensions used to compose the example. */
  readonly viewport: Size2D;
  /** Rendered lines covering the complete dialog frame. */
  readonly frameLines: readonly string[];
  /** Rendered lines inside the dialog border. */
  readonly dialogInterior: readonly string[];
}

/** Options that let implementation tests exercise the laboratory at non-default terminal sizes. */
export interface LabExampleOptions {
  /** Terminal cell grid supplied to both the example builder and render loop. */
  readonly viewport?: Size2D;
}

/** Create a decoded keyboard event suitable for the real application event loop. */
export function key(keyName: string, mods: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: keyName, ctrl: false, alt: false, shift: false, ...mods };
}

/**
 * Dispatch one typed behavior-contract primitive through the real application loop.
 *
 * Contract coordinates are conventional zero-based screen cells; terminal mouse events are
 * one-based, so the conversion happens only at this boundary.
 */
export function dispatchExampleAction(app: Application, action: ExampleAction): void {
  if (action.kind === 'key') {
    // Behavior contracts use familiar browser-style Arrow names, while the decoded JSVision event
    // vocabulary uses the shorter terminal names consumed by widget keymaps.
    const keyName = /^arrow/i.test(action.key) ? action.key.slice('arrow'.length).toLowerCase() : action.key;
    app.loop.dispatch(
      key(keyName, {
        alt: action.modifiers.includes('Alt'),
        ctrl: action.modifiers.includes('Ctrl'),
        shift: action.modifiers.includes('Shift'),
      }),
    );
    return;
  }
  if (action.kind === 'paste') {
    app.loop.dispatch({ type: 'paste', text: action.text, truncated: false });
    return;
  }
  const button = action.button === 'middle' ? 1 : action.button === 'right' ? 2 : 0;
  const mouse = (kind: MouseEvent['kind'], point: { readonly x: number; readonly y: number }): MouseEvent => ({
    type: 'mouse',
    kind,
    button,
    x: point.x + 1,
    y: point.y + 1,
  });
  const click = (): void => {
    app.loop.dispatch(mouse('down', action.at));
    app.loop.dispatch(mouse('up', action.at));
  };
  if (action.gesture === 'click') {
    click();
  } else if (action.gesture === 'double-click') {
    click();
    click();
  } else if (action.gesture === 'drag') {
    if (action.to === undefined) throw new Error('a validated drag requires a destination');
    app.loop.dispatch(mouse('down', action.at));
    app.loop.dispatch(mouse('drag', action.to));
    app.loop.dispatch(mouse('up', action.to));
  } else if (action.gesture === 'wheel') {
    if (action.delta === undefined) throw new Error('a validated wheel action requires a delta');
    const event: WheelEvent = {
      type: 'wheel',
      dir: action.delta < 0 ? 'up' : 'down',
      x: action.at.x + 1,
      y: action.at.y + 1,
      ctrl: false,
      alt: false,
      shift: false,
    };
    for (let index = 0; index < Math.abs(action.delta); index += 1) app.loop.dispatch(event);
  } else {
    throw new Error(`unsupported mouse gesture ${String(action.gesture)}`);
  }
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
export function buildLabExample(
  id: string,
  definition: ExampleDefinition,
  options: LabExampleOptions = {},
): { app: Application; dialog: Dialog } {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`the ${id} example is not registered`);
  const viewport = options.viewport ?? EXAMPLE_VIEWPORT;
  const app = demoShell({
    build: (ctx) => definition.build(ctx),
    title: definition.title,
    kind: entry.kind,
    themeMenu: entry.themeMenu,
    caps: EXAMPLE_CAPS,
    viewport,
  });
  app.loop.resize(viewport);
  const dialog = app.desktop?.children.find((child): child is Dialog => child instanceof Dialog);
  if (dialog === undefined) {
    app.loop.dispose();
    throw new Error(`the ${id} example did not render in a dialog`);
  }
  return { app, dialog };
}

/**
 * Assert the shared template1 shell and return rendered evidence for family-specific checks.
 *
 * @param app Real application built through the docs demo shell.
 * @param dialog Mounted laboratory dialog owned by the example.
 * @param options Expected compact, maximized, or user-resized window state.
 * @returns Immutable geometry and rendered cell evidence.
 * @throws When chrome, centering, margins, padding, surface color, or frame bounds are invalid.
 */
export function collectTemplate1Evidence(
  app: Application,
  dialog: Dialog,
  options: { readonly startup?: 'compact' | 'maximized' | 'resized' } = {},
): Template1Evidence {
  const desktop = app.desktop;
  if (desktop === undefined) throw new Error('template1 requires a desktop');
  if (dialog.closable) throw new Error('template1 dialog must remain non-closable');
  if (dialog.background !== undefined) throw new Error('template1 dialog must not override its theme surface');

  if (options.startup === 'maximized') {
    if (
      !dialog.isZoomed() ||
      dialog.bounds.x !== 0 ||
      dialog.bounds.y !== 0 ||
      dialog.bounds.width !== desktop.bounds.width ||
      dialog.bounds.height !== desktop.bounds.height
    ) {
      throw new Error('template1 dialog must start maximized to the complete desktop');
    }
  } else {
    if (options.startup !== 'resized') {
      const expectedX = Math.floor((desktop.bounds.width - dialog.bounds.width) / 2);
      const expectedY = Math.floor((desktop.bounds.height - dialog.bounds.height) / 2);
      if (dialog.bounds.x !== expectedX || dialog.bounds.y !== expectedY) {
        throw new Error(`template1 dialog is not centered: ${dialog.bounds.x},${dialog.bounds.y}`);
      }
      if (!dialog.centered) throw new Error('template1 dialog must use automatic centering');
    }
    if (
      dialog.bounds.x <= 0 ||
      dialog.bounds.y <= 0 ||
      dialog.bounds.x + dialog.bounds.width >= desktop.bounds.width ||
      dialog.bounds.y + dialog.bounds.height >= desktop.bounds.height
    ) {
      throw new Error('template1 dialog must leave visible desktop margin on every side');
    }
  }

  const content = dialog.children.find((child): child is Group => child instanceof Group);
  if (content === undefined) throw new Error('template1 dialog requires an inset content group');
  if (content.background !== undefined) throw new Error('template1 content must not override the dialog theme surface');
  const rightInset = dialog.bounds.width - (content.bounds.x + content.bounds.width);
  const bottomInset = dialog.bounds.height - (content.bounds.y + content.bounds.height);
  if (content.bounds.x !== 2 || content.bounds.y !== 2 || rightInset !== 2 || bottomInset !== 2) {
    throw new Error('template1 content must have one cell of padding beyond the frame');
  }
  // Only direct children are constrained to this viewport. A Scroller legitimately owns an
  // oversized descendant and clips that nested content through its own viewport.
  const clippedChild = content.children.find(
    (view) =>
      absoluteOrigin(view).x < absoluteOrigin(content).x ||
      absoluteOrigin(view).y < absoluteOrigin(content).y ||
      absoluteOrigin(view).x + view.bounds.width > absoluteOrigin(content).x + content.bounds.width ||
      absoluteOrigin(view).y + view.bounds.height > absoluteOrigin(content).y + content.bounds.height,
  );
  if (clippedChild !== undefined) throw new Error('template1 content children must stay inside the padded dialog area');

  const origin = absoluteOrigin(dialog);
  const buffer = app.loop.renderRoot.buffer();
  const lines = buffer.rows().map((row) => row.map((cell) => cell.char).join(''));
  if (!lines[0]?.includes('≡') || !lines[0]?.includes('View') || !lines.at(-1)?.includes('Alt+X Exit')) {
    throw new Error('template1 requires the Classic menu and status shell');
  }
  const menuCell = buffer.get(10, 0);
  const dialogCell = buffer.get(origin.x + 1, origin.y + 1);
  if (menuCell?.bg !== classicTheme.menuBar.bg || dialogCell?.bg !== menuCell.bg) {
    throw new Error('template1 dialog surface must match the Classic menu-bar background');
  }

  const frameFitsBuffer =
    origin.x >= 0 &&
    origin.y >= 0 &&
    origin.x + dialog.bounds.width <= buffer.width &&
    origin.y + dialog.bounds.height <= buffer.height;
  if (!frameFitsBuffer) {
    throw new Error('template1 dialog frame is clipped');
  }
  // Extract by terminal cell rather than JavaScript string index. A one-cell Unicode glyph can use
  // two UTF-16 code units, which would shift a later string slice even though the frame is intact.
  const frameLines = Array.from({ length: dialog.bounds.height }, (_, row) =>
    Array.from(
      { length: dialog.bounds.width },
      (_, column) => buffer.get(origin.x + column, origin.y + row)?.char ?? ' ',
    ).join(''),
  );
  const top = frameLines[0];
  const bottom = frameLines.at(-1);
  const hasCorners = top?.at(0)?.trim() !== '' && top?.at(-1)?.trim() !== '';
  const hasBottomCorners = bottom?.at(0)?.trim() !== '' && bottom?.at(-1)?.trim() !== '';
  const hasSideRails = frameLines.slice(1, -1).every((line) => line.at(0)?.trim() !== '' && line.at(-1)?.trim() !== '');
  if (!hasCorners || !hasBottomCorners || !hasSideRails) {
    throw new Error('template1 dialog frame must be visibly complete');
  }
  const dialogInterior = frameLines.slice(1, -1).map((line) => line.slice(1, -1));
  if (!dialogInterior.some((line) => /\b(?:Alt|Tab|Enter|Space|mouse|click|arrow)/i.test(line))) {
    throw new Error('template1 dialog must show concise keyboard or mouse instructions');
  }
  return Object.freeze({
    dialogRect: Object.freeze({ ...dialog.bounds }),
    viewport: Object.freeze({ width: buffer.width, height: buffer.height }),
    frameLines: Object.freeze(frameLines),
    dialogInterior: Object.freeze(dialogInterior),
  });
}
