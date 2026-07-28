import { CodeEditorWindow } from '@jsvision/code-editor';
import type { CodeEditorController } from '@jsvision/code-editor';
import { codeEditorNl } from '@jsvision/code-editor/locales/nl';
import { createI18n, defineCatalog } from '@jsvision/i18n';

/**
 * Create a localized Code Editor surface from an application-owned translation service.
 *
 * @example
 * ```ts
 * const editorWindow = createLocalizedCodeEditorWindow(controller);
 * ```
 */
export function createLocalizedCodeEditorWindow(controller: CodeEditorController): CodeEditorWindow {
  const overrides = defineCatalog({
    schema: 1,
    locale: 'nl',
    messages: { 'code-editor.window.title': 'Broneditor' },
  });
  const i18n = createI18n({ locale: 'nl', catalogs: [codeEditorNl, overrides] });
  return new CodeEditorWindow({ controller, i18n });
}
