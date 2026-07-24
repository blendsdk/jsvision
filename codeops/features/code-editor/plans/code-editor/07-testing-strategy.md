# Testing Strategy: Code Editor

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

| Code type | Target |
|-----------|--------|
| Document, validation, scheduling, protocol, sanitation | 95% branches |
| Language, theme, projection, controllers | 90% branches |
| UI composition, examples, packaging glue | 80% branches |

Tests use real document, parser, controller, theme, and rendering objects. Only the true external
boundaries—clock/scheduler, process transport, host effects, and LSP peer—use deterministic
fixtures. Each implementation phase follows specification tests → observed red → implementation →
green → implementation tests → `yarn verify` (AR-P17, AR-P18).

## 🚨 Specification Test Cases

> These expectations come only from the approved RDs and governing component specifications.
> They are immutable oracles: implementation failures are fixed in production code, not by changing
> these expected behaviors.

### Architecture, package, and probes

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-01 | Import root, each language subpath, and `/node` in clean Node 22 processes without DOM globals | Imports succeed; optional modules do not initialize unrelated parsers/processes | 01 plan-local AC 2; 03-01 §Dependency gates |
| ST-02 | Run 1 MiB and 50,000-line reference edits plus viewport render | Report p50/p95/count/runtime/environment; p95 is at most 16 ms | RD-04 AC1 |
| ST-03 | Exercise worst-case incremental parser calls and floods | Interactive work wins; slices yield; cancellation prevents stale presentation | RD-04 AC2; 03-03 §Parser integration |
| ST-04 | Inspect dependency/license closure | No DOM/browser/IDE runtime or incompatible license is shipped | RD-04 AC10–11 |

### Document engine and lifecycle

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-05 | Apply valid single and multi-edit transactions | Text changes atomically; revision and undo depth each increase once | RD-01 AC9; 03-02 §Core types |
| ST-06 | Undo and redo completion/snippet/format transactions | Exact prior/following text and selection are restored | RD-01 AC9 |
| ST-07 | Supply negative, non-finite, reversed, overlapping, stale, foreign-lineage, or oversized edits | Entire transaction is rejected without text/revision/history change | RD-01 AC12; RD-04 AC4 |
| ST-08 | Replace an active document while async work exists | New lineage/history starts; old work cannot mutate any state | RD-01 AC4 |
| ST-09 | Attempt every edit path in read-only mode | Text/revision/history stay unchanged; non-mutating operations remain available | RD-01 AC8 |
| ST-10 | Convert offsets, LSP positions, grapheme cells, tabs, combining and wide text | All round trips and visual columns match specified UTF-16/cell semantics | RD-02 AC13 |
| ST-11 | Load documents across all three size tiers | Required features/degradation/confirmation follow tier policy without text loss | RD-04 AC3–4 |

### Local language features

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-12 | Select by explicit ID and launch-language filename extensions | Plain, JavaScript, TypeScript, and PostgreSQL adapters resolve deterministically | RD-02 AC1 |
| ST-13 | Switch JavaScript to TypeScript on unchanged text | Parser state rebuilds while text/revision/selection/scroll/history remain unchanged | RD-02 AC2 |
| ST-14 | Parse valid, incomplete, invalid, Unicode, and hostile fixtures | Parser recovers; validated viewport syntax categories render without DOM | RD-02 AC3, AC14 |
| ST-15 | Apply incremental edits then compare with a clean parse | Resulting categories/folds/brackets are equivalent for the current revision | RD-02 FR-2.3; 03-03 §Parser integration |
| ST-16 | Parser throws, loops, returns invalid range, or exceeds budget | Local service degrades/suspends visibly; plain editing remains available | RD-02 AC5; RD-04 AC6 |
| ST-17 | Exercise gutters, folds, brackets, indent/outdent/newline/comments | Commands and presentation match active adapter and never corrupt text | RD-02 AC6–AC11 |
| ST-18 | Render bidi, zero-width, C0/C1, CSI, and OSC source | Model preserves code units; output contains no active untrusted control | RD-02 AC12; RD-04 AC5 |

### LSP intelligence

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-19 | Two editors share interleaved fake-session traffic | Only matching URI/request/session/lineage/revision affects each editor | RD-03 AC1 |
| ST-20 | Open/change/close/reconnect/language/URI sequences | Notifications are ordered and requests wait for resynchronization | RD-03 AC2 |
| ST-21 | Deliver responses after edit/cancel/close/switch/reconnect | No stale response changes document or presentation state | RD-03 AC3 |
| ST-22 | Invoke/filter/navigate/accept/dismiss completion | Bounded keyboard interaction follows precedence without trapping focus | RD-03 AC4 |
| ST-23 | Accept primary/additional edits plus numbered snippet | One undo unit applies; placeholders traverse/exit safely; no construct executes | RD-03 AC5 |
| ST-24 | Show hostile plaintext/Markdown hover and signature in narrow viewport | Safe subset renders clipped; HTML/resources inactive; active parameter is non-color-only | RD-03 AC6 |
| ST-25 | Publish stale/current/overlapping/excess diagnostics | Version policy, precedence, counts, truncation, sanitation, and clearing hold | RD-03 AC7 |
| ST-26 | Navigate one/many same- and cross-document targets and symbols | Local targets reveal; many use chooser; foreign targets emit host effects only | RD-03 AC8 |
| ST-27 | Format valid, invalid, stale, oversized, overlapping, foreign, and read-only edits | Only valid current edits apply atomically; every other case leaves text unchanged | RD-03 AC9 |
| ST-28 | Save with format-on-save off/on across success, timeout, failure, stale response | Default is off; valid result is saved; otherwise current unformatted text remains saveable | RD-03 AC10 |
| ST-29 | Propose cross-document edits and LSP commands | No mutation/execution occurs without host transaction/allowlist authorization | RD-03 AC11, AC13 |
| ST-30 | Fuzz envelopes, URIs, ranges, snippets, Markdown, sizes, nesting, and controls | Input is rejected/bounded/sanitized with no active terminal control or content leak | RD-03 AC12 |
| ST-31 | Remove/fail/reconnect session and exceed interactive timeout | Local editing/features/save/close remain; pending/degraded/recovery state is accurate | RD-03 AC15–AC16 |

