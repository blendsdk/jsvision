# RD-15: Documentation, Examples, and Distribution

> **Document**: RD-15-docs-examples-distribution.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-01 through RD-14
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

As a JSVision-team component, Kanban requires teaching-quality public documentation and compelling live
evidence, not only generated API pages. The docs component page and specialist course teach construction,
ownership, data sources, layout, cards, workflow, interaction, editing, views, scale, i18n, security, and
failure recovery. A general kitchen-sink story demonstrates integration, while a separate polished
`kanban-showcase` application is intentionally strong enough to present to r/tui.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Publish a complete component teaching page based on the repository's
  `component-page-template1` directive, linking to generated API rather than duplicating it.
- [ ] Publish a Data Grid-style Kanban specialist documentation hub/course with progressive chapters,
  navigation, accurate public snippets, and at least 18 focused live examples across the capability set.
- [ ] Build every new live example as a complete `demoApp(ctx, { themeMenu: true })` Classic-theme app
  inside shared `Template1Dialog`, registered `kind: 'app'`, compact/centered/padded/responsive, with
  visible desktop margins and keyboard/mouse instructions.
- [ ] Give each live example one learning objective, unique registry ID, precise title/blurb, realistic
  deterministic data, visible action feedback, and focused specification coverage.
- [ ] Add a polished representative Kanban story to the general JSVision kitchen sink.
- [ ] Add `packages/examples/kanban-showcase/` as an independently runnable application inside the
  existing `@jsvision/examples` workspace, with realistic workflows and a Reddit-ready terminal
  presentation demonstrating the complete component.
- [ ] Demonstrate keyboard and flagship pointer drag, cards/checklists/styles, swimlane variants, WIP/DoD,
  filters/views, editors/configuration, lifecycle/errors, scale/windowing, read-only/capabilities,
  locale/theme/color-depth/ASCII, responsive resize/narrow behavior, and custom SDK seams.
- [ ] Publish package README, changelog/release notes, public JSDoc/generated API, migration/versioning,
  accessibility/security/host-boundary, performance-evidence scope, and troubleshooting guidance.
- [ ] Add source-impact mapping/references for the new public SDK and run `yarn plugin:update` and
  `yarn plugin:check`; never edit the generated plugin skill copy directly.
- [ ] Keep examples alive after opening and reachable by keyboard; meaningful mouse paths must use real
  routed events, not self-authored labels.

### Should Have — Complexity L

- [ ] Include recording/screenshot guidance and a deterministic default showcase story suitable for
  sharing while avoiding fake benchmark/security claims.
- [ ] Provide copyable recipes for generic records, `StandardCard`, windowed source, custom renderer,
  custom editor field, saved views, and application dispatcher/capabilities.
- [ ] Cross-link genuinely related Layout, Forms, Dialogs, i18n, themes, accessibility, testing, async,
  Data Grid, and Code Editor docs without duplicating their courses.

### Won't Have (Out of Scope)

- Placeholder docs/navigation, bare-component generic wrappers, static screenshots as the only evidence,
  duplicated live-example modules pasted into Markdown, or claims unsupported by source/tests.
- A showcase that accesses visitor files, network, clipboard, database, or other privileged resources.

---

## Technical Requirements

### Component page — Complexity L

The page follows required order: frontmatter/title, overview, quick usage, flagship live example, public
configuration, sizing/layout, data/ownership, cards, workflow/swimlanes, navigation/selection, pointer
drag, requests/lifecycle, filters/views, editing/configuration, commands/capabilities, i18n/accessibility,
performance/security, best practices, theming, and related/API links. Snippets import supported public
entry points and demonstrate one concept each. Every prop/default/event/command/theme/capability claim is
verified against implemented public source/tests before publication.

### Specialist hub and live-lab inventory — Complexity XL

At minimum the course contains distinct labs for:

