/** One visual application destination displayed on the Apps overview. */
export interface AppGalleryEntry {
  /** Stable example registry identifier used by the live-example deep link. */
  readonly exampleId: `apps/${string}`;
  /** Human-readable application name. */
  readonly title: string;
  /** Short explanation of the framework capability demonstrated by the application. */
  readonly description: string;
  /** Docs route for the application's teaching page. */
  readonly page: `/apps/${string}`;
  /** Public screenshot path, resolved against the site's deployment base. */
  readonly screenshot: `/apps/${string}.png`;
  /** Descriptive alternative text for the screenshot. */
  readonly screenshotAlt: string;
  /** Small capability labels that make the gallery easy to scan. */
  readonly capabilities: readonly string[];
  /** Approximate learning level for readers choosing an example. */
  readonly level: 'Beginner' | 'Intermediate' | 'Advanced';
}

/** The complete, intentionally progressive collection of runnable JSVision applications. */
export const APP_GALLERY_ENTRIES = [
  {
    exampleId: 'apps/hello',
    title: 'Hello, JSVision',
    description: 'Start with the standard application shell and a real modal dialog.',
    page: '/apps/hello',
    screenshot: '/apps/hello.png',
    screenshotAlt: 'JSVision desktop with a centered welcome dialog',
    capabilities: ['App shell', 'Modal dialog'],
    level: 'Beginner',
  },
  {
    exampleId: 'apps/calculator',
    title: 'Calculator',
    description: 'Combine buttons, reactive state, and precise terminal-cell layout.',
    page: '/apps/calculator',
    screenshot: '/apps/calculator.png',
    screenshotAlt: 'Working pocket calculator in a JSVision window',
    capabilities: ['Buttons', 'Signals', 'Layout'],
    level: 'Beginner',
  },
  {
    exampleId: 'apps/editor',
    title: 'Editor & clipboard',
    description: 'Exercise text selection, clipboard commands, undo, and redo.',
    page: '/apps/editor',
    screenshot: '/apps/editor.png',
    screenshotAlt: 'JSVision text editor and shared clipboard windows',
    capabilities: ['Editing', 'Clipboard', 'Commands'],
    level: 'Intermediate',
  },
  {
    exampleId: 'apps/desktop',
    title: 'Turbo Vision desktop',
    description: 'Explore menus, focus, movable windows, resize, tile, and cascade.',
    page: '/apps/desktop',
    screenshot: '/apps/desktop.png',
    screenshotAlt: 'Full Turbo Vision-style JSVision desktop with two windows',
    capabilities: ['Windows', 'Menus', 'Focus'],
    level: 'Intermediate',
  },
  {
    exampleId: 'apps/life',
    title: 'Game of Life',
    description: 'Drive a custom view with simulation state and mouse drawing.',
    page: '/apps/life',
    screenshot: '/apps/life.png',
    screenshotAlt: 'Conway Game of Life running inside a JSVision desktop',
    capabilities: ['Custom view', 'Mouse input', 'Animation'],
    level: 'Intermediate',
  },
  {
    exampleId: 'apps/amiga-clock',
    title: 'Amiga clock',
    description: 'Animate several reactive views from one shared timer.',
    page: '/apps/amiga-clock',
    screenshot: '/apps/amiga-clock.png',
    screenshotAlt: 'Amiga-inspired analog, digital, and boing-ball clock windows',
    capabilities: ['Timers', 'Signals', 'Composition'],
    level: 'Advanced',
  },
  {
    exampleId: 'apps/matrix',
    title: 'Matrix rain',
    description: 'Share animated state across themed, dynamically created windows.',
    page: '/apps/matrix',
    screenshot: '/apps/matrix.png',
    screenshotAlt: 'Three green Matrix digital-rain windows on a black desktop',
    capabilities: ['Animation', 'Themes', 'Windows'],
    level: 'Advanced',
  },
  {
    exampleId: 'apps/effects',
    title: 'Starfield, plasma & fire',
    description: 'Render truecolor effects cell by cell with terminal fallbacks.',
    page: '/apps/effects',
    screenshot: '/apps/effects.png',
    screenshotAlt: 'Truecolor animated effect filling a JSVision terminal canvas',
    capabilities: ['Truecolor', 'Custom drawing', 'Rendering'],
    level: 'Advanced',
  },
] as const satisfies readonly AppGalleryEntry[];
