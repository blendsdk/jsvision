import { createI18n, defineCatalog } from '@jsvision/i18n';
import type { I18n } from '@jsvision/i18n';
import { Button, Group, Text, at, buttonGroup, measureButtonGroup, signal } from '@jsvision/ui';

type LessonLocale = 'en' | 'de';

const englishCatalog = defineCatalog({
  schema: 1,
  locale: 'en',
  messages: {
    'app.apply': '~A~pply settings',
    'app.discard': '~D~iscard changes',
    'app.summary': 'Settings are ready',
  },
});

const germanCatalog = defineCatalog({
  schema: 1,
  locale: 'de',
  messages: {
    'app.apply': '~E~instellungen übernehmen',
    'app.discard': '~Ä~nderungen verwerfen',
    'app.summary': 'Die Einstellungen sind bereit',
  },
});

/**
 * Rebuilds a translated control subtree and measures its complete action group in terminal cells.
 *
 * A production locale switch reconstructs the service and application tree. This bounded panel
 * applies the same rule to its lesson subtree so the live host itself can remain open.
 */
export class LocaleLayoutPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Locale reconstruction and translated geometry';

  /** Number of locale reconstruction exercises. */
  public switchRuns = 0;

  /** Number of translated actions reached through their real controls. */
  public actionRuns = 0;

  /** Number of translated action subtrees replaced during reconstruction. */
  public replacedSubtrees = 0;

  /** Number of replaced subtrees observed detached and scope-free. */
  public disposedSubtrees = 0;

  /** Most recently detached translated action group, retained only as lifecycle evidence. */
  public lastReplacedActions: Group | undefined;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Currently requested lesson locale. */
  protected readonly currentLocale = signal<LessonLocale>('en');

  /** Evidence describing the latest reconstruction. */
  protected readonly status = signal('English subtree ready');

  /** Current locale-bound service. */
  protected i18n: I18n = this.createService('en');

  /** Current measured action group, replaced as one owned subtree. */
  protected actions: Group | undefined;

  /** Build stable readout rows and the first translated subtree. */
  public constructor() {
    super();
    this.add(at(new Text(() => `Locale: ${this.currentLocale()}`), 0, 0, 60, 1));
    this.add(at(new Text(() => `Summary: ${this.i18n.t('app.summary')}`), 0, 1, 60, 1));
    this.add(at(new Text(() => `Status: ${this.status()}`), 0, 3, 60, 1));
    this.add(at(new Text('Cell probe: wide 界 · combining é · captions exclude ~X~ markup'), 0, 5, 60, 1));
    this.add(at(new Text('The complete translated action group is measured before layout.'), 0, 6, 60, 1));
    this.add(at(new Text('Production rule: fresh I18n + fresh Application, then dispose old.'), 0, 8, 60, 1));
    this.rebuildActions();
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Locale exposed as a readonly value for course behavior tests. */
  public get locale(): LessonLocale {
    return this.currentLocale();
  }

  /** Reconstruct the locale-bound service and every translated control in the lesson subtree. */
  public switchLocale(source: 'keyboard' | 'mouse'): void {
    const next: LessonLocale = this.currentLocale() === 'en' ? 'de' : 'en';
    this.i18n = this.createService(next);
    this.currentLocale.set(next);
    this.rebuildActions();
    this.switchRuns += 1;
    this.status.set(`${next} rebuilt from a fresh service via ${source}; old translated controls disposed`);
  }

  /** Create one deterministic locale service without environment detection. */
  protected createService(locale: LessonLocale): I18n {
    return createI18n({
      locale,
      catalogs: [englishCatalog, germanCatalog],
    });
  }

  /** Replace and center the complete measured action group. */
  protected rebuildActions(): void {
    if (this.actions !== undefined) {
      const previous = this.actions;
      this.remove(previous);
      this.lastReplacedActions = previous;
      this.replacedSubtrees += 1;
      if (!previous.mounted && previous.scope === null) this.disposedSubtrees += 1;
    }
    const activate = (identity: 'apply' | 'discard'): void => {
      this.actionRuns += 1;
      this.status.set(`${identity} activated`);
    };
    const buttons = [
      new Button(this.i18n.t('app.apply'), {
        onClick: () => activate('apply'),
      }),
      new Button(this.i18n.t('app.discard'), {
        onClick: () => activate('discard'),
      }),
    ];
    const options = { minimumButtonWidth: 12, gap: 2 } as const;
    const metrics = measureButtonGroup(buttons, options);
    const actions = buttonGroup(buttons, options);
    const x = Math.max(0, Math.floor((60 - metrics.width) / 2));
    this.actions = at(actions, x, 10, metrics.width, metrics.height);
    this.add(this.actions);
  }
}
