# Specification: Standard Component Migration

> **Requirements**: PR-2, PR-3, PR-4
> **Decisions**: AR-2, AR-3, AR-4, AR-5, AR-12, AR-13, AR-19

## Objective

Deliver the standard catalog in reviewable family waves. Each primary page receives accurate,
source-backed prose, one flagship example, focused snippets, navigation, related links, API links,
and component-specific tests.

## Route and Example Matrix

### Reference and Controls

| Component | Route | Primary example | Work |
|---|---|---|---|
| Button | `/components/controls/button` | `controls/button` | Catalog/contract audit only |
| Input | `/components/controls/input` | `controls/input` | Catalog/contract audit only |
| Text | `/components/controls/text` | `controls/text` | Catalog/contract audit only |
| Label | `/components/controls/label` | `controls/label` | Upgrade page + new example |
| Check Group | `/components/controls/check-group` | `controls/check-group` | Upgrade page + new example |
| Radio Group | `/components/controls/radio-group` | `controls/radio-group` | Upgrade page + new example |
| Multi-check Group | `/components/controls/multi-check-group` | `controls/multi-check-group` | New page + example |
| Slider | `/components/controls/slider` | `controls/slider` | Upgrade page + new example |
| Switch | `/components/controls/switch` | `controls/switch` | Upgrade page + new example |

Form Dialog is handled with the Forms/Files wave because it belongs to `@jsvision/forms`.

### Foundations and Application Shell

| Component | Route | Primary example |
|---|---|---|
| View | `/components/foundations/view` | `foundations/view` |
| Group | `/components/foundations/group` | `foundations/group` |
| Application | `/components/application/application` | `application/application` |
| Desktop | `/components/application/desktop` | `application/desktop` |
| Router | `/components/application/router` | `application/router` |
| Window | `/components/application/window` | `application/window` |
| Menu Bar | `/components/application/menu-bar` | `application/menu-bar` |
| Status Line | `/components/application/status-line` | `application/status-line` |

These examples still use `template1`; for shell components the centered lab dialog teaches the target
inside a stable full shell, while the page explains the component's real top-level role.

### Containers and Navigation

| Component | Route | Primary example | Work |
|---|---|---|---|
| Dialog | `/components/containers/dialog` | `containers/dialog` | Upgrade + new example |
| List View | `/components/containers/list-view` | `containers/list-view` | New |
| List Box | `/components/containers/list-box` | `containers/list-box` | Upgrade + rebuild example |
| Scroller | `/components/containers/scroller` | `containers/scroller` | Upgrade + new |
| Scroll Bar | `/components/containers/scroll-bar` | `containers/scroll-bar` | Upgrade + new |
| Tree | `/components/containers/tree` | `containers/tree` | Upgrade + new |
| Tabs | `/components/containers/tabs` | `containers/tabs` | Upgrade + new |
| Split View | `/components/containers/split-view` | `containers/split-view` | New |
| Combo Box | `/components/dropdown/combo-box` | `dropdown/combo-box` | Upgrade + new |
| History | `/components/dropdown/history` | `dropdown/history` | Upgrade + new |

### Feedback, Date, and Color

| Component | Route | Primary example |
|---|---|---|
| Progress Bar | `/components/feedback/progress-bar` | `feedback/progress-bar` |
| Spinner | `/components/feedback/spinner` | `feedback/spinner` |
| Calendar | `/components/date/calendar` | `date/calendar` |
| Date Picker | `/components/date/date-picker` | `date/date-picker` |
| Color Swatch | `/components/color/color-swatch` | `color/color-swatch` |
| Color Picker | `/components/color/color-picker` | `color/color-picker` |

All six pages are upgraded and all six examples are new.

### Surface, Editing, and Output

| Component | Route | Primary example |
|---|---|---|
| Surface | `/components/surface/surface` | `surface/surface` |
| Surface View | `/components/surface/surface-view` | `surface/surface-view` |
| Editor | `/components/editor/editor` | `editor/editor` |
| Memo | `/components/editor/memo` | `editor/memo` |
| Edit Window | `/components/editor/edit-window` | `editor/edit-window` |
| Indicator | `/components/editor/indicator` | `editor/indicator` |
| Terminal | `/components/terminal/terminal` | `terminal/terminal` |

Surface and Indicator are new pages; the other five are upgraded. These are distinct from the
specialized `@jsvision/code-editor` hub.

### Forms and Files

| Component | Route | Primary example | Work |
|---|---|---|---|
| Form Dialog | `/components/controls/form-dialog` | `controls/form-dialog` | Upgrade + rebuild example |
| File Dialog | `/components/files/file-dialog` | `files/file-dialog` | Upgrade + rebuild example |
| Change Directory Dialog | `/components/files/chdir-dialog` | `files/chdir-dialog` | New |
| File List | `/components/files/file-list` | `files/file-list` | New |
| Directory List | `/components/files/dir-list` | `files/dir-list` | New |
| File Input | `/components/files/file-input` | `files/file-input` | New |
| File Info Pane | `/components/files/file-info-pane` | `files/file-info-pane` | New |
| File Editor | `/components/files/file-editor` | `files/file-editor` | New |

All file examples use a deterministic virtual `FileSystem`.

## Page Research Checklist

For each component, inspect before authoring:

1. public barrel exports;
2. constructor/options/public state;
3. implementation defaults and measurement/layout;
4. key/mouse handling and commands;
5. theme roles;
6. existing specification/implementation tests;
7. related helpers and natural composition partners;
8. generated API path.

The resulting page records the source-backed behavior, not the research file paths.

## Example Quality Checklist

- a typed behavior contract is checked in before implementation and provides independently
  resettable cases with capability tags, executable initial/expected probes, and bounded structured
  action sequences;
- meaningful visual states shown together;
- at least one real interaction with visible feedback;
- useful hotkeys and instructions;
- correct focus order;
- no clipping at 80×24;
- deterministic state reset between runs;
- focused component spec verifies stated objective;
- shared `template1` spec verifies shell/dialog geometry and presentation.

## Migration Mechanics

- Add example descriptors to family registry modules under `src/example-registry/`, preserving one
  dynamic import per runnable module; `examples/index.ts` remains the aggregate public export.
- Keep shared fixtures/builders under `src/example-fixtures/` or `test/fixtures/`, outside the
  recursively scanned `examples/` tree.
- Remove `kind: 'component'` from migrated component examples; standard examples are `kind: 'app'`.
- Replace each `PlayComingSoon` with `PlayExample` only after its example exists and smoke-paints.
- Update page title/blurb and source embed together.
- Keep theming demo pages outside component catalog enforcement.
- Do not change Button/Input/Text behavior unless catalog/contract tests reveal a real defect.
- Paint-smoke tests enumerate one test case per registered example so one slow/failing example
  reports its ID without hiding the rest behind a single aggregate loop.

## Verification

- Specification: ST-18 through ST-22.
- Each family gets a requirement-derived `*-components.spec.test.ts` before its pages/examples.
- Each family gets a later `*-components.impl.test.ts` for reset, focus, fixture, and error-path details.
- Final: `yarn verify`.
