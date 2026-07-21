# Showcase, Barrel & Security: Export & Layout Variants

> **Document**: 03-03-showcase-barrel-and-security.md
> **Parent**: [Index](00-index.md)

## Overview

The user-facing surface: the barrel exports, the mandatory kitchen-sink story, the datagrid-showcase
cluster that replaces the RD-13 placeholder, and the security oracle for the export ingress/egress.

## Barrel exports ([AR-16](00-ambiguity-register.md))

`packages/datagrid/src/index.ts` adds **types only** — the operations are methods on the
already-exported `EditableDataGrid`:

```ts
// Export — the current-view serializer surface.
export type { ExportFormat } from './export-view.js';
// Layout variants — a serializable column-layout snapshot the caller persists.
export type { GridVariant, GridVariantColumn } from './variant.js';
```

Each new public type carries a JSDoc lead sentence + an `@example`. The four new `EditableDataGrid`
methods (`exportView`, `saveVariant`, `applyVariant`, `setFrozen`) each carry purpose + params/returns
+ a copy-pasteable `@example`, and document their gotchas in plain language: `exportView` serializes
the **resident displayed rows** on an eager source and **throws on a windowed source** (windowed export
is a follow-up — PF-001); the formula-escape's negative-number tradeoff; `applyVariant` skips unknown
ids; `setFrozen` may be tempered by the over-pin guard. **No** `codeops/`/`RD-`/plan-id references in
shipped code (`check-jsdoc`). (`check:docs` enforces an `@example` on the exported class/functions;
the per-method examples are our own discipline.)

## Kitchen-sink story (NON-NEGOTIABLE gate)

One story `packages/datagrid/test/kitchen-sink/stories/datagrid-export.story.ts` exporting a `Story`
(`{ id, category: 'DataGrid', title, blurb, build(ctx) }`) + one line in
`packages/datagrid/test/kitchen-sink/stories/index.ts`. This is the **datagrid-local** kitchen-sink
registry — where every per-RD datagrid story lives (foundation … `data-at-scale.story.ts`), gated by
`packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` (which reads `./kitchen-sink/stories/index.js`).
**Do not** target `packages/examples/kitchen-sink/stories/` — that is a different registry gated by a
different smoke test, and would split the RD-13 story off from the per-RD series (this is exactly the
mistake RD-11's own preflight caught and retargeted). The story mounts a small `EditableDataGrid` and
shows: a live **CSV export** readout (a text pane echoing `exportView('csv')` of the current view) and
a **save/apply variant** round-trip (hide a column + sort, `saveVariant`, reset, `applyVariant` — the
layout returns). Must pass `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` (ST-25 — mounts
headlessly, paints, unique id, required metadata).

## Showcase cluster

Replace the RD-13 placeholder (`packages/examples/datagrid-showcase/stories/placeholders.ts:41-45`,
removed from the `placeholders` array — leaving only the RD-14 entry) with a live cluster
`packages/examples/datagrid-showcase/stories/export-personalization/` + its `index.ts` registration,
following the existing per-RD cluster pattern (e.g. `footer-master-detail/`, `navigation-interaction/`,
`data-at-scale/`):

> **🚨 Paired smoke-oracle update (PF-002).** Removing the RD-13 placeholder drops the Roadmap band from
> 2 to 1, so `packages/examples/test/datagrid-showcase.smoke.spec.test.ts` **must** be updated in the
> same step or verify goes red: **ST-6** `expect(roadmap.length).toBe(2)` → `toBe(1)` (blocking — only
> RD-14 remains); and, for coverage parity with every prior cluster, add the new category to **ST-5**'s
> category list and its demo count to **ST-7** (these two do not hard-fail, but match the RD-11 precedent).
> The file's own comments license this ("a future RD adding a cluster updates this list").

- **Export demo** — a grid with a format selector (CSV/HTML/JSON/TSV) and a live output pane; a
  "copy TSV" affordance that calls `@jsvision/web`'s `setClipboard` (the showcase is in `examples`,
  which *may* depend on web — the datagrid never does, [AR-10](00-ambiguity-register.md)).
- **Variants demo** — a couple of preset variants (`saveVariant`/`applyVariant`) plus live `setFrozen`
  toggles, with a visible state echo of the active layout.

## Security oracle ([AR-7](00-ambiguity-register.md), [AR-11](00-ambiguity-register.md))

Add to `packages/datagrid/test/security.spec.test.ts` (the immutable oracle):

- **CSV/TSV formula injection** — a cell formatting to `=SUM(A1)`, `+1`, `-1`, `@x`, a leading tab/CR is
  prefixed with `'` in CSV **and** TSV output; a benign leading char is untouched. (ST-20, ST-21)
- **HTML markup injection** — a cell `<script>x</script>` / `a & b` / `"q"` is HTML-escaped in the
  `<table>` output. (ST-22)
- **Control-byte sanitization** — a cell containing control bytes is `sanitize`d before serialization
  in every format. (ST-23)
- **JSON not over-escaped** — `=SUM(A1)` appears **raw** in JSON (formula-escaping is a spreadsheet
  concern, not a JSON one); `JSON.parse` round-trips. (ST-24)

> **Note.** Import's `sanitize`+`parse`+`validate` ingress (RD AC-4/6/8) is deferred with import
> ([AR-1](00-ambiguity-register.md)); this plan's security scope is the **export** half of RD AC-8.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Story mounts on a non-TTY CI | Headless smoke mount (existing harness) — no TTY needed | [AR-17](00-ambiguity-register.md) |
| `setClipboard` unavailable (headless) | Showcase-only; guarded by `navigator.clipboard` presence (`packages/web/src/clipboard.ts:20`) | [AR-10](00-ambiguity-register.md) |

> **Traceability:** see `00-ambiguity-register.md`.

## Testing Requirements
- Smoke: the new kitchen-sink story passes `kitchen-sink.smoke.spec.test.ts` (ST-25).
- Security: `security.spec.test.ts` ST-20…ST-24.
- Showcase: covered by the datagrid-showcase headless walkthrough (existing harness).
