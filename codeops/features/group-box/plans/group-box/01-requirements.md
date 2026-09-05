# Requirements: GroupBox

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [GitHub issue #205](https://github.com/blendsdk/jsvision/issues/205) — owning issue contract

## Feature Overview

`GroupBox` is a passive, opaque, framed `Group` for visually separating related content in forms,
settings screens, inspectors, and master/detail layouts. It provides only grouping, layout inset,
theme-controlled painting, an optional caption, and optional standard shadow composition. It does
not introduce interactive chrome or navigation state (AR #2).

## Functional Requirements

### Must Have

- **FR-1 Public API.** Export `GroupBox`, `GroupBoxOptions`, and
  `GroupBoxTitleAlignment = 'start' | 'center' | 'end'` from a local module barrel and the top-level
  `@jsvision/ui` entry point. The optional constructor accepts exactly the issue-defined options.
- **FR-2 Defaults.** Omitted options resolve to no caption, `titleAlignment: 'start'`, `padding: 1`,
  `role: 'staticText'`, and `shadow: false`.
- **FR-3 Container behavior.** Extend `Group`; preserve static and dynamic child lifecycle, mounting,
  removal, ordinary layout configuration, nesting, and focus traversal into descendants. The
  `GroupBox` itself remains non-focusable and handles no input, commands, accelerators, activation,
  or selection.
- **FR-4 Layout.** Initialize the group layout with configured `number | Padding` content padding
  without changing ordinary `Group` direction, size, gap, alignment, justification, position, or
  placement defaults. Later `setLayout()` calls remain authoritative.
- **FR-5 Opaque frame.** Fill the complete assigned bounds with the configured role, including bounds
  too small for a frame, and draw a clipped single-line frame when width and height are at least two.
  Never paint outside the view or ancestor clip.
- **FR-6 Caption.** Omitted and empty titles leave the top border uninterrupted. Non-empty titles are
  display text only: no `~X~` parsing, accelerator, focus target, or command behavior.
- **FR-7 Alignment and clipping.** Align captions at the start, center, or end of the top-border
  interior using terminal display-cell width. Preserve the leading prefix without ellipsis when
  clipping; never overwrite either corner (AR #4).
- **FR-8 Decoration.** Add one blank cell on both sides when the entire caption and both blanks fit.
  Otherwise use the available interior for the clipped caption without decoration (AR #5).
- **FR-9 Unicode safety.** Wide CJK and emoji glyphs, zero-width combining marks, malformed or unsafe
  display text, and long captions must remain clipped and unable to corrupt adjacent cells. Caption
  geometry must use the same sanitized single-line value that is painted: retained tab and newline
  characters become ordinary spaces before empty checks, decoration, clipping, and alignment.
- **FR-10 Reactivity.** Accept a literal string or `() => string`. Bind a getter on mount, repaint when
  its signal dependencies change, and dispose that subscription with the inherited view scope.
- **FR-11 Theme role.** Resolve the configured `ThemeRoleName` on every draw so its foreground and
  background control border, caption, and fill together and runtime theme replacement is reflected.
- **FR-12 Shadow.** Initialize inherited `castsShadow` from `shadow`. Default to false; when true, use
  the existing renderer's two-column right and one-row bottom shadow. Do not add implicit layout
  margin; ancestor clipping remains authoritative.
- **FR-13 Public documentation.** Provide exhaustive junior-readable JSDoc for all public types,
  options, properties, and the class, including a practical `@example`.
- **FR-14 Kitchen-sink showcase.** Register a focused story showing logical sections, multiple title
  alignments, a reactive caption, nested content, normal descendant focus, shadowed and unshadowed
  boxes, a non-default role or live theme change, and safely clipped wide/long text.
- **FR-15 Component teaching page.** Add a complete standard component page and registered
  `kind: 'app'` `template1` laboratory. Teach when to choose `GroupBox` over `Group`, `TabView`,
  `Window`, or `Dialog`; document defaults, layout, flex and absolute placement, focus/passivity,
  caption behavior, theming, shadow spacing, clipping, best practices, and related/API links (AR #6).
- **FR-16 Distribution.** Update component catalog/navigation, example registry, API link map,
  canonical JSVision skill component catalog, generated plugin copy, and UI/examples/docs changelogs
  (AR #7).
- **FR-17 Verification.** Pass all ST cases in `07-testing-strategy.md` and the confirmed focused,
  docs-build, plugin, and local verification sequence (AR #8).

### Should Have

- **SR-1 Showcase clarity.** Present comparison states together and expose visible feedback for the
  reactive action while retaining concise keyboard and mouse instructions.
- **SR-2 Implementation size.** Keep the component small enough to audit directly; add an
  implementation test only for branches not already covered by immutable public-contract tests.

### Won't Have (Out of Scope)

- Collapsing, expanding, selection, activation, commands, accelerators, or clickable captions.
- Window/dialog movement, resizing, zooming, closing, modal execution, or focus-scope behavior.
- Custom glyphs, border styles, independent title/border/fill roles, or public drawing-API changes.
- Automatic shadow margin, parent-layout changes, or ancestor-clip bypass.
- Replacement or behavioral modification of `Group`, `TabView`, `Window`, or `Dialog`.
- New dependencies, generalized frame infrastructure, or unrelated refactors (AR #3).
- Global changes to `View`, `Group`, `DrawContext`, the layout engine, or the sanitizer.

## Technical Requirements

### Performance

- Painting remains proportional to the assigned rectangle, matching the existing `box()` behavior.
- Caption placement and clipping remain proportional to caption code points and allocate no retained
  cache or background work.

### Compatibility

- The change is additive. Existing exports, widget behavior, draw semantics, layout behavior, and
  theme schema remain unchanged.
- Capability fallback remains owned by the renderer; the component must not branch on raw ASCII.

### Security

- Caption text is sanitized with the existing core sanitizer, normalized to one line, and then sent
  only through clipped `DrawContext` writers. Measurement and painting use that same safe value.
- No filesystem, network, process, clipboard, authentication, authorization, secret, persistence,
  or host-capability surface is introduced. Security tests beyond unsafe-display-text containment are
  not applicable.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Feature ownership | New feature / maintenance / archived feature | New issue-driven `group-box` feature | The issue defines a cohesive public SDK capability | AR #1 |
| Delivery scope | Runtime only / complete issue surface | Complete issue surface | Every acceptance surface ships together | AR #2 |
| Runtime structure | Dedicated module / view module / umbrella containers / public drawing change | Dedicated module using existing helpers | Matches current component families and adds no global API | AR #3 |
| Long caption policy | Prefix / suffix for end | Prefix for all alignments, no ellipsis | Matches existing clipping semantics | AR #4 |
| Decoration under pressure | Pair only / clip decorated text | Pair only; caption gets scarce cells | Preserves meaningful content in narrow frames | AR #5 |
| Docs integration | Standard page and app / prose only | Standard page and `template1` app | Required by the active component-doc contract | AR #6 |
| Plugin/release surfaces | Update / omit | Update canonical skill, generated plugin, changelogs | Keeps supported SDK surfaces synchronized | AR #7 |
| Verification | Full focused sequence / changed-file gate only | Full focused sequence | Matches project completion rules without running CI's full gate locally | AR #8 |

## Acceptance Criteria

1. Every FR-1 through FR-17 has passing specification evidence.
2. No existing public behavior or specification is weakened.
3. The implementation introduces no public API beyond issue #205.
4. The docs laboratory remains centered, compact, responsive, unclipped, Classic-themed, resizable,
   maximizable, and restorable at the standard 80×24 viewport.
5. All confirmed verification commands pass.
