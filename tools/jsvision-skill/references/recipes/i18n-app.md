# Recipe: localized application

Import only one requested locale, create one translation service, and keep the application catalog
last.

```ts
import { datagridNl } from '@jsvision/datagrid/locales/nl';
import { codeEditorNl } from '@jsvision/code-editor/locales/nl';
import { filesNl } from '@jsvision/files/locales/nl';
import { formsNl } from '@jsvision/forms/locales/nl';
import { createI18n, defineCatalog, plural } from '@jsvision/i18n';
import { kanbanNl } from '@jsvision/kanban/locales/nl';
import { createApplication } from '@jsvision/ui';
import { uiNl } from '@jsvision/ui/locales/nl';

const appCatalog = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'app.title': 'Voorbeeldtoepassing',
    'app.item-count': plural('count', {
      one: '${count} item',
      other: '${count} items',
    }),
  },
});

const i18n = createI18n({
  locale: 'nl',
  catalogs: [uiNl, formsNl, filesNl, datagridNl, codeEditorNl, kanbanNl, appCatalog],
});

const app = createApplication({ i18n });

app.onCommand('show-count', () => {
  const label = i18n.t('app.item-count', { params: { count: 2 } });
  void label;
});
```

Remove locale imports for framework packages the application does not use. When changing `nl`,
change all locale subpaths and the application catalog locale together.