1. application-owned basic board and responsive layout;
2. generic versus standard cards and density;
3. checklist/summary configuration;
4. reactive status styling and theme/color fallbacks;
5. workflow columns, WIP, DoD, and transitions;
6. swimlane grouping and four presentation variants;
7. keyboard focus/navigation/selection;
8. pointer card drag, gutters, reflow, autoscroll, cancellation;
9. multi-card and column/swimlane reorder;
10. search, quick filters, sorting, counts, and filtered empty;
11. saved views, personalization, validation/migration;
12. standard card editor and custom schema fields;
13. column/swimlane configuration and non-empty delete policy;
14. commands, events, keymap conflicts, capabilities, and read-only;
15. loading/partial/error/retry, pending/rejected/superseded operations;
16. eager versus windowed scale with honest counts;
17. locale, translated layout, color depth, monochrome, Unicode/ASCII;
18. custom renderer/editor/source/dispatcher and failure isolation.

Closely related states may share one lab for comparison; unrelated objectives do not become one dense
dashboard. Every lab is authored with the docs-site `template1` rules and tested at 80×24, resize,
maximize, restore, Classic surface, interactions, cleanup, and objective-specific state.

### Kitchen sink — Complexity M

The general kitchen sink adds one representative story using the existing application shell and
navigation conventions. It demonstrates a compact realistic board, keyboard and pointer movement,
one editor, one view/filter change, feedback, and theme/locale compatibility without duplicating the
specialist course or showcase. It remains part of the global required story/test inventory.

### Dedicated showcase — Complexity XL

`packages/examples/kanban-showcase/` is an independently runnable application inside the single
`@jsvision/examples` workspace; it is not an overlapping nested Yarn workspace. The examples workspace
declares the Kanban dependency and a `demo:kanban` script, and its Vitest configuration explicitly includes
the showcase unit/headless/E2E trees. The application uses deterministic sample
work representing teams/projects/epics/sprints, multiple workflow stages, WIP/DoD, labels/assignees/dates,
checklists, summary counts, reactive status styles, swimlane variants, filters/saved views, editors and
configuration. It includes:

- obvious but uncluttered keyboard/mouse instructions and visible action status;
- real drag ghost/gutters/reflow/autoscroll and multi-selection;
- menu commands for theme, locale, density, grouping, lifecycle fixture, scale mode, read-only, help;
- eager and controllable windowed datasets without network;
- responsive surface/window demonstrations and resize/minimum recovery;
- truecolor/limited/mono/ASCII fixtures or simulated capability profiles clearly labeled;
- no visitor files/network/clipboard/credentials;
- smoke/headless interaction tests and a manual native/browser TTY review checklist.

The default launch tells one coherent, visually polished story and does not start in an error/debug
dashboard. Debug/edge states remain reachable through menus.

### Documentation and distribution synchronization — Complexity L

Package source changes update public JSDoc/API generation, component/specialist docs, recipes/snippets,
examples, release notes, and canonical `tools/jsvision-skill/` references where mapped. Add
`packages/kanban/src` and relevant example/docs paths to `tools/jsvision-plugin-impact.json` with the
correct reference set. Run `yarn plugin:update`, inspect generated API/snippets/snapshot/assembled copy,
and include them in the same change. Run `yarn plugin:check` before completion.

The implementation/release plan must enumerate and test every current explicit registration point:

- root workspace/package dependency wiring and `packages/docs-site/package.json`;
- docs component catalog types/data, VitePress component/API sidebars, API package inventory/back-links,
  Kanban example-family registry, and global required-example/story inventory;
- `tools/i18n-locale-exports.json` plus current digest-bound locale review evidence;
- `scripts/gen-plugin-api.mjs`, `tools/jsvision-plugin-impact.json`, generated API/reference output, and
  canonical `tools/jsvision-skill/` references;
- `scripts/check-performance.mjs` and any release/packed-consumer inventory introduced for Kanban; and
- `packages/examples` scripts, dependency, Vitest discovery, and showcase launch entry.

Focused omission-detection assertions fail if the publishable `@jsvision/kanban` package exists without
any required registry entry. Converting these repositories to global manifest discovery is separate
infrastructure scope.

---

## Integration Points

