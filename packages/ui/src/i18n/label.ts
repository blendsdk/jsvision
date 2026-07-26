import type { I18n } from '@jsvision/i18n';

/** Return whether a label contains exactly one well-formed ASCII `~X~` accelerator marker. */
function hasValidAccelerator(label: string): boolean {
  let count = 0;
  for (let index = 0; index < label.length; index += 1) {
    if (label[index] !== '~') continue;
    if (label[index + 1] === '~') {
      index += 1;
      continue;
    }
    const marked = label[index + 1];
    if (marked === undefined || label[index + 2] !== '~' || !/[A-Za-z]/u.test(marked)) return false;
    count += 1;
    if (count > 1) return false;
    index += 2;
  }
  return count === 1;
}

/**
 * Resolve a translated accelerator label, falling back only that label when its markup is unsafe.
 *
 * Catalog validation reports malformed application overrides, while this draw-time boundary keeps
 * the affected control keyboard-reachable without discarding unrelated valid overrides.
 */
export function uiAcceleratorLabel(i18n: I18n, key: string, english: string): string {
  const translated = i18n.t(key, { defaultMessage: english });
  return hasValidAccelerator(translated) ? translated : english;
}
