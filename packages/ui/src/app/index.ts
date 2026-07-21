/**
 * The application shell: the top-level entry point for a full terminal app.
 *
 * `createApplication` assembles the event loop, a desktop window manager, an optional menu bar and
 * status line, and a popup overlay into one ready-to-run app. The returned `Application.run()`
 * connects it to a real terminal and runs until the `'quit'` command.
 */
export { createApplication, syncOverlayVisible } from './application.js';
export type {
  Application,
  ApplicationOptions,
  DesktopApplication,
  RouterApplication,
  CreatedApplication,
} from './application.js';
