/** Authorization states exercised by the deterministic clipboard-boundary laboratory. */
export type ClipboardAuthorization = 'unavailable' | 'denied' | 'authorized';

/** Safe sample committed to the application-local clipboard by the laboratory. */
export const CLIPBOARD_SAMPLE = 'course sample';

/**
 * Advance through the three host-authorization states in the lesson's stable order.
 *
 * @param current Current virtual host state.
 * @returns The next state, wrapping from authorized to unavailable.
 */
export function nextClipboardAuthorization(current: ClipboardAuthorization): ClipboardAuthorization {
  switch (current) {
    case 'unavailable':
      return 'denied';
    case 'denied':
      return 'authorized';
    case 'authorized':
      return 'unavailable';
  }
}

/**
 * Describe a canonical-first copy without including clipboard payload text.
 *
 * @param authorization Current virtual host state.
 * @returns Learner-visible copy outcome.
 */
export function copyOutcome(authorization: ClipboardAuthorization): string {
  if (authorization === 'authorized') return 'Copy: local success > host authorized';
  return `Copy: local success > host ${authorization}`;
}
