/**
 * The event loop — the host-agnostic engine that turns decoded terminal input into widget behavior.
 *
 * `createEventLoop` builds and owns a render root, then routes keyboard/mouse input and internal
 * commands through a dispatch machine with focus management, mouse hit-testing, and modal windows,
 * repainting exactly one coalesced frame per tick. It is the layer beneath `createApplication`: use
 * the loop directly for a headless or embedded setup, or let `createApplication` wire it to a real
 * terminal for you.
 *
 * The event-handler contract types (`CommandEvent`/`AppEvent`/`DispatchEvent`) are also re-exported
 * here so you can import everything you need to write an `onEvent` handler from one place.
 */
export { createEventLoop } from './event-loop.js';
export { buildKeymap } from './default-keymap.js';
export type { EventLoop, EventLoopOptions, ModalHost, ModalHostAware } from './types.js';
export type { ClipboardKeys } from './default-keymap.js';
export type { CommandEvent, AppEvent, DispatchEvent } from '../view/index.js';