### Terminal UI and theme

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-32 | Mount component directly and in `CodeEditorWindow` | Same configured document behavior; window adds scroll/status composition | RD-01 AC1 |
| ST-33 | Route keys through completion, snippet, editor, and text contexts | Approved precedence is deterministic and bindings remain replaceable | RD-01 FR-1.4 |
| ST-34 | Render overlapping selection/diagnostic/snippet/bracket/search/syntax roles | Complete RD-06 precedence is deterministic and caret remains visible | RD-06 AC6 |
| ST-35 | Switch app-derived, override, independent, light/dark/classic themes | Only cells change; document, history, selection, folds, parser and LSP counts do not | RD-06 AC1–AC8, AC12 |
| ST-36 | Resolve malformed/deep/getter/prototype/low-contrast theme input | Unsafe input is rejected/bounded; deterministic fallbacks and adjustments are inspectable | RD-06 AC5, AC9–AC11 |
| ST-37 | Render monochrome, ASCII, narrow, resized, tabs, combining and wide graphemes | Required actions remain and overlays/caret stay inside viewport | RD-04 AC8 |
| ST-38 | Complete keyboard-only edit/search/fold/assist/navigate/format/save/close journey | No mouse or trapped focus is required | RD-04 AC7 |

### Showcase and release

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-39 | Compare standalone scenario registry with required facet manifest | Every RD-05 version-one facet has a deterministic interactive scenario | RD-05 AC1–AC12 |
| ST-40 | Start, interact with, resize, and exit standalone demo | Public imports work and process exits cleanly without production services | RD-05 AC13 |
| ST-41 | Start repository kitchen-sink and select CodeEditor story | Story is registered, concise, operable, and smoke-safe | RD-05 AC14 |
| ST-42 | Pack/import package and build docs/plugin references | Public exports/docs/catalog are complete and all repository gates pass | RD-04 AC9–AC12; 03-06 §Release integration |

## Test Categories

### Specification tests

| Test file | ST cases |
|-----------|----------|
| `packages/code-editor/test/code-editor-architecture.spec.test.ts` | ST-01–ST-04 |
| `packages/code-editor/src/document/document.spec.test.ts` | ST-05–ST-11 |
| `packages/code-editor/src/languages/languages.spec.test.ts` | ST-12–ST-18 |
| `packages/code-editor/src/lsp/lsp.spec.test.ts` | ST-19–ST-31 |
| `packages/code-editor/src/ui/code-editor.spec.test.ts` | ST-32–ST-38 |
| `packages/examples/code-editor-demo/code-editor-demo.spec.test.ts` | ST-39–ST-42 |

### Implementation tests

| Test file family | Coverage |
|------------------|----------|
| `document/*.impl.test.ts` | storage, mapping, history, search, limits, property models |
| `languages/*.impl.test.ts` | fragments, scheduling, mappings, language edge cases |
| `lsp/*.impl.test.ts` | lifecycle, DTO validators, races, bounds, safe Markdown/snippets |
| `ui/*.impl.test.ts` | command routing, projection, frames, theme, focus, capability fallbacks |
| `node/*.impl.test.ts` | inert process, JSON-RPC, shutdown, output limits |
| examples/package/plugin tests | registry, E2E, public imports, generated-content drift |

### Integration, E2E, performance, and fuzz

| Suite | Description |
|-------|-------------|
| Document + language + projection | Real incremental parsing through terminal frames |
| Document + shared session + UI | Deterministic request/race/assistance workflows |
| Terminal serialization corpus | All untrusted sources through final renderer |
| Reference benchmark | Tier fixtures, floods, p50/p95 and peak retained memory |
| Standalone E2E | Spawn, render, keyboard scenarios, resize, clean shutdown |

## Test data

Fixtures include valid/incomplete/invalid launch-language sources, Unicode grapheme/width cases,
terminal controls and bidi/zero-width characters, tiered generated documents, hostile protocol and
Markdown corpora, deterministic schema names (never rows/credentials), and an inert JSON-RPC
fixture process.

## Verification checklist

- [ ] Every ST case has a pre-implementation `.spec.test.ts`.
- [ ] Each specification suite is observed red before implementation and green afterward.
- [ ] Implementation/property/fuzz/race/benchmark/E2E suites pass.
- [ ] Existing `Editor` behavior and public API remain unchanged.
- [ ] Dependency, license, package, docs, plugin, and terminal-only gates pass.
- [ ] Full `yarn verify` passes with no waived failure.
