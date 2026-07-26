# RD-04: Quality, Security, and Operability

> **Document**: RD-04-quality-security-and-operability.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: JSVision Code Editor
> **Depends On**: RD-01, RD-02, RD-03
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The code editor is an interactive terminal component that processes hostile source text and
asynchronous third-party language data. Its usefulness depends on predictable input latency,
bounded resource consumption, safe terminal output, keyboard accessibility, graceful presentation
across terminal capabilities, and compatibility with the existing JSVision package.

This requirement defines observable quality and release constraints. It intentionally does not
choose a parser library, text-storage algorithm, rendering architecture, or LSP client
implementation; those decisions require evidence during planning. (AR-01, AR-04, AR-07, AR-08,
AR-09, AR-11, AR-13)

---

## Non-Functional Requirements

### Must Have

#### NFR-4.1 — Input and rendering responsiveness *(Complexity: XL; AR-07, AR-09)*

- [ ] For documents up to 1 MiB or 50,000 logical lines, an uncontended edit plus the render work
      required to display it must complete within a 16-millisecond p95 frame budget in the committed
      reference benchmark environment.
- [ ] Keyboard input, caret movement, selection, scrolling, and dismissal commands take priority
      over parsing, diagnostics, completion updates, and other background presentation work.
- [ ] Parser and result-processing work runs in bounded, cancellable slices and yields before its
      budget can monopolize the UI event loop.
- [ ] Rendering work is proportional to the visible viewport plus bounded look-around; it must not
      rebuild or retain an unbounded whole-document presentation for a local edit.
- [ ] LSP requests and responses never synchronously block input or rendering.
- [ ] The implementation plan must commit a reproducible probe that establishes parser slice
      duration, viewport overscan, and bounded completion/diagnostic batch sizes without weakening
      the observable budgets in this requirement.

#### NFR-4.2 — Document-size tiers and resource bounds *(Complexity: XL; AR-07, AR-08)*

- [ ] Up to 1 MiB or 50,000 lines, enable all applicable local features and enforce NFR-4.1.
- [ ] From that threshold through 10 MiB, preserve editing, search, line numbers, status, save, and
      close; parsing remains incremental but may disable expensive syntax-dependent features after
      a measured budget is exceeded.
- [ ] Above 10 MiB, require an explicit host or user confirmation before loading and begin in plain
      reduced-feature mode.
- [ ] Make document byte, line, retained-history, decoration, fold, diagnostic, completion, symbol,
      edit-count, replacement-size, message-size, nesting-depth, and popup-dimension limits explicit
      and host-configurable only within safe implementation-defined ceilings.
- [ ] Truncation or feature suspension must be visible and non-modal, must identify the affected
      feature, and must not truncate or modify document text.
- [ ] Reject a single edit or protocol result that would exceed hard safety ceilings before
      allocating or applying its full claimed size.

#### NFR-4.3 — Terminal-output safety *(Complexity: XL; AR-13)*

- [ ] Treat document text, filenames, URIs, adapter output, protocol content, errors, and host labels
      as untrusted at every terminal rendering boundary.
- [ ] Ensure untrusted C0/C1 controls, ESC, CSI, OSC, device-control sequences, bidi controls, and
      other terminal-affecting content cannot reach serialized terminal output as active controls.
- [ ] Preserve source text exactly in the document model while rendering dangerous invisible
      characters through visible warnings or placeholders.
- [ ] Derive every terminal coordinate, clip region, popup size, and style span from validated
      bounded values; malformed ranges must fail closed without corrupting adjacent rendering.
- [ ] Do not dynamically import, evaluate, or execute content originating in a document, adapter,
      snippet, language server, theme label, or configuration string.
- [ ] Ensure errors and telemetry contain no document contents by default and no credentials,
      environment variables, unrestricted process output, or database row data.

#### NFR-4.4 — Failure isolation and recovery *(Complexity: L; AR-07)*

- [ ] Isolate document-model, local-language, language-service, popup, and status failures so an
      optional subsystem cannot make editing, save, or close unavailable.
- [ ] Convert adapter and session exceptions into bounded `degraded` state details rather than
      uncaught UI-loop failures.
- [ ] Rate-limit repeated error presentation and prevent a failing background producer from
      repeatedly scheduling work without progress.
