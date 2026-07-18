# RD-02: `@jsvision/lang` — the Lezer engine (JSON + TS/JS)

- **Priority:** Must
- **Depends on:** RD-01 (the seam types + `SyntaxBucket`)
- **Status:** Drafted

## Summary

A **new, opt-in package `@jsvision/lang`** that implements RD-01's seam over **Lezer**: an incremental
parse tree feeding highlight spans and fold ranges. It ships two `LanguageProvider`s for v1 — **JSON**
(`@lezer/json`) and **TypeScript/JavaScript** (`@lezer/javascript`, which covers JS/TS/JSX/TSX). It
depends only on `@jsvision/core` (for the seam types) and `@lezer/*` — **never** on `ui` or `editor` —
so `core`/`ui` keep their zero-dep guarantee while this heavy optional dependency stays quarantined
here (mirroring `@jsvision/forms` → `zod`).

## Functional requirements

### FR-2.1 — Package shape *(AR-00b, AR-02)*
`@jsvision/lang`: ESM-only, NodeNext `.js` specifiers, single barrel `src/index.ts`. Runtime deps =
`@lezer/common`, `@lezer/highlight`, plus the grammar packages `@lezer/json`, `@lezer/javascript`
(all pure-JS, no native — `check:deps` scope note: this package *may* carry these regular deps; `core`
and `ui` remain `{}`). No dependency on `@jsvision/ui` or `@jsvision/editor`.

### FR-2.2 — Lezer `Input` adapter over `DocReader` *(AR-04, AR-20)*
An adapter presenting RD-01's `DocReader` to Lezer's incremental `Input` interface, reading in
**bounded chunks** (never materializing the whole document). This is the buffer→parser bridge whose
feasibility + timing the RD-04 probe validates first.

### FR-2.3 — Incremental, time-budgeted parse *(AR-04, AR-07)*
- The parse advances in **time-budgeted slices** and can be stopped/resumed, so a single parse step
  never blocks a frame; on `Tokenizer.edit(change)` the parser reuses unaffected fragments and
  reparses only the touched region.
- `Tokenizer.pending(from, to)` returns `true` while the background parse still owes that range;
  `highlight()` emits what is known so far (viewport regions ahead of the parse front render
  default-fg and fill in as the parse completes) — the progressive-fill contract of AR-04.

### FR-2.4 — `Tokenizer.highlight` via Lezer highlighting *(AR-03)*
`highlight(from, to, emit)` walks the parsed tree over `[from, to)` using `@lezer/highlight` and emits
`(from, to, bucket)` spans — resolving each node's Lezer tag(s) to a `SyntaxBucket` through the
mapping table (FR-2.5). No colours are produced here (the editor resolves bucket → role → colour).

### FR-2.5 — Lezer tag → `SyntaxBucket` mapping *(AR-03)*
A pure, data-only table collapsing Lezer's ~40 `@lezer/highlight` `tags` into the 8 buckets — e.g.
`keyword/controlKeyword/operatorKeyword → keyword`; `lineComment/blockComment → comment`;
`string/special(string)/regexp/escape → string`; `number/integer/float/bool/null → number`;
`typeName/className/namespace → type`; `function(variableName)/methodName → function`;
`propertyName/variableName/attributeName → variable`; `punctuation/bracket/separator → punctuation`.
Anything unmapped falls back to `variable` (default fg). The exact table is pinned at plan time; it is
additive-friendly (a new bucket just re-points some tags).

### FR-2.6 — `FoldProvider` via per-language allow-lists *(AR-06, AR-02)*
`foldableAt`/`foldsIn` derive foldable ranges from the tree using a **per-language allow-list of
~8 fold node names** (e.g. JSON: `Object`, `Array`; TS/JS: `Block`, `ObjectExpression`,
`ArrayExpression`, `ClassBody`, `SwitchBody`, `TemplateString`, `BlockComment`, JSX element bodies).
Where a grammar exposes `@lezer/common` `foldNodeProp`, use it; otherwise the allow-list drives the
range (header line end → node end). Lists are authored per language and pinned at plan time.

### FR-2.7 — JSON `LanguageProvider` *(AR-02)*
`jsonLanguage: LanguageProvider` over `@lezer/json` — the minimal proof + spec-oracle vehicle
(tiny tag set: property/string/number/bool/null/punctuation; fold nodes Object/Array). **Note:**
standard JSON has no comment syntax → comment-toggle is a no-op for JSON (AR-11).

### FR-2.8 — TS/JS `LanguageProvider` *(AR-02)*
`javascriptLanguage: LanguageProvider` over `@lezer/javascript` (dialect covers JS/TS/JSX/TSX) — the
flagship. Full tag set → 8 buckets; the fold allow-list above; line-comment token `//` and block
`/* */` for comment-toggle (RD-03).

### FR-2.9 — Comment metadata *(AR-11)*
Each `LanguageProvider` exposes its comment syntax (line prefix + optional block delimiters) so RD-03's
comment-toggle can operate language-generically; a provider with no comment syntax (JSON) reports none
and comment-toggle is disabled for it.

## Acceptance criteria

- [ ] `@jsvision/lang` builds, is ESM-only, and its only runtime deps are `@lezer/*` (+ `@jsvision/core` as a normal dep); it imports nothing from `ui`/`editor`. `@jsvision/core` and `@jsvision/ui` stay `{}`-dep.
- [ ] Feeding a `DocReader` over a sample document, `jsonLanguage.create(doc).tokenizer.highlight(0, len, emit)` emits correct `(from,to,bucket)` spans for keys, strings, numbers, `true/false/null`, and punctuation (spec oracle).
- [ ] `javascriptLanguage` highlights a TS sample: `keyword`, `type`, `function`, `string`, `comment`, `number`, `punctuation` buckets land on the right ranges (spec oracle).
- [ ] After `edit()` on a one-character insert, only the affected region reparses (fragment reuse observable); `pending()` reports the un-parsed tail on a large document and clears as the parse completes.
- [ ] `foldsIn`/`foldableAt` return the allow-listed ranges for JSON (`Object`/`Array`) and TS/JS (`Block`/`ObjectExpression`/… ) on sample docs (spec oracle).
- [ ] The tag→bucket table maps every `@lezer/highlight` tag the two grammars can emit (no span silently dropped; unmapped → `variable`).
- [ ] Public symbols carry JSDoc + `@example`; `check:docs` passes.

## Out of scope
The editor's consumption of the seam — draw integration, gutter, folding UX, the soft-cap/degrade
path (RD-03). Additional languages beyond JSON + TS/JS (additive later — each is ~an allow-list + the
provider). Semantic (type-aware) analysis, completion, diagnostics (#106/#107).

## Traceability
AR-00b, AR-02, AR-03, AR-04, AR-06, AR-07, AR-11, AR-20.
