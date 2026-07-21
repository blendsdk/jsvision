# Ambiguity Register — Export & Layout Variants (RD-13)

> **Feature**: datagrid/RD-13 — Export, Import & Personalization (export + layout-variants slice)
> **Gate status**: ✅ GATE PASSED
> **Created**: 2026-07-18
> **CodeOps Skills Version**: 3.9.0

Every semantically-distinct decision for this plan, hunted across the 12 gate categories and grounded
in the real code (`packages/datagrid/src/*` on `feat/editable-data-grid`, post-RD-12). Six forks were
put to the user via `AskUserQuestion` (AR-1…AR-5, AR-18); the rest are grounded defaults — most
inherited from RD-13's own preflighted decisions — the user confirmed as a batch. This plan
implements the **export + variants** slice of RD-13; **CSV import / paste-append** and the
**personalization Dialog** are deferred to a follow-up plan, and **windowed-source row export** (over
an RD-11 source) to a post-RD-11 AR.

## Legend

Status: ✅ Resolved · Source: `user` (explicit AskUserQuestion pick) · `confirmed` (batch-confirmed
grounded default) · `RD` (inherited from RD-13's preflighted scope decisions).

## Decisions

| # | Category | Decision | Options considered | Chosen | Source |
|---|----------|----------|--------------------|--------|--------|
| AR-1 | Scope | How much of RD-13 this plan builds | Must-only / all exports + variants / full RD-13 | **All four exports (CSV/HTML/JSON/TSV) + layout variants.** Deferred to a **follow-up plan:** CSV import / paste-append (couples to RD-08 `RowMutations` + RD-11's windowed no-op-insert) and the personalization `Dialog`. xlsx stays app-level (RD AR #11). | ✅ | user |
| AR-2 | Scope / coupling | Eager vs windowed (RD-11) sources | eager-first / design both now | **Eager sources first.** Export + variants target in-memory/eager sources now; **windowed-source row export** (100k rows not resident — under RD-11 `displayedRows()` is a **fail-loud** lazy view whose whole-array ops **throw**, so `exportView` hard-guards windowed rather than exporting a partial window — PF-001) is deferred to a post-RD-11 AR. Variants are **source-agnostic** (they serialize column/sort/filter state, not rows), so they work on either path. | ✅ | user |
| AR-3 | Variants | Freeze in v1 variants | include (needs new setter) / defer freeze | **Include freeze.** Add a runtime `setFrozen(left, right)` — today `freezeSpec` is a construction-only readonly field (`grid.ts:376,417` post-RD-11) with no setter. Make it a signal and reuse the existing partition-shape-change rebuild (`grid.ts:677`). Honors the RD variant schema (its AC-3 names freeze). | ✅ | user |
| AR-4 | Export contract | JSON export value form | raw values keyed by id / formatted keyed by title | **Raw `value()` keyed by column `id`.** Machine-friendly, lossless. Honors "current view" via right rows/columns/order (filter+sort+visibility); only display formatting is dropped. A deliberate, blessed divergence from RD AR #10's "formatted" — for **JSON only**. CSV/HTML/TSV stay formatted (they are text formats). | ✅ | user |
| AR-5 | Export contract | HTML export shape | standalone document / bare `<table>` fragment | **Standalone minimal HTML document** — `<!doctype html>` + `<meta charset="utf-8">` + the `<table>`. Opens directly in a browser and still pastes into a spreadsheet. Satisfies the RD's "as an HTML `<table>`" (the table is in it). | ✅ | user |
| AR-6 | Export contract | CSV/TSV framing | RFC-4180 / ad-hoc | **RFC-4180.** A field containing the delimiter, `"`, `\r`, or `\n` is double-quoted with embedded `"` doubled; records separated by **CRLF**. TSV uses the same quoting with a **tab** delimiter (Excel tolerates quoted TSV on paste). RD §Technical / AC-1. | ✅ | RD |
| AR-7 | Security | CSV/TSV formula-injection escaping | escape / ignore | **Escape on CSV + TSV only.** A field whose formatted value begins with `=`, `+`, `-`, `@`, `\t`, or `\r` is prefixed with `'` **before** quoting. Applies to header titles and data cells. **Consequence (documented):** a legitimate negative number (`-5`) formats to `'-5` — the accepted OWASP CSV-injection tradeoff for the RD's escape set. HTML uses markup-escaping (AR-11), not formula-escaping; JSON is unaffected. RD AR #26 / AC-2. | ✅ | RD |
| AR-8 | Export scope | Which columns export | visible-in-display-order / all / selection | **Visible columns in effective display order** (`[...left, ...center, ...right]`, from `grid.columnOrder()`). Excludes **hidden** columns and the **synthetic** checkbox / row-number columns (UI affordances, not data — they are not in `columnOrder()`). Export covers **all displayed rows** (`displayedRows()` — filtered+sorted), not selection-scoped. RD AC-1 + grounded. | ✅ | confirmed |
| AR-9 | Export contract | CSV/HTML/TSV value + header | formatted / raw | Cell text = the column's `format(value(row), row)` (or `String(value)` when no `format` — `column.ts:39`); the header row = the column **`title`**. RD AR #10 (WYSIWYG). | ✅ | RD |
| AR-10 | Boundary | Output destination + TSV clipboard | grid returns a string / grid writes clipboard | `grid.exportView(format)` **returns a string**; the grid never chooses a destination. TSV-to-clipboard: the datagrid returns the TSV string and the **showcase/app** wires it to `@jsvision/web`'s `setClipboard` (`packages/web/src/clipboard.ts`) — the datagrid **cannot depend on `@jsvision/web`** (sibling layer; both sit on `ui`). RD AR #10. | ✅ | RD |
| AR-11 | Security | HTML export escaping | escape `& < > "` / raw | Every cell and title is HTML-escaped (`&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`, `"`→`&quot;`) so exported data can never inject markup. Sanitized like every rendered cell. Security-first. | ✅ | confirmed |
| AR-12 | Variants | `saveVariant` persistence | grid returns object / grid owns a registry | `saveVariant(name)` **returns a `GridVariant`** object; the caller-provided store persists it. The grid holds **no** variant registry — it stays stateless re: persistence. RD AR #10 + schema. | ✅ | RD |
| AR-13 | Variants | `applyVariant` id mismatches | skip unknown; keep unnamed / throw / reset | **Unknown `columnId`s are skipped, not thrown** (RD AC-3). Grid columns **absent from the variant** keep their current width/visibility and are **appended after** the variant-named columns in the restored order (the variant is authoritative only for the columns it names). | ✅ | confirmed |
| AR-14 | Variants | `applyVariant` restore order | order→visibility→widths→freeze→sort→filter | Restore in that fixed sequence. The **full** order (including hidden) is restored via the grid's private `columnOrderSig`, not the public `setColumnOrder` (which accepts only a **visible** permutation — `grid.ts:967-977`); this is a load-bearing reason variants are **grid methods**, not free functions. | ✅ | confirmed |
| AR-15 | Structure | Module placement | new modules + thin grid delegators / inline in grid.ts | New `export-view.ts` (pure serializer) + `variant.ts` (`GridVariant` type + pure build/resolve). `grid.ts` holds only thin method delegators (`exportView`/`saveVariant`/`applyVariant`/`setFrozen`). Line guard **re-verified post-RD-11 (PF-004): grid.ts is at 1520 against a < 1550 guard** (RD-11 re-based from < 1500); the four documented methods will likely cross it → re-base to ~1600 with rationale in the three guard tests, the RD-08…12 discipline. | ✅ | confirmed |
| AR-16 | Public surface | Barrel additions | types + methods / free functions | `index.ts` adds the **`ExportFormat`** type and the **`GridVariant`** (+ `GridVariantColumn`) types. The operations are **methods** on the already-exported `EditableDataGrid`. Every new public export carries an `@example` (`check:docs`). | ✅ | confirmed |
| AR-17 | Tooling | Verify command | — | `CI=1 yarn verify` (the `CI` flag skips the informational perf bench, per the datagrid plan convention) fills every Verify line. | ✅ | confirmed |
| AR-18 | Public surface | Export API shape | `grid.exportView(format)` method / `exportView(grid, format)` free fn | **`grid.exportView(format)` method.** `columnMap` is **private** (`grid.ts:392`) with no public column-metadata accessor, so the RD's literal free-function `exportView(grid, format)` would require widening the public surface. A method is symmetric with `saveVariant`/`applyVariant`/`setFrozen`, needs no new accessor, and keeps the pure serializer in `export-view.ts`. A grounded divergence from the RD's written signature. | ✅ | user |
| AR-19 | Security (runtime) | CSV/TSV field pipeline order: `sanitize` vs formula-escape | sanitize→escape→quote / escape→sanitize→quote | **`sanitize` FIRST, then formula-escape, then RFC-4180 quote** — exactly the pipeline `03-01` writes. Found at execution: the two orderings are NOT security-equivalent, and the plan was internally inconsistent (the `03-01` pipeline sanitizes first, but core's `sanitize` strips `\r`, while ST-20 listed a **leading bare `\r`** as a case to prefix — unreachable under sanitize-first). **escape-first is insecure**: a control-byte-masked value (`\x1b=cmd`) escapes no prefix, then sanitize strips the ESC leaving a **live formula** — a CSV-injection bypass. **sanitize-first closes it**: `\x1b=cmd`→`=cmd`→`'=cmd`, and a CR-masked formula `\r=SUM`→`=SUM`→`'=SUM` stays defused; the only unprefixed leading-`\r` case is a bare CR followed by a non-formula char, which (CR stripped) poses no formula risk. Security is non-negotiable, so sanitize-first wins. Consequence: ST-20's `\r` sub-case was strengthened from a bare `\rCR` (a non-threat) to a CR-masked formula `\r=SUM` (the real threat), which sanitize-first correctly defuses — a stronger oracle, still derived from AR-7's formula-injection intent. | ✅ | runtime |

## Notes

- **Same-session authoring:** this plan was authored in the session that (later) preflights it. A
  fresh-session preflight is recommended for review independence, and — per AR-2 — a **preflight
  refresh at the execution gate** is planned, because RD-11 will have mutated `data-source.ts` /
  `grid.ts` between planning and execution (the user is delaying execution until RD-11 lands).
- **RD ARs inherited:** RD-13's own Scope Decisions (RD AR #10 WYSIWYG-export + caller-store, #11
  xlsx-app-level, #26 CSV formula-injection) are honoured by AR-1/4/7/10/12 here.
- **Deferred (explicit follow-ups):** CSV import / paste-append (RD Should-have; AR-1) · personalization
  `Dialog` (RD Should-have; AR-1) · windowed-source row export (AR-2) · xlsx (RD AR #11).
