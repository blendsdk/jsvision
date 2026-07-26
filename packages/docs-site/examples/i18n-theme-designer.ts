/**
 * A headless-safe localized application recipe. Framework catalogs are loaded first and the
 * application catalog is last, so product copy can override its own keys without mutating SDK
 * catalogs.
 */
import { createTheme } from '@jsvision/core';
import type { Theme } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { datagridNl } from '@jsvision/datagrid/locales/nl';
import { filesNl } from '@jsvision/files/locales/nl';
import { formsNl } from '@jsvision/forms/locales/nl';
import {
  Commands,
  Dialog,
  ListBox,
  Text,
  at,
  cancelButton,
  createApplication,
  createRoot,
  effect,
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
      catalogs: [uiNl, formsNl, filesNl, datagridNl, appNl],
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
    const dialog = new Dialog({
      title: ` ${i18n.t('app.theme-designer.title')} `,
      width: Math.min(DIALOG_WIDTH, Math.max(1, context.width - 2)),
      height: Math.min(DIALOG_HEIGHT, Math.max(1, context.height)),
    });
    dialog.add(at(new Text(i18n.t('app.theme-designer.help')), 2, 1, DIALOG_WIDTH - 4, 2));
    dialog.add(at(list, 2, 4, DIALOG_WIDTH - 4, 4));
    dialog.add(at(okButton(i18n), 9, 9, 10, 2));
    dialog.add(at(cancelButton(i18n), 22, 9, 12, 2));

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