- Teaches and demonstrates every RD-01–RD-14 public behavior at the phase where it becomes real.
- Uses docs-site component/template directives and the general examples workspace conventions.
- Updates canonical JSVision skill/plugin impact and generated distribution artifacts.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Docs depth | API / page / specialist course | Page+specialist+API | Data Grid-class component | AR #13 |
| Examples | Kitchen sink / showcase / both | Both + focused labs | Integration, teaching, promotion | AR #14 |
| Showcase bar | Smoke / polished Reddit-ready | Reddit-ready | Explicit showcase goal | AR #14, #31 |
| Layout | Bare wrapper / template1 app | Template1 apps | Responsive authentic docs | AR #41 |
| Distribution | Package only / plugin parity | Complete parity | Supported SDK surface | AR #13, #38 |

---

## Security Considerations

- Examples use deterministic in-memory/virtual sources and never implicitly access visitor files,
  clipboard, network, credentials, database, environment secrets, or host processes.
- Sample card/error/filter data contains no real PII/secrets and passes the same sanitization boundary.
- Performance, capability, security, and accessibility statements cite bounded evidence scope and avoid
  guarantees beyond tests/host profiles.
- Copyable snippets keep application authorization/validation/persistence boundaries explicit and do not
  normalize unsafe bypasses.
- Generated/plugin content is reviewed; consumer scripts remain independent of this monorepo at runtime
  and never install dependencies without explicit workflow authorization.

---

## Acceptance Criteria

1. [ ] The component page contains every required backbone section, accurate public snippets, at least
   one flagship lab near the top, specialist links, exact theme/state guidance, and generated API link.
2. [ ] The specialist hub contains all 18 distinct learning objectives above; each has a unique registry
   ID and no two labs merely repeat sample data for the same behavior.
3. [ ] Every new lab registers `kind: 'app'`, builds a complete Classic `demoApp` with shared
   `Template1Dialog`, starts compact/centered with visible 80×24 desktop margins, and remains alive.
4. [ ] Every lab preserves one-cell interior inset, uses responsive DSL composition, and passes compact,
   resize, maximize, restore, unclipped-content, Classic-surface, interaction, and cleanup assertions.
5. [ ] Every documented keyboard action is reachable and every meaningful mouse claim routes a real
   pointer event to observable component state/request feedback.
6. [ ] PlayExample titles/blurbs state exactly what to try/observe and match focused specification
   assertions rather than generic marketing language.
7. [ ] Snippets import only public supported entries, compile where practical, demonstrate one concept,
   and do not paste live-example modules or invent APIs/defaults.
8. [ ] The general kitchen sink contains a tested representative Kanban story and remains in the global
   required-story inventory.
9. [ ] `packages/examples/kanban-showcase/` launches a deterministic coherent default board and exposes
   every required showcase capability through reachable menus/commands without network/files/clipboard.
10. [ ] The showcase remains inside `@jsvision/examples`; `demo:kanban` launches it and explicit Vitest
    includes discover its unit, headless interaction, and E2E tests.
11. [ ] Showcase headless tests perform keyboard selection/move, pointer drag with reflow, editor submit/
    rejection, view/group change, responsive resize, locale/theme/capability change, and cleanup.
12. [ ] Manual native terminal and browser/xterm checklist records host/version/date for pointer capture,
    damage, wheel/autoscroll, key routes, resize, colors, Unicode/ASCII, and does not substitute for tests.
13. [ ] Docs explicitly distinguish 5,000 resident and 100,000 logical targets and label controlled timing/
    compatibility measurements as scoped evidence, not universal guarantees.
14. [ ] Package README/changelog/JSDoc/generated API document ownership, requests, sources, layout,
    cards, views, editors, commands, i18n/accessibility, limits, security boundaries, and migrations.
15. [ ] Every explicit repository registration point listed above contains Kanban, and focused tests fail
    when any one entry is removed.
16. [ ] Plugin impact maps Kanban source/example changes to reviewed canonical references; after
    `yarn plugin:update`, generated API/snippets/snapshot/assembled skill have no unexplained drift.
17. [ ] `yarn plugin:check`, `yarn i18n:reviews:check`, focused docs tests/typecheck/build, package checks,
    packed-consumer checks, and `yarn verify:local`
    pass; full `yarn verify` remains CI-owned unless explicitly requested.
18. [ ] Searches find no placeholder page, broken route/registry ID, private source import, visitor-resource
    access, real secret/PII, unsupported accessibility/security claim, or direct edit to generated skill copy.
