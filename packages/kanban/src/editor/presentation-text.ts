import type { I18n } from '@jsvision/i18n';

import { snapshotKanbanLabel } from '../contract/capability.js';

/** Last-resort text used when both translation and caller fallback are unavailable or unsafe. */
const SAFE_EDITOR_FALLBACK = 'Kanban editor';
/** ANSI control sequences removed as units so their parameter bytes never become visible labels. */
const ANSI_CONTROL_SEQUENCE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?|.)/gu;

/** Converts an unknown message into one bounded editor label. */
function safeEditorLabel(value: unknown): string | undefined {
  return typeof value === 'string' ? snapshotKanbanLabel(value.replace(ANSI_CONTROL_SEQUENCE, '')) : undefined;
}

/**
 * Resolves one bounded terminal-safe editor message while containing application translation failures.
 *
 * The fallback is passed through the same sanitizer as translated text, so neither source can inject
 * terminal controls or force unbounded measurement.
 */
export function resolveKanbanEditorMessage(i18n: I18n | undefined, messageId: string, fallback = messageId): string {
  let translated: unknown;
  try {
    translated = i18n?.t(messageId, { defaultMessage: fallback });
  } catch {
    translated = undefined;
  }
  return safeEditorLabel(translated) ?? safeEditorLabel(fallback) ?? SAFE_EDITOR_FALLBACK;
}
