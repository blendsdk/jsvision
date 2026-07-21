# Testing Strategy: Export & Layout Variants

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Pure serializer / variant logic (`export-view.ts`, `variant.ts`) | 90% |
| Grid method delegators + `setFrozen` wiring (`grid.ts`) | 80% |
| Showcase / story glue | 60% (smoke) |

- Test names state behavior: `should [expected] when [condition]`.
- Datagrid tests live in `packages/datagrid/test/` — `*.spec.test.ts` (immutable oracle) +
  `*.impl.test.ts` (internals/edges). The pure modules are directly unit-testable from plain inputs
  (no TTY, no signals), matching `sort.spec.test.ts` / `aggregate.spec.test.ts`.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from `01-requirements.md`, the `03-*` specs, RD-13, and `00-ambiguity-register.md`. Immutable
> oracle: if the implementation disagrees, the implementation is wrong. The in-code traceability comment
> quotes the behavior in **plain language** — never an `ST-`/`AR-`/`RD-` id or a `codeops/` path.

### Exporter — CSV / HTML / JSON / TSV (`export-view.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | 2 cols (title "ID"/"Name"), rows `[{1,Ann},{2,Bob}]`, `exportView('csv')` | `"ID,Name\r\n1,Ann\r\n2,Bob"` — title header, formatted cells, CRLF records, no trailing CRLF | RD AC-1 / AR-6,9 |
| ST-2 | A cell value `Ann, Bob`, CSV | field quoted: `"Ann, Bob"` | RD AC-1 / AR-6 |
| ST-3 | A cell value `she said "hi"`, CSV | quoted + doubled: `"she said ""hi"""` | AR-6 |
| ST-4 | A cell value `a\nb`, CSV | quoted: `"a\nb"` | AR-6 |
| ST-5 | Numeric column with `format: (n) => '$'+n`, value 1000, CSV | cell is `$1000` (format applied, not raw) | AR-9 |
| ST-6 | Grid filtered to 1 row, sorted desc, one column hidden + reordered; `exportView('csv')` | only visible cols in display order, header reordered, only the filtered+sorted row | AR-8 |
| ST-7 | Any grid, `exportView('html')` | starts `<!doctype html>`, contains `<meta charset="utf-8">`, one `<table>` with `<thead>` titles + `<tbody>` rows | AR-5 |
| ST-8 | Cell `a & b`, title `X"Y`, HTML | `a &amp; b` / `X&quot;Y` (HTML-escaped) | AR-11 |
| ST-9 | Filtered+sorted grid, `exportView('html')` | `<tbody>` has only the filtered rows, in sort order | AR-8 |
| ST-10 | rows `[{id:1,name:'Ann'}]`, `exportView('json')` then `JSON.parse` | `[{ id: 1, name: 'Ann' }]` — raw values (number `1`, not `"1"`), keyed by column **id**, visible cols only | AR-4 |
| ST-11 | 2 cols, 1 row, `exportView('tsv')` | `"ID\tName\r\n1\tAnn"` — tab delimiter, CRLF records | AR-6,10 |
| ST-26 | A grid over a **windowed** source (one exposing `ensureRange`); `exportView('csv')` (any format) | **throws** a clear "unsupported on a windowed source" error — never the generic proxy `.map`/`.length` error, and never a partial/garbled export | AR-2 / PF-001 |

### Variants & Freeze (`variant.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-12 | Hide `note`, `setFrozen(['id'],[])`, `sortBy('total','desc')`, filter `dept`; `saveVariant('x')` → new grid `applyVariant` | `columnOrder`/`frozen`/`sort`/`filterModel`/hidden all reproduced | RD AC-3 / AR-12,14 |
| ST-13 | `buildVariant('x', snap)` with a hidden col + one width override | `columns[]` = full order incl hidden, correct `visible` flags, `width` only where overridden; `freeze`/`sort`/`filter` copied | AR-12 |
| ST-14 | `resolveVariant` for a variant naming `legacy` (not a current id) | `legacy` dropped from the resolved layout; no throw | RD AC-3 / AR-13 |
| ST-15 | Grid has column `extra` absent from the variant | `extra` appended after named columns, keeps current visibility/width | AR-13 |
| ST-16 | A variant whose width targets a column also reordered + hidden | resolve yields one deterministic final layout regardless of field order | AR-14 |
| ST-17 | Variant hides `dept` but carries a filter on `dept`; `applyVariant` | `filterModel()` retains the `dept` filter; showing `dept` reveals it filtered | AR-13 |
| ST-18 | Variant with `width:25` on `name`; reset widths then `applyVariant` | `columnWidth('name') === 25` (clamped to min/max) | AR-14 |
| ST-19 | `setFrozen(['id'],['actions'])`; then `setFrozen([],[])`; then over-pin (frozen ≥ viewport) | `frozen()` reflects each set; unknown id ignored; over-pin guard peels innermost + one `devWarn` | AR-3 |

