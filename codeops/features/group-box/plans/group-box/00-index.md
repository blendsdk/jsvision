# GroupBox Implementation Plan

> **Feature**: Passive captioned container for `@jsvision/ui`
> **Status**: Planning Complete
> **Created**: 2026-09-05
> **Implements**: group-box/GH-205 — [GitHub issue #205](https://github.com/blendsdk/jsvision/issues/205)
> **CodeOps Artifact Schema**: 1

## Overview

Add a public `GroupBox` container that visually groups related child views without adding the
activation, focus, commands, navigation, or window-management behavior of `Dialog`, `Window`, or
`TabView`. It extends the existing `Group`, paints an opaque single-line frame through a selected
theme role, supports a literal or reactive caption with display-cell-aware alignment and clipping,
applies configurable content padding, and opts into the renderer's existing shadow composition.

The feature includes immutable public-contract tests, a focused kitchen-sink story, a complete
standard component teaching page with a `template1` laboratory, public packaging and generated API
links, the supported JSVision skill surface, and relevant package changelogs (AR #2, AR #6, AR #7).

## Minimum-Sufficient Baseline

**Original goal:** Implement the complete public `GroupBox` contract in issue #205 and make it
discoverable and verifiable across the SDK, showcases, docs site, and Codex plugin.

**Smallest viable design:** Add one dedicated `group-box` UI module. Extend `Group`, reuse
`DrawContext.box()`, `clipCellText()`, `stringWidth()`, `sanitize()`, `View.bind()`, layout padding,
and inherited `castsShadow`; add no dependency or new generalized subsystem (AR #3).

**Excluded machinery:** A public drawing-API change, a generalized frame layer, new glyph tables,
layout-engine changes, automatic shadow margins, or a new umbrella containers architecture.

**Approved complexity:** None. All work uses existing component, test, example, docs, and plugin
patterns.

**Overengineering gate:** Keep title normalization as one component-local helper and reactive setup
as one `GroupBox.mount()` override. Do not change `View`, `Group`, `DrawContext`, the layout engine,
or the sanitizer; do not add a generalized framed-container abstraction, dependency, or reusable
test framework. Registry and API-generator edits are exact membership mappings only.

## Domain Lenses

No add-on domain lens applies. This is an additive in-process UI component with no parser, financial
data, web/session boundary, concurrency, persistent schema, serialized format, or mixed-version
migration. Universal scope, behavior, compatibility, security, quality, and verification checks
still apply.

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Confirmed scope and design decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Issue-derived requirements and scope |
| 02 | [Current State](02-current-state.md) | Repository-grounded implementation analysis |
| 03-01 | [Runtime Component](03-01-runtime-component.md) | API, painting, layout, reactivity, and shadow design |
| 03-02 | [Showcases and Documentation](03-02-showcases-and-documentation.md) | Kitchen-sink and docs-site integration |
| 03-03 | [Distribution](03-03-distribution.md) | Packaging, skill synchronization, and changelogs |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered task checklist |

## Quick Reference

```ts
import { GroupBox, Text, col, grow } from '@jsvision/ui';

const details = new GroupBox({ title: 'Application', padding: 1 });
details.add(grow(col({}, new Text('Name: Customer Portal'), new Text('Status: Active'))));
```

## Key Decisions

| Decision | Outcome |
|---|---|
| Plan ownership | Active `group-box` feature; issue-driven plan without a duplicate RD (AR #1) |
| Runtime architecture | Dedicated UI module using existing primitives; no public drawing change (AR #3) |
| Caption clipping | Leading display-cell prefix, no ellipsis, for every alignment (AR #4) |
| Narrow decoration | Add both blanks only when both fit; otherwise prioritize caption cells (AR #5) |
| Documentation | Complete standard page and registered `template1` app (AR #6) |
| Distribution | Update canonical skill, regenerate plugin, and update three changelogs (AR #7) |
| Complexity | Component-local behavior only; no global lifecycle, drawing, layout, or sanitizer change |

## Related Files

- `packages/ui/src/group-box/group-box.ts`
- `packages/ui/src/group-box/index.ts`
- `packages/ui/src/index.ts`
- `packages/ui/test/group-box.*.test.ts`
- `packages/examples/kitchen-sink/stories/group-box.story.ts`
- `packages/examples/test/group-box-showcase.spec.test.ts`
- `packages/docs-site/components/containers/group-box.md`
- `packages/docs-site/examples/containers/group-box.ts`
- `packages/docs-site/src/example-registry/containers.ts`
- `packages/docs-site/components.json`
- `packages/docs-site/src/api/api-map.mjs`
- `packages/docs-site/test/group-box-component.spec.test.ts`
- `packages/docs-site/test/component-catalog.spec.test.ts`
- `packages/docs-site/test/contracts/primitive-resize.ts`
- `packages/examples/test/api-reference.spec.test.ts`
- `packages/examples/test/group-box-distribution.spec.test.ts`
- `scripts/gen-plugin-api.mjs`
- `tools/jsvision-skill/references/component-catalog.md`
- `plugins/jsvision-plugin/skills/jsvision/` (generated)
