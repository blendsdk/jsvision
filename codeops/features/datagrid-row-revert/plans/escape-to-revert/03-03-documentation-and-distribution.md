# Documentation and Distribution: Data Grid Escape-to-Revert

> **Document**: 03-03-documentation-and-distribution.md
> **Parent**: [Index](00-index.md)

## Overview

This component makes the new recovery contract discoverable and keeps every supported SDK surface
synchronized. It updates the Data Grid showcase, the existing docs-site validation laboratory and
teaching page, public JSDoc/generated API, package guidance, official locales, the canonical
agent-neutral JSVision skill, and the assembled Codex plugin (AR-11, AR-12, AR-13, AR-14).

## Architecture

### Current Architecture

The standalone showcase's row-gate story explains that a value is saved and the cursor remains
trapped until the cross-field rule passes. The docs-site validation lab uses the shared Data Grid
Template1 application but exercises only cell validation, `validateRow`, and `beforeSave`. Generated
API/skill content describes no row rollback callback or action.

### Proposed Changes

Extend the existing examples rather than create duplicate registry IDs. Both surfaces must drive the
real `EditableDataGrid` API and display observable status for successful and failed row rollback.
Documentation must distinguish editor cancellation, trapped-session rollback, successful leave, and
unavailable persistence. Generated content remains owned by repository scripts (AR-1, AR-3, AR-8,
AR-13).

## Implementation Details

### Public API and Package Documentation

- Add JSDoc with `@example` to `RowRevertCell`, `RowRevert<T>`, `OnRevertRow<T>`, the
  `EditableDataGridOptions.onRevertRow` property, and the `GridAction` documentation (AR-14).
- Update `packages/datagrid/src/index.ts` exports and commentary; generated API pages must expose the
  exact approved names and timing (AR-14).
- Update `packages/datagrid/README.md` and `CHANGELOG.md` with the scoped behavior, atomic persistence
  requirement, editor Escape priority, and unavailable state. Do not describe it as general undo
  (AR-1, AR-4, AR-8).

### Standalone Data Grid Showcase

Update `validation-lifecycle/row-gate.story.ts` so a deterministic fixture demonstrates:

1. commit a valid cell value that makes the row combination invalid;
2. attempt a leave and observe the localized trapped hint;
3. press Escape and observe the restored values, cleared message, retained row focus, and successful
   next navigation;
4. select a controlled failure mode where `onRevertRow` vetoes and observe retryable feedback;
5. keep keyboard instructions and action feedback visible without clipping at the showcase viewport.

Update showcase smoke/walkthrough coverage rather than testing copy alone. The host callback uses an
in-memory transaction fixture and never network/filesystem access (AR-5, AR-11, AR-13).

### Docs-Site Validation Laboratory

Keep the existing `data-grid/validation` registry ID and shared `buildDataGridLab` Template1 shell.
The complete Data Grid family is approved to start maximized; restore/maximize behavior and Classic
surface must remain covered. Extend the validation scenario, probe controller, and contract with a
focused trap/revert case and a rollback-failure case (AR-13).

Update the `<PlayExample>` title/blurb on
`components/data-grid/validation-and-lifecycle.md` to tell readers to create a cross-field trap and
press Escape. Teach:

- why commit-then-trap is necessary;
- the difference between editor Escape and body Escape;
- session lifetime and corrected-before-leave behavior;
- `onRevertRow` atomic persistence, frozen payload timing, and the unavailable state;
- cleanup/race behavior and UX-only validation security boundary;
- exact related API links without duplicating generated signatures.

Focused docs specifications must render the real lab and verify behavior, Classic surface,
maximized/restore layout, unclipped feedback, keyboard reachability, and non-color status cues.

### Locales, Canonical Skill, and Plugin

- Add reviewed translations for the four AR-13 keys to every official Data Grid catalog and update
  placeholder validation for `${message}`.
- After translation text is final, perform the repository's approved translation review, refresh
  every affected Data Grid digest in `tools/i18n-translation-reviews.json`, and run
  `yarn i18n:reviews:check`. Locale completeness alone is not review evidence.
- Review every canonical reference reported from the paths in `tools/jsvision-plugin-impact.json`,
  including Data Grid, data-driven recipe, i18n, and generated API references where reported.
- Edit only `tools/jsvision-skill/`; never directly edit
  `plugins/jsvision-plugin/skills/jsvision/`.
- Run `yarn plugin:update` after source/docs changes so it owns generated API pages, recipe snippets,
  impact snapshots, and the assembled plugin copy; finish with `yarn plugin:check` (AR-12, AR-13,
  AR-14).

## Integration Points

- `packages/examples/datagrid-showcase` supplies the living SDK acceptance story.
- `packages/docs-site/src/example-fixtures/data-grid` supplies real Template1 lab configuration and
  probes shared by example contracts.
- `packages/docs-site/test/contracts/data-grid` and focused layout/interaction tests own observable
  docs behavior.
- `packages/datagrid/src/i18n`, locale entry points, and
  `tools/i18n-translation-reviews.json` maintain catalog completeness and review provenance.
- `tools/jsvision-plugin-impact.json`, `tools/jsvision-skill`, and `yarn plugin:update` maintain the
  supported plugin surface.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Example persistence vetoes | Show bounded failure and preserve retryable trap | AR-10, AR-13 |
| User presses Escape before trap | Preserve prior no-op/bubble behavior; instructions explain eligibility | AR-3, AR-12 |
| Translated template becomes long | Responsive Template1 layout and clipping assertions at 80×24/restore/maximize | AR-13 |
| Locale misses key/placeholder | Catalog/type/locale checks fail before completion | AR-13 |
| Locale review digest is missing or stale | `i18n:reviews:check` fails before the locale task closes | AR-13 |
| Generated API or skill copy drifts | Regenerate through `plugin:update`; `plugin:check` must pass | AR-12, AR-14 |
| Host error/row value contains unsafe text | Do not echo it; draw only sanitized package-owned messages | AR-11 |

## Testing Requirements

- Add showcase smoke/walkthrough assertions for trap, success, failure, and subsequent navigation.
- Extend the docs Data Grid contract with real keyboard actions and probes for restored values,
  rollback state, and failure feedback.
- Extend Template1/layout specs for Classic surface and maximized/restore unclipped behavior.
- Check public snippets/type imports, locale completeness/placeholders, digest-bound translation
  review evidence, generated API, canonical skill references, and plugin drift.
- Complete a manual 80×24 terminal pass and record the observed workflow in execution evidence.
