# Stories & Role-Count Strings

> **Document**: 03-03-stories-and-counts.md
> **Parent**: [Index](00-index.md)
> **Owns**: the kitchen-sink demos for the two primitives and the stale "63"→"67" corrections.

## Overview

The kitchen-sink showcase is a NON-NEGOTIABLE gate: every user-facing capability ships a live story
that passes the headless smoke test. This RD adds a visible placeholder and severity-coloured text.
Separately, the user-visible "63 roles" copy is already stale (true count 65) and must become 67 when
the two roles land — corrected everywhere and mechanically guarded (07).

## Stories (kitchen-sink)

Story contract: `Story = { id, category, title, blurb, rd?, build(ctx) }` (`stories/story.ts:37-56`);
`build` returns a `Group` of absolutely-positioned children within `ctx.width × ctx.height`; the shell
owns all chrome. Smoke test requires truthy `id`/`category`/`title`/`blurb`, unique id, ≥1 painted
non-blank cell (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`).

### Placeholder demo — extend `input.story.ts` (id `controls/input`)
Add an `Input` with `placeholder: 'e.g. Ada Lovelace'` over an empty bound signal, with a one-line
hint, so the muted placeholder is visible on load and disappears as you type. Reuse the existing story
scaffold; no new registration.

> **Smoke-assertion note (ST-S1):** on a **focused** empty field the caret draws last and reverses
> column 1 (the placeholder is not in the value, so `glyphAt` returns a space there — `input-render.ts:98-104`),
> so the first placeholder glyph is covered. Keep this demo field **unfocused**, or have ST-S1 assert a
> substring from column 2, so an auto-focused headless mount doesn't blank the leading glyph and break
> the assertion.

### Severity demo — extend `theming.story.ts` (id `theming/presets`) *or* add a sibling
Show a `Text('… error …', { severity: 'error' })` (danger-red) and a
`Text('… advisory …', { severity: 'warning' })` (amber) side by side, so both roles render live and
hot-swap with the theme. Preferred: fold into `theming/presets` (it already demos the theme system) to
avoid a new registration; if it crowds the layout, add one `Story` under `Controls`/`Theming` + one
line in `stories/index.ts` (then the smoke test picks it up automatically).

> **Decision (AR-P6):** the placeholder demo extends `input.story`; the severity demo extends
> `theming.story` unless layout forces a sibling. Either way, both pass the existing smoke test — no
> new metadata assertions are required.

## Role-count string corrections ("63" → "67")

**Reconciliation (see 02 §Gap 3):** the strings say **63**; `Object.keys(defaultTheme).length` is
**65** today; the post-RD target is **67**. Correct every occurrence to **67** (all are prose/comments;
no runtime assertion pins the literal). The `length === 67` guard added in 07 makes the number
self-checking from now on.

| File:line | Current | → |
| --------- | ------- | - |
| `core/src/engine/color/aliases.ts:3` | "…below the 63 concrete UI roles." | 67 |
| `core/src/engine/color/aliases.ts:9` | "…never hand-write 63 roles." | 67 |
| `core/src/engine/color/aliases.ts:18` | "…every one of the 63 UI roles…" | 67 |
| `core/src/engine/color/index.ts:35` | "seeds → 18 aliases → 63 roles." | 67 |
| `theme-designer/src/view/roles-panel.ts:2` | "…the 63 concrete roles." | 67 |
| `theme-designer/src/view/roles-panel.ts:38` | "(18 aliases, then 63 roles)." | 67 |
| `theme-designer/src/model/types.ts:7` | "an opaque 63-role theme…" | 67 |
| `theme-designer/src/model/types.ts:32` | "…one of the 63 concrete roles." | 67 |
| `examples/kitchen-sink/stories/theming.story.ts:70` | blurb "…18 aliases → 63 roles…" | 67 |
| `examples/kitchen-sink/stories/theming.story.ts:97` | on-screen `Text` "…18 aliases → 63 roles…" | 67 |

The `create-theme.ts:31,33` doc-comment correction (alias "drives no built-in role") is owned by
03-01/AR-P4; the matching `aliases.ts:65,67` alias-doc phrasing (the same "drives no built-in role"
claim on the `danger`/`warning` alias fields) is corrected in the same pass as the count strings above.

> **Scope note:** core doc-comments were "optional cleanup" in the RD, but since the same lines carry
> the "63" count, correcting them here is free and keeps the copy honest. No behaviour change.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A "63" left uncorrected | The `length === 67` guard (07) fails if the real count drifts; a text grep in the execution task catches the prose | RD Should-Have |
| Severity story crowds the theming layout | Split into a sibling `Story` + one `index.ts` line | Kitchen-sink gate |

> **Traceability:** RD-09 §Should-Have + AC #8; AR-P6. Kitchen-sink gate per `CLAUDE.md`.

## Testing Requirements
- Both demos pass `kitchen-sink.smoke.spec.test.ts` (mount + paint) — 07 ST-S1.
- The `length === 67` guard lives in the 03-01 own-guard spec — 07 ST-C2.
