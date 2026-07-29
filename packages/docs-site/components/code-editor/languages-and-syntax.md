---
title: Code Editor languages and syntax
description: Select built-in plain, JavaScript, TypeScript, and PostgreSQL adapters; schedule syntax work; preserve line endings; and fall back safely for invalid source.
---

# Languages and syntax

Language adapters add local syntax, comments, brackets, folding, and editing metadata without
changing document ownership. JSVision ships plain text, JavaScript, TypeScript, and PostgreSQL
adapters; applications can select by explicit language ID or their own filename policy.

## Focused usage

```ts
import { LanguageRegistry } from '@jsvision/code-editor';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';

const languages = new LanguageRegistry([typescriptLanguageAdapter]);
const adapter = languages.resolve({ filename: 'main.ts' });
```

## Built-in language gallery

Use explicit IDs when the host already knows the language. Filename detection belongs in the host
or registry selection path; keep the chosen ID visible so users understand which adapter is active.

<PlayExample id="code-editor/language-gallery"
  title="Language adapter gallery"
  blurb="Cycle a bounded document through plain text, JavaScript, TypeScript, and PostgreSQL while the active language remains visible."
/>

## Syntax fallback

Incomplete and temporarily invalid source is normal during editing. Preserve the text and fall back
to safe plain projection when an adapter cannot produce a usable result; never discard the user's
document merely because syntax analysis failed.

<PlayExample id="code-editor/syntax-fallback"
  title="Graceful syntax fallback"
  blurb="Run incomplete TypeScript through a deliberately failing scheduled adapter and observe its real degraded result before a non-destructive plain fallback."
/>

## Invisibles, line endings, and i18n

Line endings are document metadata, not translated presentation. Invisible-character inspection
must describe control text safely, while UI labels come from the injected `I18n` catalog. Import an
explicit Code Editor locale and let the application catalog override editor messages last.

```ts
import { codeEditorNl } from '@jsvision/code-editor/locales/nl';
import { createI18n } from '@jsvision/i18n';

const i18n = createI18n({ locale: 'nl', catalogs: [codeEditorNl] });
```

<PlayExample id="code-editor/invisibles-line-endings"
  title="Invisible text and line endings"
  blurb="Inspect LF, CRLF, tabs, and hostile control text through terminal-safe presentation without changing the source model."
/>

## Limits and practices

- Keep parser work revision-aware; discard stale results rather than applying them to newer text.
- Bound scheduled analysis and preserve a plain fallback for missing or failed adapters.
- Never translate source, filenames, language IDs, command tokens, or protocol payloads.
- Sanitize only presentation; the model must retain the exact source bytes it owns.

## Related

- [Folding](/components/code-editor/folding) — consume language and structural ranges.
- [Language intelligence](/components/code-editor/language-intelligence) — add protocol-backed
  services beyond local syntax.
- [`LanguageRegistry` API](/api/code-editor/classes/LanguageRegistry) — generated registry surface.
