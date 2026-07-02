# Input Dropdowns Implementation Plan

> **Feature**: `History` + `ComboBox<T>` dropdown controls on a shared anchored-popup primitive
> **Status**: Planning Complete
> **Created**: 2026-07-02
> **Implements**: jsvision-ui/RD-14
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-14 adds the **input-dropdown tier** of `@jsvision/ui` — the two controls that pair a text field
with a drop-down list, both sharing one anchored-popup mechanism generalized from the RD-05 menu
overlay:

- **`History`** — a faithful re-creation of Turbo Vision's `THistory`: a small `▐↓▌` button linked
  to an `Input` that drops down a list of that field's previously-entered values (a bounded MRU
  store keyed by `historyId`); picking one replaces the field text and selects it.
- **`ComboBox<T>`** — a control with **no TV counterpart** (an `Input` + drop-down `ListView<T>`,
  editable with filter-as-you-type or select-only with type-ahead), designed fresh but drawn like
  its `TListBox`/History siblings per the fidelity directive.

The controls are a new `packages/ui/src/dropdown/` subsystem built entirely on existing engine
primitives (RD-11 `ListView`/ScrollBar, RD-05 overlay + catcher, RD-06/07 `Input`, RD-01/02/03
reactivity/layout/draw). The only additive surface is small and non-breaking: **three intra-`ui`
seams** (a public `Input` linkage seam, an imperative derived overlay-visibility seam, and a
popup-host `DispatchEvent` envelope seam so a leaf control reaches the overlay — PF-002) plus **five
additive core `@jsvision/core` History theme roles**. Every TV-derived pixel (the button icon, popup rect, frame,
list rows, colors) is transcribed from the **GATE-1 decode** captured in [03-01](03-01-history.md)
and re-verified at GATE-2.

## Document Index

| #   | Document                                                | Description                                         |
| --- | ------------------------------------------------------- | --------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)          | Zero-Ambiguity Gate decisions (PA-1…PA-15)          |
| 00  | [Index](00-index.md)                                    | This document — overview and navigation             |
| 01  | [Requirements](01-requirements.md)                      | Feature requirements and scope (from RD-14)         |
| 02  | [Current State](02-current-state.md)                    | The exact code the subsystem builds on / extends    |
| 03-01 | [History + store](03-01-history.md)                   | `History` control + MRU store + **TV GATE-1 decode**|
| 03-02 | [Anchored popup](03-02-anchored-popup.md)            | The shared non-modal anchored-popup primitive       |
| 03-03 | [ComboBox](03-03-combobox.md)                        | `ComboBox<T>` — editable + select-only              |
| 03-04 | [Seams & theme](03-04-seams-and-theme.md)            | Input linkage seam · derived overlay · core roles   |
| 07  | [Testing Strategy](07-testing-strategy.md)              | ST-1…ST-N spec cases traced to AC-1…AC-14           |
| 99  | [Execution Plan](99-execution-plan.md)                  | Phases, sessions, task checklist, GATE-1/2 tasks    |

## Quick Reference

### Usage Examples

```ts
// History — links an app-created Input; drops down that field's past values.
const name = signal('');
const field = new Input({ value: name, maxLength: 32 });
const hist = new History({ link: field, historyId: 1 });      // ▐↓▌ button beside the field

// ComboBox — editable (free text + filter-as-you-type):
const items = signal(['Red', 'Green', 'Blue']);
const sel = signal<string | null>(null);
const text = signal('');
const combo = new ComboBox({ items, getText: (s) => s, value: sel, text });

// ComboBox — select-only picker (type-ahead jump, no free text):
const combo2 = new ComboBox({ items, getText: (s) => s, value: sel, editable: false });
```

### Key Decisions

| Decision                         | Outcome                                                            | AR       |
| -------------------------------- | ----------------------------------------------------------------- | -------- |
| History store bound              | Per-id entry-count cap (default 16), not the byte-block            | PA-2     |
| Down-arrow glyph                 | U+2193 ↓ rendered narrow (faithful CP437 `0x19`)                  | PA-3     |
| Popup geometry                   | Window = field-height + 7 (8 rows), `maxRows` = visible (default 6)| PA-4/PA-7|
| Shared overlay visibility        | Derived from having any visible popup child (menu migrates)        | PA-5     |
| History list order               | Oldest→newest top→bottom (corrects AC-2; C++ oracle)              | PA-6     |
| Input linkage seam               | Public `selectAll()` + `getValueSignal()` + `getMaxLength()`       | PA-8     |
| ComboBox binding                 | `value: Signal<T \| null>` + composed `Input.text: Signal<string>` | PA-14    |

## Related Files

**New:** `packages/ui/src/dropdown/{popup,history,history-store,combo-box,index}.ts` ·
`packages/ui/test/{popup,history,history-store,combobox,dropdown.packaging}.{spec,impl}.test.ts` ·
`packages/examples/dropdowns-demo/` + `kitchen-sink/stories/{history,combobox}.story.ts`.

**Modified (additive):** `packages/core/src/engine/color/theme.ts` (5 History roles) ·
`packages/ui/src/controls/input.ts` (public linkage seam) ·
`packages/ui/src/app/application.ts` + `packages/ui/src/menu/controller.ts` (imperative derived
overlay visibility) · `packages/ui/src/view/types.ts` + `packages/ui/src/event/{event-loop,dispatch}.ts`
(popup-host envelope seam, PF-002) · `packages/ui/src/index.ts` (re-exports) ·
`kitchen-sink/stories/index.ts`.
