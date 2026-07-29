---
title: Code Editor themes and fallbacks
description: Resolve Classic-compatible, dark, light, and custom Code Editor themes with explicit fallbacks, contrast, non-color indicators, and live application integration.
---

# Themes and fallbacks

Code Editor themes style syntax categories and editor states while the surrounding application
continues to own its Classic shell and semantic theme roles. Resolution reports explain which
source won and where a requested token fell back.

## Focused usage

```ts
import { CodeEditor, darkCodeEditorTheme } from '@jsvision/code-editor';

const editor = new CodeEditor({ controller });
editor.setTheme(darkCodeEditorTheme);
```

## Theme presets

Classic-compatible, dark, and light presets keep editor state consistent while changing syntax
contrast. Selection, active line, folding, diagnostics, pending work, read-only mode, and
degradation retain non-color cues.

<PlayExample id="code-editor/themes"
  title="Live editor themes"
  blurb="Switch the real editor from its Classic-compatible palette to dark and inspect the named active theme."
/>

## Resolution and fallback

Custom themes should be resolved before use. Missing or invalid tokens fall back through the
documented chain and produce a report that can be surfaced in diagnostics without exposing source
content.

<PlayExample id="code-editor/theme-fallback"
  title="Theme fallback report"
  blurb="Resolve an intentionally incomplete theme and inspect the safe fallback to the Classic-compatible palette."
/>

## Limits and practices

- Resolve theme sources through the public helper instead of indexing unknown tokens while drawing.
- Check contrast for text, selection, diagnostics, active line, and assistance overlays.
- Preserve shape, glyph, border, or label cues wherever color communicates state.
- Keep the template1 dialog on its application theme surface; editor themes belong inside it.

## Related

- [Overview](/components/code-editor/) — choose direct or windowed composition.
- [Language intelligence](/components/code-editor/language-intelligence) — theme diagnostic and
  assistance presentation.
- [`resolveCodeEditorTheme` API](/api/code-editor/functions/resolveCodeEditorTheme) — generated
  resolution report.
