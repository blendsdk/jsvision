import type { Color } from '@jsvision/core';
import { syntaxCategories } from '../languages/contracts.js';
import type { CodeEditorCellStyle, CodeEditorTheme } from './theme.js';

function style(foreground: Color, background: Color, attrs?: number): CodeEditorCellStyle {
  return Object.freeze({ foreground, background, ...(attrs === undefined ? {} : { attrs }) });
}

function createPreset(
  name: string,
  background: Color,
  foreground: Color,
  accent: Color,
  selection: Color,
): CodeEditorTheme {
  const syntax = Object.fromEntries(
    syntaxCategories.map((category, index) => [
      category,
      style(index % 3 === 0 ? accent : index % 3 === 1 ? foreground : selection, background),
    ]),
  ) as unknown as CodeEditorTheme['syntax'];
  return Object.freeze({
    contractVersion: 1,
    name,
    surfaces: Object.freeze({
      editor: style(foreground, background),
      gutter: style(accent, background),
      activeLine: style(foreground, background),
      selection: style(background, selection),
      status: style(background, accent),
    }),
    syntax: Object.freeze(syntax),
    structure: Object.freeze({
      gutter: style(accent, background),
      lineNumber: style(accent, background),
      fold: style(accent, background),
      bracket: style(background, accent),
      search: style(background, selection),
      invisible: style(accent, background),
    }),
    diagnostics: Object.freeze({
      error: style('#ff5555', background),
      warning: style('#f1fa8c', background),
      information: style('#8be9fd', background),
      hint: style(accent, background),
    }),
    assistance: Object.freeze({
      popup: style(foreground, background),
      selected: style(background, accent),
      snippet: style(accent, background),
      snippetActive: style(background, selection),
    }),
  });
}

/** Dark independent editor preset. */
export const darkCodeEditorTheme = createPreset('dark', '#1e1e1e', '#d4d4d4', '#569cd6', '#264f78');
/** Light independent editor preset. */
export const lightCodeEditorTheme = createPreset('light', '#ffffff', '#1f2328', '#0550ae', '#b6d7ff');
/** Classic terminal editor preset. */
export const classicCodeEditorTheme = createPreset('classic', 'blue', 'brightWhite', 'yellow', 'cyan');
