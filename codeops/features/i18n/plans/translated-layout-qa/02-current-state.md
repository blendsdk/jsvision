# Current state: translated layout and multilingual QA

> **Baseline**: `f956b22497fee2392dd5d0f23b4895f8031b5dee`
> **Analysis date**: 2026-07-26
> **CodeOps Artifact Schema**: 1

## Existing strengths

| Surface | Existing capability |
|---|---|
| Button | `Button.measure()` parses accelerator markup and uses renderer `stringWidth`, returning face padding and shadow width. |
| Datagrid | `buttonCellWidth`, `buttonRowMinWidth`, and `buttonRow` already implement widest-face equal sizing. |
| Switch | Localized On/Off captions already use `stringWidth`. |
| Code Editor | #184 added five-package locale tooling, explicit service injection, and cell-clipped localized search/status/assistance. |
| Examples | `i18n-layout.spec.test.ts` uses real Applications, dialogs, focus traversal, and all ten locale IDs at 80×24. |
| Lifecycle | `Application.i18n` is readonly and `EventLoop.dispose()` stops and unmounts the active tree. |

## Defect inventory

| Package/surface | Current defect | Evidence |
|---|---|---|
| UI dialogs | Internal 10-cell/2-gap `buttonBand` is not public; dialog body/label widths use JS `.length` and fixed maximums. | `packages/ui/src/dialog/message-box.ts:57-86,132-145,173-186,217-222` |
| UI editor dialogs | Reuse the internal dialog band, preventing consumers and sibling packages from sharing its policy. | `packages/ui/src/editor/` |
| Forms | Duplicates the 10-cell/2-gap policy and places a fixed pair inside caller dimensions. | `packages/forms/src/form-dialog.ts:54-60,224-238` |
| Files | File and change-directory dialogs independently measure vertical actions and retain fixed dialog widths; error dialog body sizing remains code-unit based. | `packages/files/src/dialog/file-dialog.ts`, `chdir-dialog.ts`, `error-dialog.ts` |
| Calendar | Today position/hit width and month header centering/truncation use `.length`, `slice`, and `padStart`; base content width ignores the widest localized month. | `packages/ui/src/date/calendar-metrics.ts:139-147,212-230` |
| DatePicker | Pre-mount sizing can use English/default metrics while its mounted Calendar resolves localized Today. | `packages/ui/src/date/date-picker.ts:123-136` |
| Datagrid Personalize | Existing 3/2 wrapping measures widths independently per row; translated headers use fixed cells. | `packages/datagrid/src/personalize-dialog.ts:403-428` |
| Datagrid filter | Actions share widths, but the anchored popup is mounted at a fixed 34 cells and translated operators/captions do not participate in desired width. | `packages/datagrid/src/grid.ts`, `filter-popup.ts` |
| Examples | Existing layout oracle loads four packages, covers representative dialogs only, and has no reconstruction/registry/narrow/override/Unicode matrix. | `packages/examples/test/i18n-layout.spec.test.ts:26-39,97-181` |
| Example command | `@jsvision/examples` exposes kitchen and package demos but no `demo:i18n`. | `packages/examples/package.json` |
| Docs | The localized theme-designer example hard-codes OK/Cancel widths that fail longer translations. | `packages/docs-site/examples/i18n-theme-designer.ts` |
| Canonical skill | Layout and Forms/theme recipes teach fixed translated button geometry. | `tools/jsvision-skill/references/layout.md`, `references/recipes/forms-dialogs.md`, `references/recipes/theme-designer.md` |

## Dependency and compatibility constraints

```text
@jsvision/ui
    ↑ consumes public primitives
@jsvision/forms   @jsvision/files   @jsvision/datagrid
    ↑
@jsvision/examples + docs + canonical skill
```

- The shared helper must live in UI and depend only on UI primitives; UI must not import Datagrid.
- Datagrid's current helpers are package-internal implementation exports but have direct tests and
  call sites; delegates minimize migration risk.
- A `Button` belongs to one composed view tree. Any composer that applies fixed layout metadata must
  document single-parent/single-composition ownership.
- The general layout engine intentionally has no automatic wrapping. Component builders know their
  viewport, content priorities, and acceptable reflow; they retain that responsibility.
- Anchored popups need desired dimensions before placement and must re-clamp if reactive size
  changes.
- The unrelated pre-existing `yarn.lock` worktree modification is outside this plan and must remain
  unstaged.

## Design lenses

| Lens | Finding |
|---|---|
| Component/SDK | Public geometry must be small, additive, documented, and reusable without importing package internals. |
| Compatibility/migration | Preserve Datagrid helper behavior and caller-owned absolute bounds; keep English output stable where possible. |
| State/lifecycle | Fresh locale behavior is an application ownership invariant, not a reactive locale toggle. |
| Unicode | Cell width, clipping, centering, padding, and hit zones must all share renderer rules. |
| Security | Translated/caller strings remain validated/sanitized and bounded; geometry does not authorize terminal controls. |
| Performance | Linear measurement over small action/label arrays is negligible and may be computed before mount. |
| Documentation | Examples are executable SDK guidance and must migrate with the public API. |
