import { createI18n, defineCatalog, plural, select } from '@jsvision/i18n';
import type { I18n } from '@jsvision/i18n';
import { Group, Text, at, signal } from '@jsvision/ui';

const englishCatalog = defineCatalog({
  schema: 1,
  locale: 'en',
  messages: {
    'app.files': plural('count', {
      one: '${count} file',
      other: '${count} files',
    }),
    'app.role': select('role', {
      admin: 'Administrator',
      other: 'Member',
    }),
    'app.save': 'Save',
  },
});

const dutchCatalog = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'app.save': 'Opslaan',
  },
});

/**
 * Demonstrates locale fallback, value-free diagnostics, and atomic runtime overlays.
 *
 * The panel owns a deterministic service and never consults browser locale, storage, or network
 * state. This keeps every interaction repeatable in the documentation and headless tests.
 */
export class CatalogLabPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Catalog lookup and safe publication';

  /** Number of structured translation exercises. */
  public translationRuns = 0;

  /** Number of missing-key exercises. */
  public missingRuns = 0;

  /** Number of successfully published overlays. */
  public overlayRuns = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Locale-bound service shared by every row in the lesson. */
  public readonly i18n: I18n = createI18n({
    locale: 'nl-BE',
    fallbackLocales: ['en'],
    catalogs: [englishCatalog, dutchCatalog],
  });

  /** Latest structured-message result. */
  protected readonly translationResult = signal('not run');

  /** Latest missing-key result and diagnostic evidence. */
  protected readonly missingResult = signal('not run');

  /** Latest atomic publication result. */
  protected readonly overlayResult = signal('not run');

  /** Most recent input route. */
  protected readonly actionSource = signal('ready');

  /** Build the non-colour evidence rows. */
  public constructor() {
    super();
    this.add(at(new Text('Requested nl-BE → nl catalog → en fallback'), 0, 0, 60, 1));
    this.add(at(new Text('Later same-locale layers win; English is the final fallback.'), 0, 1, 60, 1));
    this.add(at(new Text(() => `Translate: ${this.translationResult()}`), 0, 3, 60, 1));
    this.add(at(new Text(() => `Missing: ${this.missingResult()}`), 0, 4, 60, 1));
    this.add(at(new Text(() => `Overlay: ${this.overlayResult()}`), 0, 5, 60, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 7, 60, 1));
    this.add(at(new Text('Diagnostics are bounded, deduplicated, and contain no values.'), 0, 8, 60, 1));
    this.add(at(new Text('No network, files, or visitor locale is read by this lab.'), 0, 9, 60, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Resolve a Dutch key plus English plural/select fallbacks. */
  public translate(source: 'keyboard' | 'mouse'): void {
    const save = this.i18n.t('app.save');
    const files = this.i18n.t('app.files', { params: { count: 2 } });
    const role = this.i18n.t('app.role', { params: { role: 'admin' } });
    this.translationRuns += 1;
    this.translationResult.set(`${save} · fallback: ${files} · ${role}`);
    this.actionSource.set(source);
  }

  /** Resolve an absent key and expose only its safe diagnostic identity. */
  public showMissing(source: 'keyboard' | 'mouse'): void {
    const fallback = this.i18n.t('app.missing');
    const diagnostic = this.i18n.diagnostics.at(-1);
    this.missingRuns += 1;
    this.missingResult.set(
      `${fallback} · ${diagnostic?.code === 'MISSING_TRANSLATION' ? 'missing translation' : 'unexpected'}`,
    );
    this.actionSource.set(source);
  }

  /** Prove that a rejected replacement cannot disturb the previous published catalog. */
  public publishOverlay(source: 'keyboard' | 'mouse'): void {
    const before = this.i18n.t('app.save');
    let rejected = false;
    try {
      this.i18n.setCatalog({
        schema: 1,
        locale: 'nl',
        messages: { 'app.save': '\u001b[31munsafe' },
      });
    } catch {
      rejected = true;
    }
    const preserved = this.i18n.t('app.save') === before;
    this.i18n.setCatalog({
      schema: 1,
      locale: 'nl',
      messages: { 'app.save': 'Bewaren' },
    });
    this.overlayRuns += 1;
    this.overlayResult.set(
      `atomic overlay: rejected ${rejected ? 'yes' : 'no'} · prior preserved ${preserved ? 'yes' : 'no'} · ${this.i18n.t('app.save')}`,
    );
    this.actionSource.set(source);
  }
}
