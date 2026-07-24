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
  readonly rejected: readonly string[];
  readonly adjustments: readonly {
    readonly path: string;
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
  | { readonly kind: 'application'; readonly overrides?: unknown }
  | { readonly kind: 'independent'; readonly base: CodeEditorTheme; readonly overrides?: unknown };
