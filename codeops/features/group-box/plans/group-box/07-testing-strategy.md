# Testing Strategy: GroupBox

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Use real `ScreenBuffer`, render-root, event-loop, example, and docs harness objects. Mock no internal
framework behavior. Runtime contract tests are written and observed failing before the component is
implemented; showcase and documentation contract tests likewise precede their target artifacts.

### Coverage Goal

Every listed ST case must pass. After each green phase, review the changed implementation for a real
branch or error path that is not observable through the immutable specifications. Add only a focused
`*.impl.test.ts` case when that review finds one; otherwise record the no-gap determination in the
execution plan. No coverage dependency or generalized harness is justified for this component.

## 🚨 Specification Test Cases

> These cases derive from `01-requirements.md`, the technical specifications, issue #205, and the
> confirmed AR decisions. They are immutable public oracles. In-code traceability comments describe
> the behavior in plain language and do not cite plan paths or identifiers.

### Runtime and Packaging

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | `new GroupBox()` in a parent with assigned bounds | Layout starts with padding `1`; title absent; start alignment and `staticText` role are effective; `castsShadow`, `focusable`, `preProcess`, `postProcess`, and `acceleratorScope` are false | FR-2, FR-3, FR-4 |
| ST-2 | Construct with every option set | Literal/getter title, all alignments, numeric/per-side padding, custom role, and shadow flag are accepted without changing unrelated Group layout properties | FR-1, FR-4, FR-11, FR-12 |
| ST-3 | Runtime and type-only imports from `@jsvision/ui` | `GroupBox` constructs and both public types compile from the package entry point | FR-1, FR-13 |
| ST-4 | Paint a normal box over prefilled cells | Every bound cell receives the selected role background; single-line border uses the same role and content behind unused interior cells is absent | FR-5, FR-11 |
| ST-5 | Omitted title and `title: ''` | Both buffers contain the same uninterrupted top border | FR-6 |
| ST-6 | Start, center, and end titles in a wide frame | Decorated caption occupies the corresponding top-border position by display cells and neither corner changes | FR-7, FR-8 |
| ST-7 | Title exactly fits with two blanks, then exceeds by one cell | Exact-fit title has one blank on each side; overlong title uses the full interior for its leading clipped prefix with no ellipsis | FR-7, FR-8, AR #4, AR #5 |
| ST-8 | Long ASCII title at each alignment | The same leading prefix survives, placement is safe, and corners remain intact | FR-7, AR #4 |
| ST-9 | CJK, emoji, combining, and mixed-width captions | Placement and clipping follow terminal cell widths; no wide glyph is split and no adjacent cell is corrupted | FR-7, FR-9 |
| ST-10 | Unsafe/control-sequence-like caption | The buffer contains sanitized display text only and no paint escapes the box | FR-9, Security |
| ST-11 | Widths/heights of 0, 1, and 2 inside a larger buffer | No throw or out-of-bounds mutation; assigned cells are opaque; frame/caption appears only when drawable; corners are never overwritten | FR-5, FR-7, AR #5 |
| ST-12 | Box partly outside an ancestor clip | Only intersecting cells change; adjacent and clipped-out cells remain untouched | FR-5, FR-9 |
| ST-13 | Literal title versus getter reading a signal | Both paint the same initial text; changing the signal schedules repaint and changes only the getter-backed caption | FR-10 |
| ST-14 | Unmount getter-backed box, then change its signal | Its subscription is disposed and no repaint is scheduled for the unmounted box | FR-10 |
| ST-15 | Render with custom role, then replace the root theme | Border, caption, and fill use that role together before and after theme replacement | FR-11 |
| ST-16 | Numeric padding `2` and asymmetric `Padding` with flow and absolute children | Resolved child bounds equal the existing content-box layout rules for every configured side | FR-4 |
| ST-17 | GroupBox containing focusable descendants, followed by another focusable sibling | Tab traversal enters descendants in ordinary order, never focuses GroupBox, and the box consumes no key/mouse/command event | FR-3, FR-6 |
| ST-18 | Nested GroupBoxes | Each box paints within its own bounds and the inner content is inset by its own padding without special-case layout | FR-3, FR-4 |
| ST-25 | Shadow false and true as child views over painted siblings | Default adds no shadow; true produces only the renderer's standard 2-column right and 1-row bottom darkening | FR-12 |
| ST-26 | Shadowed box at parent edge | Shadow is clipped by the ancestor and does not enlarge or move the box's layout bounds | FR-12 |
| ST-27 | Caller invokes `setLayout()` after construction | Changed padding and other layout properties take effect through normal Group behavior | FR-4 |
| ST-31 | Remove a getter-backed GroupBox, re-add the same instance, then change its signal | The remounted box owns a fresh subscription, schedules repaint, and draws the new caption without duplicate subscriptions | FR-3, FR-10 |
| ST-32 | Center/end captions contain stripped controls, retained tab/newline separators, or sanitize to empty | Geometry and drawing use one sanitized single-line value; separators become spaces and an empty safe value leaves the border uninterrupted | FR-7, FR-9 |
| ST-33 | Inspect emitted/public declarations and GroupBox source documentation | Storage does not add a protected subclass surface; class, alignment type, options interface, every option, constructor, draw behavior, and a practical example are documented | FR-1, FR-13 |

