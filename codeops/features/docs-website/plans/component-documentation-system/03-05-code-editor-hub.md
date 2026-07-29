# Specification: Code Editor Documentation Hub

> **Requirements**: PR-6, PR-8
> **Decisions**: AR-6, AR-8, AR-9, AR-13, AR-14, AR-15, AR-17, AR-18, AR-19

## Objective

Replace the broad `/guide/code-editor` page with a task-oriented component hub for `CodeEditor` and
`CodeEditorWindow`. Supporting model/controller/language/LSP/lifecycle/theme APIs are taught where
developers need them and linked to TypeDoc rather than split into artificial component pages.

## Information Architecture

| Order | Route under `/components/code-editor/` | Sidebar label | Profile | Required examples |
|---:|---|---|---|---|
| 1 | `index.md` | Overview | `landing` | `code-editor/quick-start` |
| 2 | `documents-and-lifecycle.md` | Documents & lifecycle | `capability` | `code-editor/document-controller`, `code-editor/external-changes` |
| 3 | `editing-navigation-clipboard.md` | Editing, navigation & clipboard | `capability` | `code-editor/editing-navigation`, `code-editor/readonly-clipboard` |
| 4 | `languages-and-syntax.md` | Languages & syntax | `capability` | `code-editor/language-gallery`, `code-editor/syntax-fallback`, `code-editor/invisibles-line-endings` |
| 5 | `folding.md` | Folding | `capability` | `code-editor/language-folding`, `code-editor/structural-folding` |
| 6 | `search-and-replace.md` | Search & replace | `capability` | `code-editor/search`, `code-editor/replace` |
| 7 | `language-intelligence.md` | Language intelligence & LSP | `capability` | `code-editor/lsp-completion`, `code-editor/lsp-diagnostics`, `code-editor/lsp-navigation` |
| 8 | `viewport-and-large-documents.md` | Viewport & large documents | `capability` | `code-editor/viewport-mouse`, `code-editor/large-document-tiers` |
| 9 | `themes-and-fallbacks.md` | Themes & fallbacks | `capability` | `code-editor/themes`, `code-editor/theme-fallback` |
| 10 | `host-safety-and-recovery.md` | Host safety & recovery | `capability` | `code-editor/safe-terminal-text`, `code-editor/host-recovery` |
| 11 | `api.md` | API map | `api` | none |

## Example Design

| Example | Learning objective |
|---|---|
| `quick-start` | Compare direct `CodeEditor` composition with `CodeEditorWindow`. |
| `document-controller` | Show model/controller ownership, revision, selection, and mutation flow. |
| `external-changes` | Exercise external-change decisions and save-formatting outcomes. |
| `editing-navigation` | Demonstrate modern editing, selection, mouse, and keyboard navigation. |
| `readonly-clipboard` | Contrast read-only routing with safe copy behavior. |
| `language-gallery` | Switch plain, JavaScript, TypeScript, and PostgreSQL adapters. |
| `syntax-fallback` | Show capability inventory, syntax projection, invalid source, and graceful fallback. |
| `invisibles-line-endings` | Make invisible-character and line-ending behavior observable. |
| `language-folding` | Teach language-provided folds and collapsed-header navigation. |
| `structural-folding` | Teach structure-derived folds independently of one language. |
| `search` | Show query navigation and search presentation. |
| `replace` | Show replacement flow and observable document revisions. |
| `lsp-completion` | Exercise completion/signature/hover through bounded in-process services. |
| `lsp-diagnostics` | Show diagnostic projection and safe overlays. |
| `lsp-navigation` | Show symbols/navigation/formatting and service-state availability. |
| `viewport-mouse` | Demonstrate resizing, viewport projection, mouse selection, and line numbers. |
| `large-document-tiers` | Compare full/large/confirmation tiers and degradation notices. |
| `themes` | Compare Classic-compatible, dark, and light editor themes. |
| `theme-fallback` | Make theme resolution/fallback reports visible. |
| `safe-terminal-text` | Show sanitization of language/LSP text before terminal presentation. |
| `host-recovery` | Show host-effect authorization, service failure, suspension, and recovery. |

Every example uses `template1`, bounded deterministic documents, and no external network service.

The objective table is a capability summary. Before implementation,
`test/contracts/code-editor/` supplies one typed behavior contract per example with its exact
initial document/service state and one or more independently resettable cases containing bounded
key/mouse sequences and executable editor/service/status probes. Capability-to-case parity ensures
every objective in the table is proven. Code Editor objective specs are sharded into
topology/profile, interaction, and safety/service-state files; implementation tests are sharded by
document/session lifecycle, language/LSP, and host/recovery boundaries.

## Safety Contract

- LSP demos use `InProcessLspSession` or a bounded deterministic session seam.
- Protocol text is validated/sanitized before terminal presentation.
- Host effects are displayed and explicitly authorized in the example; an example never writes files,
  launches processes, or connects to a network service.
- Large-document examples use synthetic bounded data and expose classification/degradation state rather
  than allocating pathological documents.
- Observability output excludes source text and other potentially sensitive content.

## Public Symbol Placement

| Symbol | Target |
|---|---|
| `CodeEditor` | Overview and interaction topics |
| `CodeEditorWindow` | Overview |

Controllers, document models, language schedulers, LSP coordinators/sessions, degradation,
observability, projection, and theme resolvers are supporting API concepts. They appear in the API
map page and in focused topic snippets.

## Source Reuse Boundary

- Adapt representative behavior from the catalog's 20 ordinary and 11 QA scenarios. The 21 docs
  examples are selected by capability coverage, not source-count equality.
- Do not import the Code Editor demo scenario registry into docs runtime.
- Shared builders live under `src/example-fixtures/code-editor/`, outside the recursively scanned
  runnable example directory.
- Use only public `@jsvision/code-editor` entry-point imports in teaching snippets/examples unless an
  explicitly exported Node-only entry point is the lesson.
- Keep docs fixture text small enough for source embeds and review.

## Removal and Link Migration

- Delete `packages/docs-site/guide/code-editor.md`.
- Move its i18n teaching obligation to the canonical Languages & syntax page. Update
  `test/i18n-docs.spec.test.ts` to resolve that non-empty target through the component catalog
  instead of hard-coding either guide path; migrate the page, test, links, and deletion atomically.
- Replace its guide/sidebar/internal references with `/components/code-editor/`.
- Add Code Editor to the global Components sidebar as a hub landing link; browsing inside it switches
  to the specialist sidebar.
- Extend API-map package support to `code-editor`.
- A stale-route spec must fail before removal and pass after link migration.

## Verification

- Specification: ST-26 through ST-28, ST-31, ST-32.
- Hub specs verify scenario objectives, safety seams, service-state transitions, large-document
  boundaries, theme fallback, and lazy loading.
- Implementation tests cover deterministic sessions, reset/disposal, failure paths, and fixture
  boundaries after the specs are green.
- Final: `yarn verify`.
