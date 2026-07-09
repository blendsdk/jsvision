/**
 * `@jsvision/web` — run any JSVision application in a browser xterm.js terminal, with no backend.
 *
 * The engine is already host-agnostic: `serialize()` emits ANSI and `decode()` consumes ANSI, which is
 * exactly xterm.js's output/input contract. This package replaces only the OS boundary and adds the
 * three browser facilities a real app needs — an in-memory virtual FileSystem (so file dialogs and the
 * editor work), key-chord reclaim (so the browser does not steal F-keys from a focused terminal), and
 * a clipboard bridge — plus the `mountApp` convenience that wires an app to a terminal in a few lines.
 *
 * The node-builtin placeholders live behind the `@jsvision/web/browser-stubs` subpath and are
 * intentionally NOT re-exported here, so importing `@jsvision/web` never pulls them into your graph.
 */

// The public surface is assembled here as each subsystem lands (browser host, caps builder, mountApp,
// virtual FileSystem, key-chord reclaim, clipboard bridge).
export { createBrowserHost, type BrowserHost, type BrowserHostOptions, type CaretCell } from './host.js';
export { buildBrowserCaps, type BrowserCapsOptions } from './caps.js';
export { mountApp, type MountAppOptions, type MountedApp } from './mount.js';
export { createBrowserFileSystem, type BrowserFileSystemOptions, type FileTree } from './virtual-fs.js';
