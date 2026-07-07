/**
 * Redaction helpers for safe logging — so you never accidentally write a user's
 * keystrokes, pasted text, or clipboard contents into a log.
 *
 * {@link redactEvent} reduces a decoded input event to a log-safe shape that can
 * never carry a typed character or pasted text. {@link dumpCaps} renders a
 * one-line, secret-free summary of a resolved capability profile for debug logs.
 * Both are pure: no I/O, no logging, and they never mutate their arguments.
 */
import type { InputEvent } from '../input/events.js';
import type { CapabilityProfile, CapabilityResolution } from '../capability/profile.js';

/** A redacted, log-safe view of an input event — carries modifiers and coordinates, never raw content. */
export type RedactedEvent =
  | {
      readonly type: 'key';
      readonly key?: string;
      readonly printable?: true;
      readonly ctrl: boolean;
      readonly alt: boolean;
      readonly shift: boolean;
    }
  | { readonly type: 'mouse'; readonly kind: string; readonly button: number; readonly x: number; readonly y: number }
  | { readonly type: 'wheel'; readonly dir: string; readonly x: number; readonly y: number }
  | { readonly type: 'paste'; readonly length: number; readonly truncated: boolean }
  | { readonly type: 'focus'; readonly focused: boolean };

/**
 * Reduce a decoded input event to a shape that is safe to log — drops any raw
 * content while keeping the structural facts (modifiers, coordinates, lengths)
 * useful for debugging. Log the result of this, never a raw event.
 *
 * - **Printable key** (a character was typed): becomes `{type:'key',
 *   printable:true, ctrl, alt, shift}` — the character itself is dropped.
 * - **Named key** (e.g. Enter, arrows): keeps its name, e.g. `{type:'key',
 *   key:'enter', ctrl, alt, shift}`.
 * - **Paste**: yields only `{type:'paste', length, truncated}` — never the text.
 * - **Mouse / wheel / focus**: carry no secrets, so coordinates, direction, and
 *   the focus flag pass through.
 *
 * @param event Any decoded input event.
 * @returns The redacted, log-safe view. Pure; never mutates `event`.
 * @example
 * import { redactEvent } from '@jsvision/core';
 *
 * // A typed 'a' — the character is stripped, only the modifiers survive.
 * redactEvent({ type: 'key', key: 'a', codepoint: 97, ctrl: false, alt: false, shift: false });
 * // => { type: 'key', printable: true, ctrl: false, alt: false, shift: false }
 *
 * // Safe to log inside your input handler:
 * // logger.debug('input', 'event', redactEvent(event));
 */
export function redactEvent(event: InputEvent): RedactedEvent {
  switch (event.type) {
    case 'key':
      // `codepoint` is present only for printable keys: drop the character and
      // codepoint for those; keep the symbolic name (enter, arrows, ...) otherwise.
      if (event.codepoint !== undefined) {
        return { type: 'key', printable: true, ctrl: event.ctrl, alt: event.alt, shift: event.shift };
      }
      return { type: 'key', key: event.key, ctrl: event.ctrl, alt: event.alt, shift: event.shift };
    case 'mouse':
      return { type: 'mouse', kind: event.kind, button: event.button, x: event.x, y: event.y };
    case 'wheel':
      return { type: 'wheel', dir: event.dir, x: event.x, y: event.y };
    case 'paste':
      // Only the length survives — never the pasted text itself.
      return { type: 'paste', length: event.text.length, truncated: event.truncated };
    case 'focus':
      return { type: 'focus', focused: event.focused };
  }
}

/**
 * Render one `field=value (layer)` pair for a single profile field.
 *
 * Scalars render their value directly. Object groups list their enabled boolean
 * members comma-separated (`sgr,wheel`), with an all-false group collapsing to
 * `-`; non-boolean nested fields render as `name:value`. Never emits any
 * input/clipboard/title text (the profile carries none).
 */
function renderField(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const members: string[] = [];
    for (const [name, member] of Object.entries(value)) {
      if (typeof member === 'boolean') {
        if (member) members.push(name);
      } else {
        members.push(`${name}:${String(member)}`);
      }
    }
    return members.length > 0 ? members.join(',') : '-';
  }
  return String(value);
}

/**
 * Render a one-line, secret-free summary of a resolved capability profile —
 * handy for a single debug log line explaining what the SDK detected and *why*
 * (which resolution layer decided each value).
 *
 * Emits one `field=value (layer)` pair per capability, space-separated, e.g.
 * `colorDepth=truecolor (env) mouse=sgr,wheel (query) ...`. Contains no
 * input/clipboard/title text — only capability values and layer names.
 *
 * @param resolution A `CapabilityResolution` (`{ profile, reasons }`), as returned
 *   by `resolveCapabilities()`.
 * @returns A single screen-safe summary string.
 * @example
 * import { dumpCaps, resolveCapabilities, createLogger } from '@jsvision/core';
 *
 * const resolution = resolveCapabilities();
 * const log = createLogger({ sink: 'ring' });
 * log.debug('caps', dumpCaps(resolution));
 * // e.g. "colorDepth=truecolor (env) unicode=utf8 (env) mouse=sgr,wheel (default) ..."
 */
export function dumpCaps(resolution: CapabilityResolution): string {
  const { profile, reasons } = resolution;
  // `CapabilityProfile` and `CapabilityReasons` share their field names, so a
  // single `keyof` indexes both (no index signature on either).
  const keys = Object.keys(reasons) as Array<keyof CapabilityProfile>;
  const parts = keys.map((key) => `${key}=${renderField(profile[key])} (${reasons[key]})`);
  return parts.join(' ');
}