### Security oracle (`security.spec.test.ts` additions)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-20 | Cells formatting to `=SUM(A1)`, `+1`, `-1`, `@x`, leading `\t`, leading `\r`; CSV | each prefixed with `'`; a benign leading char untouched | RD AC-2 / AR-7 |
| ST-21 | Same set, `exportView('tsv')` | each formula-prefixed in TSV too | AR-7 |
| ST-22 | Cell `<script>x</script>`, HTML | `&lt;script&gt;x&lt;/script&gt;` (no live markup) | AR-11 |
| ST-23 | Cell with control bytes (e.g. ``), each format | control bytes `sanitize`d before serialization | AR-7,11 |
| ST-24 | Cell `=SUM(A1)`, `exportView('json')` then `JSON.parse` | value is the **raw** `=SUM(A1)` (not `'`-prefixed); round-trips | AR-4 |

### Kitchen-sink smoke (`kitchen-sink.smoke.spec.test.ts`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-25 | Mount the `datagrid-export` story headlessly | paints non-empty; unique id; required metadata present | kitchen-sink gate |

> **⚠️ AUTHORING RULE:** expectations derive from the specs above, not from imagined implementation
> output. Anything underivable is an ambiguity → register it, resolve with the user, then define the case.

## Test Categories

### Specification Tests (from ST-cases)
> Written BEFORE implementation. `*.spec.test.ts`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `export-view.spec.test.ts` | ST-1…ST-11, ST-26 | Exporter (incl. windowed-throw guard) |
| `variant.spec.test.ts` | ST-12…ST-19 | Variants & freeze |
| `security.spec.test.ts` (additions) | ST-20…ST-24 | Security oracle |
| `kitchen-sink.smoke.spec.test.ts` | ST-25 | Story |

### Implementation Tests (edges, internals)
> Written AFTER implementation. `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `export-view.impl.test.ts` | `format`-throws → `String(value)` fallback; zero-rows header-only / `[]`; a cell that needs both formula-escape **and** quoting; empty column set | High |
| `variant.impl.test.ts` | `resolveVariant` with all-unknown ids; duplicate ids in a variant; a variant with an empty `columns[]`; width clamp at min/max; push-down `setSort`/`setFilter` fired on restore when the source implements them | High |
| `grid.impl.test.ts` (additions) | `freezeSpec`→signal does not regress construction-time freeze | Med |
| line guard (PF-004) | grid.ts 1520 / `< 1550`; the guard is in `grid-selection.impl.test.ts:190` + `grid-footer.impl.test.ts:78` + `navigation.impl.test.ts:144` (NOT `grid.impl.test.ts`). Re-base all three to ~1600 with rationale if the four documented methods cross it | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| export-reflects-view | grid + exporter | filter → sort → hide → reorder, then each format mirrors the live view |
| variant-round-trip | grid + variant | save on grid A, apply on grid B (same columns) → identical layout |

## Test Data
### Fixtures Needed
- A small typed row set (id:number, name:string, dept:string(enum), total:number) with `format`ters —
  reuse the existing datagrid test column fixtures where present.
### Mock Requirements
- None. Pure functions take plain inputs; grid tests use a real `EditableDataGrid` over `fromRows`
  (real objects, per the standards). Clipboard is showcase-only, not unit-tested here.

## Verification Checklist
- [ ] All ST-1…ST-26 defined with concrete input/output pairs (ST-26 = windowed-throw guard, PF-001)
- [ ] Every ST traces to a requirement / spec / AR
- [ ] Spec tests written and RED before implementation
- [ ] All spec tests GREEN after implementation
- [ ] Impl tests cover the edges above
- [ ] No regression in RD-01…12 suites (freeze-signal change, barrel additions)
- [ ] `check:docs` green (new public types/methods have `@example`, no plan-id refs)
- [ ] `CI=1 yarn verify` green
