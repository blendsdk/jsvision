# Requirements — code-editor (Lezer code-grade editor)

A **code-development-grade editor** for jsvision TUI apps: syntax highlighting, tree-based folding,
and line numbers on top of the existing `@jsvision/ui` editor, powered by **Lezer** (`@lezer/*`).
Delivered across three packages behind a small seam so the zero-dep guarantee holds.

The engine and packaging were settled in a feasibility spike (`../plans/feasibility-spike/decision-memo.md`),
and the product design was fully disambiguated in a `grill_me` session
(`../shared-understanding.md`). Every semantically-weighted decision is captured in
`00-ambiguity-register.md`. Historical name: "RD-08 Editor family" / GH #18 (closed); build tracked
by GH #102.

## What this set delivers

A developer opens a file (or a `Memo`/`EditWindow`) and gets: **syntax-highlighted** JSON and
TypeScript/JavaScript, a **line-number gutter** with a fold column, **tree-based code folding**
(click the gutter marker or use the menu), **bracket matching**, and **comment-toggle** — with the
editor staying responsive on large files (incremental off-frame parsing; a soft cap that degrades
gracefully to the plain editor). Highlighting rides the core theme system, so it themes and
downsamples (truecolor → 256 → 16 → mono) like everything else.

## Scope

**In scope (v1)**
- `Tokenizer` / `FoldProvider` **seam types** + a syntax-bucket enum + ~11 new theme roles in `@jsvision/core` (zero-dep).
- A new opt-in **`@jsvision/lang`** package: the Lezer adapter, JSON + TS/JS grammars, Lezer-tag → bucket mapping, per-language fold allow-lists.
- **Editor view features** in `@jsvision/editor`: highlight render integration, gutter/line-numbers, folding UX (gutter-click + menu + Ctrl-K), bracket matching, comment-toggle, Tab/Shift+Tab indent/dedent, the large-file soft-cap/degrade path.
- Non-functional: perf NFR + the scoped validation probe, packaging/zero-dep, hostile-content security, testing + the kitchen-sink stories.

**Out of scope (each tracked by its own issue)**
- Multiple cursors (#104) · word-wrap (#105) · autocomplete/IntelliSense (#106) · diagnostics/linting/LSP (#107).
- v1 keeps the single-caret model and horizontal-scroll (1 buffer line = 1 screen row).

**Prerequisite (not an RD here)**
- Extract the editor into **`@jsvision/editor`** — GH #101, a standalone refactor that lands before this build.

## Glossary

| Term | Meaning |
|------|---------|
| **Lezer** | CodeMirror's incremental parser — a pure-JS syntax-tree engine (no DOM/WASM/native). The sole language engine here. |
| **`Tokenizer` seam** | The zero-dep interface (in `@jsvision/core`) that yields highlight spans `(from, to, bucket)` over a range; implemented by `@jsvision/lang` over Lezer. |
| **`FoldProvider` seam** | The zero-dep interface that yields foldable ranges; a Lezer-tree provider (`@jsvision/lang`) or the editor's indent-based default folder. |
| **Bucket** | One of ~8 semantic token categories (keyword, comment, string, number, type, function, variable, punctuation) the seam emits — resolved to a theme role at draw time. |
| **Syntax role** | A core theme role per bucket (`syntaxKeyword`, …); themed + capability-downsampled like any role. |
| **Fold allow-list** | The ~8 Lezer node names per language whose ranges are foldable. |
| **Soft cap** | A file-size/line threshold above which Lezer highlight + tree-fold are disabled (editor degrades to plain); the zero-dep features (line numbers, gutter, indent-fold) stay. |
| **Gutter** | The fixed left columns of the editor's own draw: line numbers + a fold-marker column. |

## RD index

| RD | Title | Priority | Depends on |
|----|-------|----------|------------|
| [RD-01](RD-01-core-seam-and-roles.md) | Core seam types & syntax theme roles (`@jsvision/core`) | Must | #101 (prereq) |
| [RD-02](RD-02-lang-engine.md) | `@jsvision/lang` — the Lezer engine (JSON + TS/JS) | Must | RD-01 |
| [RD-03](RD-03-editor-view-features.md) | Editor view features (`@jsvision/editor`) | Must | RD-01, RD-02, #101 |
| [RD-04](RD-04-non-functional.md) | Non-functional (perf, packaging, security, testing, gates) | Must | RD-01…03 |

**Suggested implementation order:** land **#101** (editor extraction) → RD-01 → RD-02 → RD-03 → RD-04.
The perf/integration probe (RD-04) runs **early**, right after RD-01/RD-02 stand up the seam, so its
number sets the soft-cap threshold before RD-03's degrade path is finalized.
