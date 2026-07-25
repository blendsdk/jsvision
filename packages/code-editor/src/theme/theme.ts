import type { AttrMask, Color } from '@jsvision/core';
import type { SyntaxCategory } from '../languages/contracts.js';

/** One terminal-safe semantic cell style used by the code editor. */
export interface CodeEditorCellStyle {
  readonly foreground: Color;
  readonly background: Color;
  readonly attrs?: AttrMask;
}

/** Versioned, complete semantic palette consumed by the editor projection. */
export interface CodeEditorTheme {
  readonly contractVersion: 1;
  readonly name: string;
  readonly surfaces: Readonly<Record<'editor' | 'gutter' | 'activeLine' | 'selection' | 'status', CodeEditorCellStyle>>;
  readonly syntax: Readonly<Record<SyntaxCategory, CodeEditorCellStyle>>;
  readonly structure: Readonly<
    Record<'gutter' | 'lineNumber' | 'fold' | 'bracket' | 'search' | 'invisible', CodeEditorCellStyle>
  >;
  readonly diagnostics: Readonly<Record<'error' | 'warning' | 'information' | 'hint', CodeEditorCellStyle>>;
  readonly assistance: Readonly<Record<'popup' | 'selected' | 'snippet' | 'snippetActive', CodeEditorCellStyle>>;
}

/** One rejected theme input or deterministic accessibility adjustment. */
export interface CodeEditorThemeResolutionReport {
  /** Highest-precedence layer that contributed a valid value. */
  readonly activeLayer:
    'application-derived' | 'application' | 'editor' | 'independent' | 'last-valid' | 'safe-default';
  /** Sanitized palette name or derivation source used as the complete base. */
  readonly fallbackSource: string;
  /** Bounded semantic paths rejected during validation. */
  readonly rejected: readonly string[];
  /** Deterministic accessibility or terminal-capability repairs applied during resolution. */
  readonly adjustments: readonly {
    /** Semantic role path, or `*` when the complete palette was adapted. */
    readonly path: string;
    /** Why the requested presentation could not be used unchanged. */
    readonly reason: 'minimum-contrast' | 'capability-fallback';
  }[];
}

/** Complete theme plus inspectable resolution evidence. */
export interface ResolvedCodeEditorTheme {
  readonly contractVersion: 1;
  readonly theme: CodeEditorTheme;
  readonly report: CodeEditorThemeResolutionReport;
}

/** Hybrid application-derived or independent theme selection. */
export type CodeEditorThemeSource =
  | {
      readonly kind: 'application';
      /** Application-wide editor-role overrides applied above derived application colors. */
      readonly applicationOverrides?: unknown;
      /** Per-editor overrides applied above the application editor layer. */
      readonly overrides?: unknown;
    }
  | { readonly kind: 'independent'; readonly base: CodeEditorTheme; readonly overrides?: unknown };
