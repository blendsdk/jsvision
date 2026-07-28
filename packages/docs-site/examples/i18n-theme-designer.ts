/**
 * A headless-safe localized application recipe. Framework catalogs are loaded first and the
 * application catalog is last, so product copy can override its own keys without mutating SDK
 * catalogs.
 */
import { createTheme } from '@jsvision/core';
import type { Theme } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { datagridNl } from '@jsvision/datagrid/locales/nl';
import { codeEditorNl } from '@jsvision/code-editor/locales/nl';
import { filesNl } from '@jsvision/files/locales/nl';
import { formsNl } from '@jsvision/forms/locales/nl';
import {
  Button,
  Commands,
  Dialog,
  ListBox,
  Text,
  at,
  buttonGroup,
  cancelButton,
  createApplication,
  createRoot,
  effect,
  measureButtonGroup,
  okButton,
  signal,
} from '@jsvision/ui';
import { uiNl } from '@jsvision/ui/locales/nl';
import { defineExample } from './_contract.js';

const DIALOG_WIDTH = 44;
const DIALOG_HEIGHT = 13;
const CHOICES = [
  { name: 'Rood', accent: '#F44336' },
  { name: 'Paars', accent: '#9C27B0' },
  { name: 'Blauw', accent: '#2196F3' },
  { name: 'Turkoois', accent: '#009688' },
  { name: 'Groen', accent: '#4CAF50' },
  { name: 'Oranje', accent: '#FF9800' },
] as const;

const appNl = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'app.theme-designer.title': 'Themaontwerper',
    'app.theme-designer.help': 'Pijltjes tonen een voorbeeld; OK past het thema toe.',
  },
});

/** Generate the complete semantic theme preview for one source accent. */
function previewTheme(index: number): Theme {
  const choice = CHOICES[index] ?? CHOICES[0];
  return createTheme({ mode: 'light', accent: choice.accent });
}

export default defineExample({
  title: 'Localized Theme Designer',
  blurb: 'One Dutch translation service shared by the application and every framework package.',
  build: (context) => {
    const i18n = createI18n({
      locale: 'nl',
      catalogs: [uiNl, formsNl, filesNl, datagridNl, codeEditorNl, appNl],
    });
    const app = createApplication({
      caps: context.caps,
      viewport: { width: context.width, height: context.height },
      i18n,
    });
    const focused = signal(3);
    const selected = signal(3);
    const items = signal(CHOICES.map(({ name }) => name));
    const list = new ListBox({
      items,
      focused,
      selected,
      command: Commands.ok,
      typeAhead: true,
    });
    const actionButtons: Button[] = [okButton(i18n), cancelButton(i18n)];
    const dialogWidth = Math.min(DIALOG_WIDTH, Math.max(1, context.width - 2));
    const contentWidth = Math.max(0, dialogWidth - 2);
    const unwrappedOptions = { minimumButtonWidth: 10, gap: 2 } as const;
    const unwrappedMetrics = measureButtonGroup(actionButtons, unwrappedOptions);
    const actionOptions =
      unwrappedMetrics.width <= contentWidth
        ? unwrappedOptions
        : ({ minimumButtonWidth: 10, gap: 2, maxColumns: 1 } as const);
    const actionMetrics = measureButtonGroup(actionButtons, actionOptions);
    const actions = buttonGroup(actionButtons, actionOptions);
    const desiredDialogHeight = DIALOG_HEIGHT + actionMetrics.height - 2;
    const dialogHeight = Math.min(desiredDialogHeight, Math.max(1, context.height));
    const contentHeight = Math.max(0, dialogHeight - 2);
    const actionX = Math.max(0, Math.floor((contentWidth - actionMetrics.width) / 2));
    const actionY = Math.max(0, contentHeight - actionMetrics.height);
    const dialog = new Dialog({
      title: ` ${i18n.t('app.theme-designer.title')} `,
      width: dialogWidth,
      height: dialogHeight,
    });
    dialog.add(at(new Text(i18n.t('app.theme-designer.help')), 2, 1, DIALOG_WIDTH - 4, 2));
    dialog.add(at(list, 2, 4, DIALOG_WIDTH - 4, 4));
    dialog.add(at(actions, actionX, actionY, actionMetrics.width, actionMetrics.height));

    let committed = previewTheme(selected());
    let preview = committed;
    app.setTheme(committed);
    const disposePreview = createRoot((dispose) => {
      effect(() => {
        preview = previewTheme(focused());
        app.setTheme(preview);
      });
      return dispose;
    });
    context.onCleanup?.(disposePreview);

    app.desktop.addWindow(dialog);
    void app.loop
      .execView<string>(dialog)
      .then((command) => {
        if (command === Commands.ok) {
          committed = preview;
          selected.set(focused());
        } else {
          app.setTheme(committed);
        }
      })
      .finally(() => app.desktop.removeWindow(dialog));
    return app;
  },
});
