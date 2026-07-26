import type { Catalog, I18n } from '@jsvision/i18n';
import type { Application, Signal, View } from '@jsvision/ui';

/** Locale identifiers shipped by every framework package in the multilingual demo. */
export type OfficialI18nLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it' | 'pt-PT' | 'pl' | 'ro' | 'sv';

/** Story categories displayed by the interactive multilingual demo. */
export type I18nStoryCategory =
  'standard-actions' | 'ui' | 'forms' | 'files' | 'datagrid' | 'formatting' | 'overrides' | 'unicode' | 'code-editor';

/** Supported action layouts exposed by the headless geometry snapshot. */
export type ActionArrangement = 'single' | 'pair' | 'one-row' | 'wrapped' | 'vertical';

/** A terminal viewport measured in display cells. */
export interface I18nDemoViewport {
  readonly width: number;
  readonly height: number;
}

/** One absolute terminal-cell rectangle. */
export interface I18nCellBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Viewport boundaries declared by one story. */
export interface I18nStoryViewports {
  readonly standard: { readonly width: 80; readonly height: 24 };
  readonly narrow: readonly I18nDemoViewport[];
  readonly infeasible: I18nDemoViewport;
}

/** Stable, serializable metadata shared by the interactive shell and headless tests. */
export interface I18nStoryMetadata {
  readonly id: string;
  readonly category: I18nStoryCategory;
  readonly title: string;
  readonly coverage: readonly string[];
  readonly viewports: I18nStoryViewports;
}

/** Public focus and pointer evidence for one story action. */
export interface I18nActionSnapshot {
  readonly id: string;
  readonly label: string;
  readonly naturalWidth: number;
  readonly bounds: I18nCellBounds;
  readonly hitBounds: I18nCellBounds;
  readonly focusIndex: number;
  /** Actual command configured on the Button, or `null` for callback-only/inert controls. */
  readonly command: string | null;
  /** Whether the Button has an application callback bound to activation. */
  readonly hasCallback: boolean;
  /** Complete activation shape derived from the real Button rather than registry placeholders. */
  readonly activation: 'command' | 'callback' | 'command-and-callback' | 'none';
}

/** Public render evidence produced without exposing private widget fields. */
export interface I18nLayoutSnapshot {
  readonly viewport: I18nDemoViewport;
  readonly surfaces: readonly I18nCellBounds[];
  readonly descendants: readonly I18nCellBounds[];
  /** Visible application popup-overlay surfaces, kept separate for precise lifecycle assertions. */
  readonly overlaySurfaces: readonly I18nCellBounds[];
  /** Descendants mounted in visible application popup overlays. */
  readonly overlayDescendants: readonly I18nCellBounds[];
  readonly actions: readonly I18nActionSnapshot[];
  readonly rows: readonly string[];
  /** Exact glyph content of every rendered cell, including combining sequences. */
  readonly cellChars: readonly (readonly string[])[];
  /** Display width of every rendered cell, preserving wide-glyph continuation evidence. */
  readonly cellWidths: readonly (readonly number[])[];
  readonly arrangement: ActionArrangement;
}

/** Serializable selection that is allowed to survive an application reconstruction. */
export interface I18nDemoSelection {
  readonly locale: OfficialI18nLocale;
  readonly storyId: string;
}

/** Story state and teardown owned by one freshly constructed application. */
export interface I18nStoryLifecycle {
  readonly root: View;
  readonly state: Signal<unknown>;
  close(): Promise<void>;
}

/** One fresh framework application, registry, and story instance. */
export interface I18nDemoSession {
  readonly selection: I18nDemoSelection;
  readonly catalogs: readonly Catalog[];
  readonly i18n: I18n;
  readonly application: Application;
  readonly registry: readonly I18nStoryMetadata[];
  readonly story: I18nStoryLifecycle;
  readonly callerData?: Uint8Array;
  isDisposed(): boolean;
}

/** Disposable headless construction used by the registry-driven layout matrix. */
export interface HeadlessI18nStory {
  readonly metadata: I18nStoryMetadata;
  snapshot(): I18nLayoutSnapshot;
  dispose(): Promise<void>;
}

/** Options for constructing one headless multilingual story. */
export interface ConstructHeadlessI18nStoryOptions {
  readonly locale: string;
  readonly storyId: string;
  readonly viewport: I18nDemoViewport;
  readonly applicationCatalog?: Readonly<Record<string, string>>;
  readonly callerData?: Uint8Array;
}

/** Serializable supervisor that reconstructs framework state for every selection change. */
export interface I18nDemoSupervisor {
  readonly selection: I18nDemoSelection;
  construct(options?: { readonly callerData?: Uint8Array }): Promise<I18nDemoSession>;
  transition(
    previous: I18nDemoSession,
    requested: I18nDemoSelection,
  ): Promise<{ readonly supervisor: I18nDemoSupervisor; readonly session: I18nDemoSession }>;
  toJSON(): I18nDemoSelection;
}
