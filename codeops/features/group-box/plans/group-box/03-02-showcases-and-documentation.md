# Showcases and Documentation: GroupBox

> **Document**: 03-02-showcases-and-documentation.md
> **Parent**: [Index](00-index.md)

## Overview

Ship two independent teaching surfaces: a kitchen-sink story for the repository-wide component
showcase and a docs-site `template1` application for the component teaching page. They may share the
public component contract, but not a source module or test harness (AR #2, AR #6).

## Kitchen-Sink Story

Add `containers/group-box` to the explicit story registry. The bounded story uses the available
canvas, contains at least two logical sections comparable to Application and Modules, and visibly
demonstrates:

- start, center, and end caption alignment;
- a reactive caption changed by a reachable focusable descendant action;
- nested GroupBoxes and ordinary descendant focus traversal;
- shadowed and unshadowed composition with enough surrounding space to see the standard shadow;
- a non-default theme role or a live role/theme comparison; and
- a long or wide caption clipped without touching frame corners.

The story remains useful under the headless builder and supplies concise keyboard guidance. It does
not claim a requirements-document provenance chip because the source is GH-205, not an RD.

## Docs-Site Live Laboratory

Register `containers/group-box` as `kind: 'app'`. Build a complete application with
`demoApp(ctx, { themeMenu: true })` and its default Classic theme. Place the showcase inside the
shared non-closable `Template1Dialog`, constructed with compact width and height but no positioned
rect, and add it to `app.desktop` (AR #6).

The dialog leaves patterned desktop visible on every side at 80×24. Its content receives the
required extra one-cell inset beyond the frame. Responsive logic preserves labels, buttons,
instructions, and status rows while allowing the principal GroupBox workspace to grow. Maximize,
restore, and ordinary resize must remain unclipped. Startup is not maximized.

The lab's single learning objective is to compare passive grouping states. It includes visible
action feedback, usable Alt-hotkeys on actual controls, and short keyboard/mouse instructions. A
reactive action changes one caption while focus stays within ordinary descendants; the GroupBox
caption itself never acts as a hotkey.

## Component Page

Create `/components/containers/group-box` using the complete standard component-page backbone:

1. Search-friendly frontmatter and title.
2. Overview and selection guidance.
3. Small public-package usage snippet.
4. Primary `<PlayExample id="containers/group-box">` with an accurate interaction title and blurb.
5. Public options/defaults table.
6. Sizing and layout, including no intrinsic `measure()`, parent-assigned bounds, padding, clipping,
   resize behavior, and external shadow spacing.
7. Caption, reactivity, passivity/focus, nesting, and composition sections.
8. Concrete best practices and consequences.
9. Exact role behavior: the selected `ThemeRoleName` supplies border, caption, and opaque fill;
   standard shadow uses `shadow`.
10. Related links to Group, Tabs, Window, Dialog, layout guidance, and generated GroupBox API.

Include separate essence-only flex and absolute-layout snippets. Do not paste either showcase module
into Markdown.

## Catalog and API Integration

- Add a primary standard `GroupBox` component entry to `components.json` under Containers and
  navigation, with its example and API symbol.
- Place its sidebar order next to the foundational passive containers without renumbering unrelated
  families more than necessary.
- Add the lazy example descriptor to the container registry.
- Add the `GroupBox` hand-written page ↔ generated class API mapping.
- Extend the independent docs contract fixtures and add focused behavior/geometry assertions without
  turning the family test into a component-specific implementation test.
- Update the exact component inventory in `component-catalog.spec.test.ts` and classify the new lab
  in `contracts/primitive-resize.ts` according to its direct-child layout.

## Testing Requirements

Cover ST-19 through ST-24, ST-28 through ST-30, and ST-34. The docs test must render the real example and
verify compact centering, Classic dialog/menu surface parity, visible desktop margins, resize,
maximize, restore, responsive unclipped content, reactive feedback, normal descendant focus, and
disposal.