- [ ] Cancellation, timeout, close, reconnect, language switch, and disposal must release pending
      work and bounded retained data without accepting late callbacks.
- [ ] A host can explicitly retry or replace a failed language adapter/session without recreating
      or losing the document.

#### NFR-4.5 — Keyboard accessibility and focus *(Complexity: L; AR-11)*

- [ ] Every version 1 operation is reachable through the command API and keyboard; mouse interaction
      is optional and never the only path.
- [ ] Popups, choosers, diagnostic details, and confirmations are dismissible, never trap focus,
      and return focus predictably to the editor.
- [ ] Selection, active line, folding, diagnostic severity, pending state, read-only state, and
      truncation/degradation do not rely on color alone.
- [ ] Command availability, current language, service state, line, visual column, selection size,
      modified/read-only state, and relevant failures are exposed as machine-readable component
      state for host-provided accessible presentation.
- [ ] Default bindings avoid terminal-reserved sequences where practical and remain replaceable
      through RD-01's deterministic binding contract.

#### NFR-4.6 — Terminal capability and layout degradation *(Complexity: L; AR-11)*

- [ ] Preserve all required behavior in monochrome terminals and provide ASCII fallbacks for
      Unicode gutter, fold, diagnostic, and popup symbols.
- [ ] In narrow windows, shorten status values, hide optional status fields, reduce popup width,
      and finally hide the line-number gutter before the editable text area becomes unusable.
- [ ] Clip and reposition all overlays within the current viewport; a popup must never make the
      caret unreachable.
- [ ] Recalculate visual layout correctly for terminal resize, tabs, combining characters, wide
      graphemes, and supported position encodings.
- [ ] Operate in the project's supported terminal test harness without browser, DOM, Electron, or
      graphical accessibility APIs.

#### NFR-4.7 — Compatibility and package boundaries *(Complexity: L; AR-01, AR-04)*

- [ ] Add `CodeEditor` and `CodeEditorWindow` without changing the existing general-purpose
      `Editor` public API or behavior.
- [ ] Export new public contracts only through the owning package's established public entry
      points; do not require consumers to import internal modules.
- [ ] Keep parser adapters, LSP sessions, runtime process adapters, and host file/workspace adapters
      replaceable across explicit boundaries with the smallest practical dependency surface.
- [ ] Do not add a runtime dependency on VS Code, Eclipse, JetBrains, CodeMirror browser views, the
      DOM, Electron, or a browser compatibility layer.
- [ ] Any reuse of headless third-party packages must be compatible with the repository's license,
      distribution model, supported Node.js version, module system, bundling, and terminal-only
      runtime.
- [ ] Unknown additive fields in public versioned contracts are ignored safely; incompatible major
      contract versions fail with actionable configuration errors.

#### NFR-4.8 — Verification and release evidence *(Complexity: XL; AR-04, AR-08)*

- [ ] Write immutable specification tests from approved acceptance criteria before implementation,
      then add separate implementation tests for internal algorithms and failure paths.
- [ ] Cover PostgreSQL SQL, JavaScript, TypeScript, and plain mode with valid, incomplete, invalid,
      Unicode-heavy, hostile, large, and read-only documents.
- [ ] Include deterministic tests for revision races, cancellation, interleaved shared-session
      traffic, reconnect, dynamic capabilities, stale results, invalid edits, and transactional host
      rejection.
- [ ] Include property-based tests for text edits and conversions among document offsets, protocol
      positions, logical lines, UTF-16/code-point encodings, grapheme cells, and visual columns.
- [ ] Include terminal serialization security tests and fuzz corpora for control sequences,
      Markdown, snippets, protocol envelopes, ranges, URI schemes, and size/depth limits.
- [ ] Include benchmark fixtures for every document-size tier, rapid edits, scrolling, parser
      invalidation, diagnostic floods, and completion floods; report p50/p95 and peak retained
      memory in a reproducible environment.
- [ ] Run the repository's complete verification command and license/dependency checks before the
      feature is accepted; no failing existing or new test may be waived silently.
- [ ] Record chosen libraries and architecture in ADRs and document all public adapter/session/host
      contracts before release.

### Should Have

#### NFR-4.9 — Operational observability *(Complexity: M; AR-07, AR-08)*

