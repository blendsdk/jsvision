import type { AttrMask, CapabilityProfile, ThemeRole } from '@jsvision/core';

/** Closed ordered semantic-role inventory understood by Kanban descriptors and themes. */
export const KANBAN_THEME_ROLES = Object.freeze([
  'board.surface',
  'column.surface',
  'column.header',
  'column.header.focused',
  'column.separator',
  'swimlane.surface',
  'swimlane.header',
  'swimlane.header.focused',
  'swimlane.separator',
  'card.normal',
  'card.focused',
  'card.selected',
  'card.focused-selected',
  'card.read-only',
  'card.grabbed',
  'card.source-placeholder',
  'card.ghost',
  'drop-target.valid',
  'drop-target.warning',
  'drop-target.invalid',
  'operation.pending',
  'operation.rejected',
  'wip.warning',
  'wip.error',
  'dod.indicator',
  'state.loading',
  'state.refreshing',
  'state.partial',
  'state.empty',
  'state.error',
  'state.retry',
  'content.title',
  'content.status',
  'content.metadata',
  'content.label',
  'content.summary',
  'checklist.complete',
  'checklist.incomplete',
  'checklist.progress',
] as const);

/** One allowlisted package-local semantic role. */
export type KanbanThemeRole = (typeof KANBAN_THEME_ROLES)[number];

/** One non-color distinction retained when terminal color is unavailable or insufficient. */
export type KanbanNonColorCue =
  | { readonly kind: 'marker'; readonly glyph: string }
  | { readonly kind: 'border'; readonly style: 'single' | 'double' | 'heavy' | 'dashed' }
  | { readonly kind: 'attribute'; readonly attrs: AttrMask }
  | { readonly kind: 'text'; readonly prefix: string };

/** Complete immutable style and fallback chain for one semantic role. */
export interface KanbanThemeToken {
  /** Explicitly resolved Kanban style. */
  readonly style: ThemeRole;
  /** Role-specific style derived directly from the application Core theme. */
  readonly mappedFallback: ThemeRole;
  /** Family-level terminal-safe fallback used after the mapped role. */
  readonly terminalFallback: ThemeRole;
  /** Non-empty redundant cues that preserve meaning without color. */
  readonly cues: readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];
}

/** Versioned complete package-local semantic palette consumed by card descriptors. */
export interface KanbanTheme {
  /** Exact contract version understood by this package release. */
  readonly contractVersion: 1;
  /** Complete token map for every allowlisted semantic role. */
  readonly roles: Readonly<Record<KanbanThemeRole, KanbanThemeToken>>;
}

/** Caller overrides applied above mapped Core roles during safe theme resolution. */
export type KanbanThemeOverrides = Readonly<Partial<Record<KanbanThemeRole, Readonly<Partial<ThemeRole>>>>>;

/** Bounded evidence describing rejected input and deterministic accessibility repairs. */
export interface KanbanThemeResolutionReport {
  /** Bounded semantic paths rejected while reading caller data. */
  readonly rejected: readonly string[];
  /** Capability or readability adjustments applied to otherwise valid input. */
  readonly adjustments: readonly {
    /** Allowlisted semantic path, or `*` for a palette-wide capability adaptation. */
    readonly path: string;
    /** Stable reason the requested presentation was not used unchanged. */
    readonly reason: 'minimum-contrast' | 'capability-fallback' | 'unknown-role';
  }[];
}

/** Complete safe theme together with inspectable resolution evidence. */
export interface ResolvedKanbanTheme {
  /** Deeply immutable complete Kanban theme. */
  readonly theme: KanbanTheme;
  /** Deeply immutable bounded resolution report. */
  readonly report: KanbanThemeResolutionReport;
}

/** Effective style and non-color evidence for one requested semantic role. */
export interface KanbanResolvedThemeRole {
  /** Allowlisted role ultimately selected for drawing. */
  readonly role: KanbanThemeRole;
  /** Detached terminal style selected by the fallback chain. */
  readonly style: ThemeRole;
  /** Non-empty redundant semantic cues. */
  readonly cues: readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];
  /** Fallback stage that produced the effective style. */
  readonly fallback: 'none' | 'mapped-core' | 'family' | 'emergency';
  /** Effective-depth contrast ratio; omitted for monochrome, no-color, or unresolvable defaults. */
  readonly contrastRatio?: number;
}

/** Minimal capability projection required by semantic theme-role resolution. */
export type KanbanThemeCapabilities = Pick<CapabilityProfile, 'colorDepth'> & {
  /** Treat color as unavailable while preserving attributes and non-color cues. */
  readonly noColor?: boolean;
};
