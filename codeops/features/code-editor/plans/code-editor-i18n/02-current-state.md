# Current state: Code Editor internationalization

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing implementation

### What exists

- The i18n package provides synchronous browser-safe services, structured plural/select messages,
  formatting, strict catalog validation, isolated English fallbacks, explicit locale subpaths,
  digest-bound review tooling, and safe diagnostics.
- UI, Forms, Files, and Datagrid already implement direct package dependencies, optional service
  injection, canonical English catalogs, ten locale modules, explicit locale exports, and
  application override precedence.
- Code Editor has a browser-safe main entry and separate Node entry, a locale-neutral controller,
  keyboard-operable search/replace state, bounded LSP presentation, degradation inspection, and
  invisible-character detection.
- `stringWidth` is publicly exported by `@jsvision/ui` and matches terminal rendering width policy.

### Relevant files

| File | Current purpose | Change needed |
|---|---|---|
| `packages/code-editor/package.json` | Package exports and dependencies | Direct i18n dependency and generated locale subpaths |
| `packages/code-editor/src/ui/code-editor.ts` | Focusable editor, search routing, assistance | Service ownership, search presentation, localized overlay projection |
| `packages/code-editor/src/ui/code-editor-window.ts` | Window title, scrollbars, status | Exact service forwarding and localized chrome |
| `packages/code-editor/src/ui/search-session.ts` | Locale-neutral find/replace state | Preserve semantics; expose state to presentation |
| `packages/code-editor/src/ui/assistance.ts` | Bounded popup rows | Display-cell measurement and clipping |
| `packages/code-editor/src/controller-overlay.ts` | Controller overlay projection | Add structured diagnostic metadata compatibly |
| `packages/code-editor/src/degradation.ts` | Semantic degradation and legacy message | Preserve state; add projector seam outside state owner |
| `packages/code-editor/src/languages/invisibles.ts` | Detect sensitive code points and legacy label | Preserve detection; add projector seam |
| `scripts/update-i18n-locales.mjs` | Generates four packages × ten locale entries | Derive counts/packages from configuration |
| `scripts/check-i18n-reviews.mjs` | Loads 36 non-English package catalogs | Recognize configured packages and derived totals |
| `scripts/check-i18n-literals.mjs` | Audits four localized source roots | Include Code Editor and its label/projector patterns |
| `packages/i18n/test/locales.spec.test.ts` | Public locale parity and isolation | Add Code Editor and permit an empty accelerator topology |
| `tools/jsvision-plugin-impact.json` | Maps SDK changes to canonical references | Make Code Editor overlap the i18n reference set |

## Gaps identified

### Gap 1: no Code Editor catalog or service injection

`@jsvision/code-editor` depends on Core and UI but not i18n. Its two primary construction option
types have no translation service and therefore cannot participate in application catalog
precedence.

### Gap 2: English presentation is flattened below or inside views

The window constructs `Code Editor`, `Ln`, and `Col` directly. Diagnostic overlays concatenate the
severity with external detail before the view sees it. Degradation and invisible-character records
contain stable discriminants but also mint English fields. AR-3 keeps those legacy fields while
adding structured metadata and pure projectors for localized visible paths.

### Gap 3: search behavior lacks visible presentation

The session exposes `open`, `replace`, active field, bounded query/replacement, case state, and
current/total matches, and keyboard input routes to that state. The editor draw path renders only
document cells; no field labels, counts, options, or hints are visible. AR-2 requires one bounded
inline presentation without changing the state machine.

### Gap 4: display width diverges from terminal width

Assistance truncates and measures with UTF-16 slicing and `string.length`. Wide glyphs and combining
marks can therefore produce an incorrect popup width. Diagnostic prefix composition and new search
chrome must budget terminal cells rather than code units.

### Gap 5: shared tooling hard-codes the original package set

Locale generation validates exactly four packages and reports forty entry points. Review loading,
literal auditing, locale tests, docs entry-point tests, examples, and canonical recipes repeat the
same four-package list. Adding Code Editor through only its manifest would leave validation,
release review, docs, or plugin output inconsistent.

### Gap 6: final cross-package QA seam does not exist

Issue #185 owns the shared sizing API and `demo:i18n` harness. Implementing a competing harness
would create duplicate lifecycle and registry contracts. This plan instead makes Code Editor states
and catalogs independently constructible for #185.

## Dependencies

### Internal

- `@jsvision/i18n` public browser API and catalog validators.
- `@jsvision/ui` view, `Text`, `Window`, draw context, and `stringWidth`.
- Existing Code Editor controller/search/LSP safety limits.
- Shared locale generator, review manifest, docs generator, and plugin synchronization.

### External

- Proficient speakers for digest approval after catalog content stabilizes.
- Issue #185 for final story registration and cross-package viewport certification.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Locale-aware state leaks into reusable controllers | Medium | High | AR-3 structured view-boundary projectors |
| Public English fields break | Low | High | Preserve them and add metadata/helpers additively |
| External LSP/source content is translated or interpolated unsafely | Low | High | Compose normalized detail outside translation templates |
| Search presentation changes matching or undo behavior | Medium | High | Reuse existing state/commands and immutable regression specifications |
| Tooling remains four-package-specific | High | High | Configuration-derived package lists/counts and cross-package tests |
| Long translations still clip in other components | Certain | Medium | Explicitly defer comprehensive certification to #185, not silently |
| Catalog approvals are falsely represented | Low | High | AR-12 external attestation gate |
