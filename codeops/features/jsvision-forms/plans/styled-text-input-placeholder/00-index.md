# Styled Text Severity & Input Placeholder — Implementation Plan

> **Feature**: Two presentation primitives — a `severity`-coloured `Text` and an `Input` `placeholder` — plus the two `@jsvision/core` theme roles that power them.
> **Status**: ✅ Implemented & shipped (32/32 tasks, `yarn verify` green — 2026-07-15)
> **Created**: 2026-07-15
> **Implements**: jsvision-forms/RD-09
> **CodeOps Skills Version**: 3.7.0

## Overview

Forms (and the wider widget set) need two things they cannot express today: text painted in a
**semantic severity colour** (a danger-red validation error, an amber advisory), and a
**placeholder** for the `Input` line editor. Right now `Text`/`Label` hard-code the `staticText`
role and take no colour, the resolved `Theme` has no danger/warning *text* role (the `danger`/
`warning` colours exist only as unused theme *aliases*), and `Input` has no placeholder — so a
validation error is the same colour as help text, and an empty field says nothing about what belongs
in it.

This plan closes that gap at the framework level, so every downstream forms slice — async
validation error/"checking…" states (RD-06), the modal `formDialog` (RD-08), and the comprehensive
showcase (RD-05) — inherits proper error styling and placeholders for free. It is deliberately
**presentation only**: the `@jsvision/forms` store/validation engine is untouched, and the
touched-gated reveal (`field.touched() && field.error()`) stays app-composed exactly as the current
showcase already does (AR-32).

The change spans three packages — `@jsvision/core` (two new required `Theme` roles, promoted from
the existing `danger`/`warning` aliases), `@jsvision/ui` (`Text.severity`, `Input.placeholder`, and
placeholder forwarding on `DatePicker`/`ComboBox`/`inputBox`), and `@jsvision/examples` (kitchen-sink
stories) — and touches the guard specs that inventory the role set. Core stays zero runtime deps.

## Document Index

| #   | Document                                                   | Description                                        |
| --- | ---------------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)             | Zero-Ambiguity Gate — imported AR-25…32 + AR-P rows |
| 00  | [Index](00-index.md)                                       | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                         | Delta view over RD-09 (the owning requirements doc) |
| 02  | [Current State](02-current-state.md)                       | The exact code the plan touches (verified file:line) |
| 03-01 | [Core Theme Roles](03-01-core-theme-roles.md)            | `dangerText`/`warningText` roles + guards           |
| 03-02 | [UI: Text severity & Input placeholder](03-02-ui-text-input.md) | `Text.severity`, `Input.placeholder`, propagation |
| 03-03 | [Stories & role-count strings](03-03-stories-and-counts.md) | Kitchen-sink demos + the stale "63"→"67" fixes    |
| 07  | [Testing Strategy](07-testing-strategy.md)                 | ST-cases (spec oracles) + verification             |
| 99  | [Execution Plan](99-execution-plan.md)                     | Phases, tasks, checklist                            |

## Quick Reference

### Usage Examples

```ts
import { Text, Input, signal } from '@jsvision/ui';

// A touched-gated validation error, painted danger-red (app composes the reveal).
const emailError = new Text(() => (field.touched() ? field.error()?.message ?? '' : ''), {
  severity: 'error',
});

// An empty field advertises what belongs in it; the placeholder never enters the value.
const name = signal('');
const nameInput = new Input({ value: name, placeholder: 'Full name' });
```

```ts
import { createTheme } from '@jsvision/core';

// The danger/warning override flows straight through to the two text roles.
const t = createTheme({ mode: 'light', accent: '#3b82f6', danger: '#c00', warning: '#fa0' });
t.dangerText.fg; // '#c00'
t.warningText.fg; // '#fa0'
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Colour model | Two core theme roles from the existing aliases | AR-25 |
| Role names | `dangerText` / `warningText` (avoid the `warning` **alias** collision) | AR-25/27, PF-003 |
| Styled primitive | Extend `Text` with `severity?: 'error' \| 'warning'` | AR-26/27 |
| Placeholder visibility | Whenever the value is empty | AR-28 |
| Placeholder style | Composed muted style, no new role | AR-29 |
| Placeholder propagation | `DatePicker` + `ComboBox` + `inputBox()` | AR-30, PF-001 |
| `createTheme` reach | No logic change — only `rolesFromAliases` + stale doc-comments | AR-P4 |
| theme-designer reserved-alias | `danger`/`warning` dropped from `RESERVED_ALIASES` + `roles-panel.spec` revised — they now drive roles | RD AC #7, plan-preflight PF-001 |
| `TextOptions`/`TextSeverity` barrel export | Re-exported from the UI barrels (sibling convention) | plan-preflight PF-002 |
| forms package | Untouched — reveal stays app-composed | AR-32 |

## Related Files

**Modify** — `packages/core/src/engine/color/{theme.ts,roles.ts,presets.ts,create-theme.ts}` ·
`packages/ui/src/controls/{text.ts,input.ts,input-render.ts}` · the UI barrels
`packages/ui/src/{controls/index.ts,index.ts}` (re-export `TextOptions`/`TextSeverity`) ·
`packages/ui/src/{date/date-picker.ts,dropdown/combo-box.ts,dialog/message-box.ts}` ·
`packages/theme-designer/src/{view/roles-panel.ts,model/types.ts}` ·
five `packages/ui/test/*-theme.spec.test.ts` tripwires · `packages/theme-designer/test/roles-panel.spec.test.ts` ·
kitchen-sink stories + `theming.story.ts` role-count strings.

**Create** — a `@jsvision/core` own-guard spec pinning the two role fg values; new spec/impl tests
for `Text.severity` and `Input.placeholder`.
