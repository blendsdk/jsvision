import type { InputEvent, KeyEvent } from '@jsvision/core';

/**
 * Controls whether Alt plus the number-row aliases is interpreted as F1–F12.
 *
 * `createApplication` enables the mapping by default. A directly-created event
 * loop keeps literal Alt chords unless its caller opts in.
 *
 * @example
 * import { createEventLoop } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const loop = createEventLoop(
 *   { width: 80, height: 24 },
 *   { caps, functionKeyFallback: 'number-row' },
 * );
 */
export type FunctionKeyFallback = 'number-row' | 'none';

const NUMBER_ROW_FUNCTION_KEYS: Readonly<Record<string, string>> = {
  '1': 'f1',
  '2': 'f2',
  '3': 'f3',
  '4': 'f4',
  '5': 'f5',
  '6': 'f6',
  '7': 'f7',
  '8': 'f8',
  '9': 'f9',
  '0': 'f10',
  '-': 'f11',
  '=': 'f12',
};

/**
 * Normalize an approved Alt number-row chord into an unmodified function key.
 *
 * Only the exact `number-row` policy enables the mapping. Unknown values from
 * untyped JavaScript therefore preserve input instead of changing behavior.
 */
export function normalizeFunctionKey(event: InputEvent, policy: FunctionKeyFallback): InputEvent {
  if (policy !== 'number-row' || event.type !== 'key' || !event.alt || event.ctrl || event.shift) {
    return event;
  }
  const functionKey = NUMBER_ROW_FUNCTION_KEYS[event.key];
  if (functionKey === undefined) {
    return event;
  }
  const normalized: KeyEvent = {
    type: 'key',
    key: functionKey,
    ctrl: false,
    alt: false,
    shift: false,
  };
  return normalized;
}
