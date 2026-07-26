import type { I18n } from '@jsvision/i18n';

/** Classify accelerator markup without interpreting escaped `~~` as a shortcut. */
function acceleratorState(label: string): 'absent' | 'present' | 'malformed' {
  let count = 0;
  for (let index = 0; index < label.length; index += 1) {
    if (label[index] !== '~') continue;
    if (label[index + 1] === '~') {
      index += 1;
      continue;
    }
    const marked = label[index + 1];
    if (marked === undefined || label[index + 2] !== '~' || !/[A-Za-z]/u.test(marked)) return 'malformed';
    count += 1;
    if (count > 1) return 'malformed';
    index += 2;
  }
  return count === 1 ? 'present' : 'absent';
}

/**
 * Resolve a Datagrid-owned action label, recovering only an unsafe application override.
 *
 * @param i18n Service containing framework and application catalogs.
 * @param key Stable Datagrid message key.
 * @param english Canonical safe English label.
 * @param required Whether the label must contain one accelerator marker.
 * @returns The translated label when its markup is valid; otherwise the English label.
 */
export function datagridAcceleratorLabel(i18n: I18n, key: string, english: string, required: boolean): string {
  const translated = i18n.t(key, { defaultMessage: english });
  const state = acceleratorState(translated);
  return state === 'malformed' || (required && state === 'absent') ? english : translated;
}