### Showcase and Documentation

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-19 | Load registered kitchen-sink `containers/group-box` story headlessly | Exactly one registry entry has required metadata, builds a Group, and paints non-blank cells | FR-14 |
| ST-20 | Inspect and interact with the kitchen-sink story | Two logical sections, three alignments, nesting, shadow comparison, role variation, wide/long clipping, and reactive feedback are observable; focus reaches descendants | FR-14, SR-1 |
| ST-21 | Trigger the story's reactive action and dispose it | Caption/feedback changes while mounted and no owned reactive work remains after disposal | FR-10, FR-14 |
| ST-22 | Validate GroupBox catalog entry and component page | The primary standard entry owns the page, public symbol, API symbol, and `containers/group-box` example; required page sections and comparison guidance exist | FR-15, FR-16 |
| ST-23 | Load docs example at 80×24 | It is `kind: 'app'`, uses Classic `demoApp`, has a centered compact non-maximized Template1Dialog, visible desktop margin, extra content inset, and dialog/menu background parity | FR-15, AR #6 |
| ST-24 | Resize, maximize, restore, and reduce the docs example | Authored rows stay readable, workspace grows, content remains inset and unclipped, and restored compact geometry returns | FR-15, AR #6 |
| ST-28 | Activate the docs lab's Alt-hotkey action and move focus | Visible status/caption feedback changes; focus remains on real descendants and never lands on a GroupBox caption | FR-3, FR-6, FR-15 |
| ST-29 | Generate docs API and validate links | Generated GroupBox API exists; component-to-API and API-to-component links resolve; sidebar/catalog route is unique | FR-16 |
| ST-30 | Inspect component page snippets and laboratory source | Snippets import public APIs and isolate flex/absolute concepts; live source is not pasted into Markdown; shadow spacing and clipping are taught accurately | FR-15, FR-16 |
| ST-34 | Validate exact component inventory and responsive-height policy | GroupBox appears exactly once in the standard component inventory and its example has exactly one valid resize classification | FR-15, FR-16 |
| ST-35 | Classify generated API exports for the new source segment | The `group-box` UI source segment maps to `containers`, never the fallback `core-essentials` page | FR-16 |
| ST-36 | Inspect canonical skill guidance and generated plugin copy | Both describe the passive selection boundary, defaults, role behavior, and external shadow-spacing duty, and generated content matches canonical content | FR-16 |
| ST-37 | Inspect the current sections of UI, examples, and docs-site changelogs | Each has one GroupBox entry under `Unreleased`; no package version is changed | FR-16 |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
|---|---|---|
| `packages/ui/test/group-box.rendering.spec.test.ts` | ST-4–ST-15, ST-31–ST-32 | Painting, caption, theme, reactivity, remount safety |
| `packages/ui/test/group-box.layout-focus.spec.test.ts` | ST-1, ST-2, ST-16–ST-18, ST-25–ST-27 | Layout, focus, nesting, shadow |
| `packages/ui/test/group-box.packaging.spec.test.ts` | ST-3, ST-33 | Public exports/types/documentation |
| `packages/examples/test/group-box-showcase.spec.test.ts` | ST-19–ST-21 | Kitchen-sink showcase |
| `packages/docs-site/test/group-box-component.spec.test.ts` | ST-22–ST-24, ST-28–ST-30, ST-34 | Page, template1 lab, behavior, API integration |
| `packages/examples/test/api-reference.spec.test.ts` | ST-35 | Plugin API category mapping |
| `packages/examples/test/group-box-distribution.spec.test.ts` | ST-36–ST-37 | Skill and changelog artifacts |

### Implementation Tests

| Test File | Description | Priority |
|---|---|---|
| `packages/ui/test/group-box.impl.test.ts` | Any runtime branch not observable through ST-1–ST-18/ST-25–ST-27/ST-31–ST-33; create only when the recorded branch review finds one | Medium |
| `packages/examples/test/group-box-showcase.impl.test.ts` | Any story-only branch not observable through ST-19–ST-21; create only when the recorded branch review finds one | Medium |
| `packages/docs-site/test/group-box-component.impl.test.ts` | Any lab-only branch not covered by ST-22–ST-24/ST-28–ST-30/ST-34 or the family harness; create only when the recorded branch review finds one | Medium |
| `packages/examples/test/group-box-distribution.impl.test.ts` | Any generator/artifact branch not covered by ST-35–ST-37 or existing plugin tests; create only when the recorded branch review finds one | Low |
| Existing family/harness implementation tests | Continue covering generic example registry, layout, draw, focus, shadow, and docs harness internals unchanged | High |

### Integration Tests

| Test | Components | Description |
|---|---|---|
| UI package suite | GroupBox + view/layout/render root | Real composition, focus, theme, and shadow behavior |
| Kitchen-sink suite | Story + registry + render root | Headless build and interaction |
| Docs-site unit suite | Catalog + registry + Template1Dialog + page | Real app geometry, interaction, and content contracts |
| Plugin check | Canonical skill + generated plugin | Distribution parity |

### End-to-End Tests

The docs-site laboratory test exercises the complete constructed application and is the feasible
in-process end-to-end path. No new browser/TTY harness is justified for a passive renderer component.
`yarn docs:build` supplies production documentation integration.

## Test Data

Use deterministic ASCII, CJK, emoji, combining-mark, unsafe-display, long-title, tiny-geometry,
custom-theme, nested-container, and focusable-child fixtures. No external data or mocks are needed.

## Verification Checklist

- [ ] ST specification files exist before implementation and fail for the missing component/artifacts.
- [ ] Runtime ST tests pass after implementation.
- [ ] Showcase ST tests pass after story implementation.
- [ ] Docs ST tests pass after page/lab/catalog implementation.
- [ ] Implementation-only branches are covered without duplicating public oracles.
- [ ] UI typecheck, tests, and JSDoc check pass.
- [ ] Examples typecheck and tests pass.
- [ ] Docs-site typecheck and tests pass.
- [ ] `yarn docs:build`, `yarn plugin:update`, and `yarn plugin:check` pass.
- [ ] `yarn verify:local` passes.
