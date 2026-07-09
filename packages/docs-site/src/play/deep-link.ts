/**
 * Deep-link parsing for the Play component: a `?example=<id>` query opens that
 * example on page load. An unknown id is a no-op, and a no-keyboard device never
 * opens a terminal (it shows the fallback instead).
 */

/**
 * The example id in a `?example=<id>` query string, if it matches a known example.
 *
 * @param search - the URL query string (e.g. `location.search`).
 * @param knownIds - the registered example ids.
 * @returns the matched id, or `null` when absent or unknown.
 * @example
 * parseDeepLink('?example=controls/button', ['controls/button']); // 'controls/button'
 * parseDeepLink('?example=nope', ['controls/button']);            // null
 */
export function parseDeepLink(search: string, knownIds: readonly string[]): string | null {
  const id = new URLSearchParams(search).get('example');
  return id !== null && knownIds.includes(id) ? id : null;
}

/**
 * The example a deep link should open: the matched id on a keyboard-capable device,
 * or `null` on a no-keyboard device (which shows the fallback, never a terminal).
 *
 * @param search - the URL query string.
 * @param knownIds - the registered example ids.
 * @param noKeyboard - whether the device lacks a hardware keyboard.
 * @returns the example id to open, or `null`.
 * @example
 * deepLinkTarget('?example=controls/button', ids, false); // 'controls/button'
 * deepLinkTarget('?example=controls/button', ids, true);  // null (no keyboard → fallback)
 */
export function deepLinkTarget(search: string, knownIds: readonly string[], noKeyboard: boolean): string | null {
  if (noKeyboard) return null;
  return parseDeepLink(search, knownIds);
}
