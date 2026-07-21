/**
 * `setClipboard` — the outbound clipboard path for a browser terminal.
 *
 * It writes text to the browser Clipboard API (`navigator.clipboard.writeText`), which the browser
 * gates on a user gesture. It **never reads** the clipboard: the bridge type exposes only `writeText`,
 * so no `readText` call is possible. Inbound paste is handled by the terminal's existing
 * bracketed-paste path, so no inbound code lives here.
 */
import type { CapabilityProfile } from '@jsvision/core';

/** The outbound-only slice of the browser Clipboard API (a narrow local type — no DOM lib, no reads). */
export interface ClipboardBridge {
  /** Write `text` to the clipboard. The browser requires an active user gesture; may reject otherwise. */
  writeText(text: string): Promise<void>;
}

/** The global `navigator.clipboard`, if present (undefined in a headless/no-DOM environment). */
function globalClipboard(): ClipboardBridge | undefined {
  // Optional members make this a plain annotation (no cast); in a browser it resolves to the real
  // navigator.clipboard, whose writeText satisfies ClipboardBridge.
  const scope: { navigator?: { clipboard?: ClipboardBridge } } = globalThis;
  return scope.navigator?.clipboard;
}

/**
 * Write `text` to the browser clipboard (outbound only).
 *
 * @param text - the text to copy.
 * @param _caps - the capability profile, accepted for API symmetry with the native OSC-52 path;
 *   reserved (unused by the browser Clipboard API).
 * @param clipboard - the clipboard bridge; defaults to `navigator.clipboard`. Inject a mock in tests.
 * @returns the write promise (resolves when written; may reject if there is no user gesture). Resolves
 *   to a no-op when no clipboard is available.
 *
 * @example
 * import { setClipboard, buildBrowserCaps } from '@jsvision/web';
 *
 * // In a copy handler (a user gesture):
 * const selectedText = 'the text the user highlighted';
 * await setClipboard(selectedText, buildBrowserCaps());
 */
export function setClipboard(text: string, _caps: CapabilityProfile, clipboard?: ClipboardBridge): Promise<void> {
  const bridge = clipboard ?? globalClipboard();
  if (!bridge) return Promise.resolve(); // no clipboard available — a graceful no-op
  return bridge.writeText(text);
}