- [ ] Expose optional aggregate timings and bounded counters for parsing, rendering, LSP latency,
      discarded stale results, truncation, and degraded transitions.
- [ ] Keep observability disabled or content-free by default and route it through a host callback;
      never emit source text, completion text, diagnostics, URIs, or credentials.
- [ ] Ensure observation hooks cannot synchronously block or throw into the editor event loop.

### Won't Have (Version 1)

- [ ] Background analytics or remote telemetry owned by the editor.
- [ ] Guaranteed full language intelligence above the 10 MiB reduced-mode threshold.
- [ ] Graphical-screen-reader integration that depends on a browser or desktop GUI toolkit.
- [ ] Compatibility shims for VS Code extension APIs or browser CodeMirror extensions.

---

## Constraints

- Performance figures are acceptance budgets, not architectural prescriptions. Planning must
  establish a stable benchmark environment and record its hardware/runtime details.
- Configurable limits may be lowered by a host, but hard safety ceilings cannot be disabled.
- Reduced and degraded modes may remove optional presentation only; they never alter source text or
  silently disable save/close.
- The feature must satisfy the repository's supported runtime, module, dependency, license, API,
  documentation, and verification policies at implementation time.

---

## Acceptance Criteria

1. [ ] In the committed reference benchmark, representative edits and required viewport rendering
       for a 1 MiB and a 50,000-line document meet the 16-millisecond p95 uncontended frame budget;
       reports include p50, p95, sample count, runtime, and environment.
2. [ ] During parser, diagnostic, and completion floods, scripted keyboard input, caret movement,
       scrolling, and Escape remain responsive; bounded work yields and stale work is cancelled or
       discarded.
3. [ ] Documents at the full-feature threshold retain all local features; 1–10 MiB documents retain
       editing/search/gutter/status/save/close under feature suspension; documents above 10 MiB
       require confirmation and start in plain reduced mode.
4. [ ] Configured soft limits visibly truncate or suspend only the affected presentation, while
       hard-ceiling tests reject oversized edits/messages/results before full allocation and leave
       text unchanged.
5. [ ] A terminal serialization corpus containing every C0/C1 control, ESC/CSI/OSC sequences, bidi
       controls, zero-width controls, hostile filenames/URIs, and malformed style ranges emits no
       active untrusted terminal control.
6. [ ] Forced failures in the parser, adapter, shared session, popup renderer, diagnostic producer,
       host callback, and observability callback remain isolated; editing, save, close, retry, and
       disposal behave according to NFR-4.4.
7. [ ] A keyboard-only conformance journey opens, edits, searches, folds, completes, inspects
       diagnostics, navigates, formats, saves, and closes without mouse input or focus trapping.
8. [ ] Monochrome, ASCII-only, narrow, resized, and Unicode-width terminal fixtures preserve all
       required operations and keep the caret visible with overlays clipped inside the viewport.
9. [ ] Existing `Editor` public API tests and behavior remain unchanged, while `CodeEditor` public
       imports work only through supported package entry points in the repository's module modes.
10. [ ] A clean terminal-only process can import and exercise the editor with no browser, DOM,
        Electron, VS Code, graphical toolkit, or browser compatibility global/dependency.
11. [ ] Dependency and license verification demonstrates that every shipped third-party package is
        compatible with repository policy and does not pull disallowed browser/IDE runtimes.
12. [ ] Specification, implementation, integration, property, fuzz/security, race, accessibility,
        size-tier, and benchmark suites cover the cases in NFR-4.8 and pass the complete repository
        verification command.
13. [ ] Benchmark and stress runs retain bounded histories, decorations, diagnostics, completion
        items, symbols, popups, requests, and telemetry counters after cancellation and disposal,
        with peak memory included in the evidence.
14. [ ] Optional observability reports only aggregate timings/counters through the host callback;
        malicious or slow callbacks cannot expose content, block input, or escape into the event
        loop.

---

## Techdocs Update

When implemented, document document-size modes, all configurable and hard limits, benchmark
methodology, scheduling/backpressure model, failure containment, terminal sanitation boundary,
keyboard/focus behavior, layout fallback sequence, public package boundaries, supported runtime and
terminal capabilities, observability schema, dependency/license decisions, and the complete
verification matrix. Record text-storage, rendering, parser, and third-party dependency decisions
in ADRs during planning or implementation.
