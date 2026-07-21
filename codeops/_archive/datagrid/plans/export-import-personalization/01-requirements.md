# Requirements: Export & Layout Variants

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-13](../../requirements/RD-13-export-import-personalization.md) — the OWNING requirements doc

## Scope of this plan (delta view)

This plan implements the **export + layout-variants** slice of RD-13, on **eager sources**.

### In this plan

- **RD-13 Must — Export CSV**: current view (visible columns in display order, `format`ted values,
  filtered + sorted rows) to RFC-4180 CSV. [ST-1…ST-6, ST-20…ST-23]
- **RD-13 Must — Export HTML**: the same view as a standalone HTML document containing a `<table>`.
  [ST-7…ST-9]
- **RD-13 Must — Layout variants**: `saveVariant(name)` → `GridVariant`; `applyVariant(variant)`
  reproduces column order, widths, visibility, freeze, sort, and filter exactly; unknown ids skipped.
  [ST-12…ST-18]
- **RD-13 Should — Export JSON**: array of objects, **raw values keyed by column id**
  ([AR-4](00-ambiguity-register.md)). [ST-10]
- **RD-13 Should — TSV-to-clipboard**: `exportView('tsv')` returns a tab-separated string the caller
  pipes to `setClipboard` ([AR-10](00-ambiguity-register.md)). [ST-11]
- **Enabler — `grid.setFrozen(left, right)`**: runtime freeze mutation (variants need it; freeze is
  construction-only today). [ST-12, ST-19]
- **Security**: CSV/TSV formula-injection escaping + HTML markup escaping ([AR-7](00-ambiguity-register.md),
  [AR-11](00-ambiguity-register.md)). [ST-20…ST-24]
- **Showcase**: a kitchen-sink story + a datagrid-showcase cluster (replaces the RD-13 placeholder).

### Deferred / out of this plan

- **RD-13 Should — Import / paste-append** → follow-up plan. Couples to RD-08 `RowMutations` and
  RD-11's windowed no-op-insert; its `sanitize`+`parse`+`validate` ingress (RD AC-4/6/8) belongs with
  it. ([AR-1](00-ambiguity-register.md))
- **RD-13 Should — Personalization Dialog** → follow-up plan (a whole new UI surface).
  ([AR-1](00-ambiguity-register.md))
- **Windowed-source row export** → post-RD-11 AR. `displayedRows()` is a lazy `Proxy` of the loaded
  window under RD-11, so a full-view export is a different mechanism (drive `ensureRange` or export
  the loaded window with a "(loaded)" label). Variants are unaffected (source-agnostic).
  ([AR-2](00-ambiguity-register.md))
- **RD-13 Should — xlsx** → app-level / optional peer, never in the zero-dep package (RD AR #11).

## Plan-local decisions

Only decisions **not** already fixed by RD-13. (RD-13 owns: WYSIWYG export scope, caller-provided
variant store, CSV formula-injection escaping, RFC-4180, xlsx-app-level — see the RD's Scope Decisions.)

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Eager vs windowed export | Eager now; windowed export → post-RD-11 AR; variants source-agnostic | [AR-2](00-ambiguity-register.md) |
| Freeze in v1 variants | Included — new `setFrozen(left, right)` | [AR-3](00-ambiguity-register.md) |
| JSON value form | Raw `value()` keyed by column id | [AR-4](00-ambiguity-register.md) |
| HTML shape | Standalone minimal document | [AR-5](00-ambiguity-register.md) |
| Columns exported | Visible, display order; excludes hidden + synthetic; all displayed rows | [AR-8](00-ambiguity-register.md) |
| `applyVariant` id mismatch | Unknown skipped; unnamed grid columns kept + appended | [AR-13](00-ambiguity-register.md) |
| Restore order | order→visibility→widths→freeze→sort→filter | [AR-14](00-ambiguity-register.md) |
| Module placement | `export-view.ts` + `variant.ts`; grid.ts thin delegators | [AR-15](00-ambiguity-register.md) |
| Export API shape | `grid.exportView(format)` method | [AR-18](00-ambiguity-register.md) |

## Acceptance Criteria (plan-local)

The RD owns its own acceptance criteria (RD-13 AC-1…AC-8). This plan's slice is done when:

1. [ ] `grid.exportView('csv')` reproduces visible columns in display order with `format`ted values
       and only the filtered + sorted rows; fields with `,`/`"`/newline are RFC-4180 quoted; records
       are CRLF-separated. (RD AC-1)
2. [ ] A formatted value `=SUM(A1)` exports as `'=SUM(A1)` on CSV and TSV; not escaped in JSON.
       (RD AC-2)
3. [ ] `grid.exportView('html')` yields a standalone document whose `<table>` reproduces the view;
       every cell/title is HTML-escaped.
4. [ ] `grid.exportView('json')` yields raw values keyed by column id, filtered+sorted, visible
       columns only.
5. [ ] `grid.exportView('tsv')` yields tab-separated, formula-escaped rows.
6. [ ] `saveVariant('mine')` then `applyVariant` on a grid reproduces the exact column order, widths,
       visibility, freeze, sort, and filter; an unknown `columnId` is skipped without throwing.
       (RD AC-3)
7. [ ] `setFrozen(left, right)` re-pins columns at runtime (over-pin guard still applies).
8. [ ] A kitchen-sink story demonstrates CSV export + a saved variant and passes the smoke test.
       (RD AC-7)
9. [ ] Security verified: formula-injection escaping (AC-2) + HTML escaping. (RD AC-8, export half)
10. [ ] `CI=1 yarn verify` green; no RD-01…12 regression; `grid.ts` a thin delegator under its line
        guard (**< 1550** post-RD-11; re-based to ~1600 with rationale in the three guard tests if the
        four documented methods cross it — PF-004).
