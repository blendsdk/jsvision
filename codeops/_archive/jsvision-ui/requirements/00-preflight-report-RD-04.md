# Preflight Report — RD-04 (Event Loop + Focus + Modality + Commands)

> **Status**: ✅ PASSED — all 8 findings resolved (Option A accepted) and applied to RD-04 + AR-60…AR-66 (2026-06-29)
> **Iteration**: 1 (first scan)
> **Artifact**: Requirements document at `requirements/RD-04-event-loop.md`
> **Codebase Grounded**: 9 source files examined, all RD-04 references mapped to code
> **Last Updated**: 2026-06-29
> **CodeOps Skills Version**: 3.0.0

> ⚠️ **SAME-MODEL CAVEAT** — RD-04 was authored 2026-06-29 by the same model family now
> auditing it (this audit runs in a fresh post-`/clear` session, so it is not strictly a
> same-session review, but shared-bias risk remains). The dispatch contract is
> architecturally foundational; a human review of PF-401/PF-402 is recommended in addition.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), zero runtime deps; yarn 1.x + Turborepo monorepo; vitest. (`packages/ui/package.json`, `tsconfig.base.json`)
**Architecture:** `@jsvision/ui` retained widget tree on `@jsvision/core`. RD-04 extends the RD-03 spine (`packages/ui/src/view/`) with a host-agnostic dispatch engine, consuming `@jsvision/core`'s decoded `InputEvent` union.
**Key Files Examined:**
- `packages/ui/src/view/view.ts` — `View` base (onEvent stub, state flags, bind, mount/scope)
- `packages/ui/src/view/types.ts` — `ViewState`, `RenderRootOptions` (construct-time `schedule`)
- `packages/ui/src/view/render-root.ts` — `RenderRoot` interface + impl (private readonly scheduler)
- `packages/ui/src/view/group.ts` — `Group` (children, scopes; no `current` yet)
- `packages/core/src/engine/input/events.ts` — `InputEvent` union (readonly, 1-based mouse coords)
- `packages/core/src/engine/input/keymap.ts` — existing `createKeymap`/`Keymap` (`'ctrl+q'` grammar)
- `packages/ui/src/reactive/index.ts` — `runWithOwner`/`getOwner`/`Owner` exports
- `packages/core/src/engine/index.ts` — public core exports
- `packages/ui/src/index.ts` — `@jsvision/ui` public entry

**Reference Verification:** All RD-04 code references mapped. Verified-present: `View.onEvent` stub, `state.focused`/`disabled`, `RenderRoot.resize`/`flush`, `runWithOwner`/`getOwner`/`Owner`, `Size2D`, core `InputEvent`/`KeyEvent`/`MouseEvent`/`WheelEvent`/`PasteEvent`/`FocusEvent`/`TuiError`. Misaligned (findings below): the `handled` flag vs readonly `InputEvent`; runtime scheduler injection vs construct-time-only seam; bespoke keymap vs existing `createKeymap`.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-405) | 🟡 |
| 2 | Implicit Assumptions | — | — |
| 3 | Logical Contradictions | 1 (PF-401) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-407, shared) | 🟡 |
| 5 | Dependency Issues | — | — |
| 6 | Feasibility Concerns | 1 (PF-402) | 🟠 |
| 7 | Testability | — | — |
| 8 | Security Blind Spots | 1 (PF-407) | 🟡 |
| 9 | Edge Cases | 2 (PF-404, PF-406) | 🟡 |
| 10 | Scope Creep | — | — |
| 11 | Ordering | — | — |
| 12 | Consistency | 1 (PF-403) | 🟠 |
| 13 | Codebase Alignment | 3 (PF-401/402/403) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | ✅ all resolved (Option A) |
| MINOR | 4 | ✅ all resolved (Option A) |
| OBSERVATION | 1 | ✅ resolved (Option A) |

---

### PF-401: The `handled` flag cannot live on core's readonly `InputEvent` 🟠 MAJOR

**Dimension:** 3 (Contradiction) / 13 (Stale Assumption) / 4 (Completeness)
**Location:** RD-04 — "3-phase dispatch" (`handled` flag bullet), "Public API surface" (`CommandEvent.handled`, `AppEvent`), AC-2/AC-9.
**Codebase Evidence:** `packages/core/src/engine/input/events.ts:16-58` — every member of `InputEvent` (`KeyEvent`/`MouseEvent`/`WheelEvent`/`PasteEvent`/`FocusEvent`) has **only `readonly` fields and no `handled` member**. `CommandEvent` (RD-04 line 189-194) does declare a mutable `handled: boolean`, so `AppEvent = InputEvent | CommandEvent` is **non-uniform**: `handled` exists on one arm and not the other.
**The Problem:** The 3-phase model's core mechanism is "`onEvent(ev)` sets `ev.handled = true` to halt propagation" (AC-2). But for a key/mouse/paste event the loop receives via `dispatch(event: AppEvent)`, there is no `handled` field to set and the fields are `readonly`. The doc's "Additive View surface" note says the event handed to `onEvent` carries `handled`, implying the loop **wraps** each `InputEvent` in a dispatch envelope — but no such envelope type is defined, and `dispatch`'s parameter type (bare `InputEvent`) and `onEvent`'s parameter type (something with `handled`) are then different shapes. The RD hedges ("or returning a sentinel — finalized in planning") but the typed API commits to the mutate-the-flag approach that the real `InputEvent` cannot support.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define a dispatch **envelope** `DispatchEvent = { event: InputEvent \| CommandEvent; handled: boolean; ... }` that the loop wraps each event in; `onEvent` receives the envelope | Uniform `handled`; room for mouse view-local coords too; core events stay pure/readonly | New type in the public surface; `onEvent` signature differs from `dispatch` input |
| B | Make `onEvent` **return** a handled-signal (`boolean`/sentinel) instead of mutating; drop `handled` from `CommandEvent` | No envelope; works over readonly events untouched | Loses the "one flag, any phase reads it" ergonomics; commands lose a carried flag |
| C | Add a mutable `handled` to core's `InputEvent` types | `ev.handled` works directly as written | Pollutes the pure decoder's data model; cross-package change to `@jsvision/core`; breaks "events are readonly plain data" (events.ts:6) |

**Recommendation:** Option **A** — a dispatch envelope keeps core's `InputEvent` pure/readonly (events.ts intentionally so) while giving every dispatched event a uniform mutable `handled`, and it is the natural carrier for the mouse view-local coordinates the RD already says are "translated to view-local" (ties to PF-404). Update the API surface so `dispatch` documents the wrap and `onEvent(ev: DispatchEvent)` is the handler shape. Option C is rejected (cross-package pollution of a pure model); B is viable but discards the flag ergonomics the RD's ACs lean on.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-402: Scheduler "injection" into an already-constructed `RenderRoot` is infeasible against the current seam 🟠 MAJOR

**Dimension:** 13 (Architecture Mismatch / Impact Blindness) / 6 (Feasibility)
**Location:** RD-04 — "Loop drives frames (AR-54)", "Integration Points → RenderRoot.schedule", `createEventLoop(renderRoot, opts)`, AC-16.
**Codebase Evidence:** The schedule seam RD-03 built is **construct-time only**: `RenderRootOptions.schedule` (`packages/ui/src/view/types.ts:57`) is read once in the constructor into a `private readonly scheduler` (`render-root.ts:124,139`). The `RenderRoot` **interface exposes no scheduler setter** (`render-root.ts:34-45` — only `mount`/`resize`/`flush`/`serialize`/`buffer`). So a loop built via `createEventLoop(renderRoot)` over an **already-constructed** root cannot "inject its tick as the render scheduler" — the scheduler was frozen at `createRenderRoot(size, opts)` time.
**The Problem:** AR-54/AC-16 ("the loop owns the render scheduler … exactly one flush per batch") is load-bearing, but the API ordering makes it impossible as written. RD-04's "Additive surface" section lists only `View.focusable` and `Group.current` as RD-03 changes — it does **not** acknowledge that delivering AR-54 requires either a new `RenderRoot` seam or a construction-order change. This is impact-blindness toward the RD-03 render root.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | `createEventLoop` constructs (or wraps) the `RenderRoot` so the loop's tick is passed as `schedule` at construction — e.g. the loop owns root creation, or takes `(size, opts)` instead of a built root | Uses the existing construct-time seam unchanged; deterministic | Changes the `createEventLoop` signature from "takes a built root" to "owns root construction"; the README/AR wording assumes a passed-in root |
| B | Drop scheduler injection entirely: the loop calls `renderRoot.flush()` itself at end-of-dispatch; coalescing comes from dispatching the whole batch before one `flush()` | No new seam, no order change; `flush()` already exists (`render-root.ts:179`) | "Batch of N external events → one flush" then needs an explicit begin/end-batch or array `dispatch` (ties to PF-405); loses the auto-coalesce the injected scheduler gives |
| C | Add an additive `RenderRoot.setScheduler(fn)` (or expose `schedule`) seam and list it in the additive surface | Keeps `createEventLoop(renderRoot)` as written | New mutable seam on the render root; re-injecting mid-life has ordering subtleties with an in-flight scheduled flush |

**Recommendation:** Option **A** — have the loop own (or wrap) render-root construction so the existing construct-time `schedule` seam is used exactly as RD-03 designed it, with no new mutable surface. Concretely, change the signature toward `createEventLoop(renderRoot-or-(size,opts), opts)` and state it in the additive surface. Option B is a clean fallback but pushes the batch problem (PF-405) to the foreground; C adds a mutable seam RD-03 deliberately didn't expose.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-403: Bespoke keymap duplicates and contradicts core's existing `createKeymap`/`Keymap` 🟠 MAJOR

**Dimension:** 13 (Redundancy + Convention Violation) / 12 (Consistency)
**Location:** RD-04 — "Key → command keymap (AR-52)", `EventLoopOptions.keymap?: Record<string, string>` (line 201), AC-11 (`{ 'Ctrl-Q': 'quit' }`), behavior notes.
**Codebase Evidence:** `@jsvision/core` **already ships** a chord→name keymap: `createKeymap(bindings) → Keymap` with `lookup(event: KeyEvent): string | undefined` (`packages/core/src/engine/input/keymap.ts:40-50`), exported publicly (`engine/index.ts:37,49`). Its chord grammar is **`'+'`-joined, lowercased** with build-time validation: `'ctrl+s'`, `'ctrl+q'` (`keymap.ts:54,85-87`). RD-04 instead defines a raw `Record<string, string>` with the **incompatible grammar** `'Ctrl-Q'` / `'Ctrl-Tab'` / `'Enter'` (capitalized, hyphen-joined; RD lines 201, 391, 124).
**The Problem:** RD-04 reinvents key-chord parsing that core already provides, and worse, picks a *different* chord syntax — leaving the SDK with two incompatible chord grammars (`'ctrl+q'` in core, `'Ctrl-Q'` in ui). The RD-04 "Dependency Reality" check fails: the installed workspace dep already solves the problem, with validation RD-04's bare `Record` lacks.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reuse core's `createKeymap`/`Keymap`: `EventLoopOptions.keymap` accepts core's chord bindings (`'ctrl+q'`) and/or a built `Keymap`; the loop calls `keymap.lookup(keyEvent)` to resolve key→command | One chord grammar SDK-wide; free build-time validation; zero new parsing code (DRY) | Must restate all RD-04 examples to the `'ctrl+q'` grammar; `keymap` option type changes from `Record` to core's bindings/`Keymap` |
| B | Keep a ui-local keymap but **adopt core's exact grammar** (`'ctrl+q'`) and validation, without importing `createKeymap` | ui owns its keymap surface | Still duplicates parsing/validation core already has — DRY violation persists |

**Recommendation:** Option **A** — reuse `createKeymap`/`Keymap` from `@jsvision/core` (already a declared dep) and its `'ctrl+q'` grammar; update `EventLoopOptions.keymap` and every example/AC (AC-11) accordingly. This removes duplicated parsing, unifies the chord syntax across core and ui, and inherits core's fail-fast validation. Option B is rejected — it keeps the duplication the whole finding is about.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-404: Mouse hit-test omits the 1-based→0-based coordinate conversion 🟡 MINOR

**Dimension:** 9 (Edge Cases) / 4 (Completeness)
**Location:** RD-04 — "Mouse hit-testing", "Behavior notes → Hit-test", AC-7/AC-8.
**Codebase Evidence:** Core `MouseEvent`/`WheelEvent` carry **1-based** coordinates as the terminal sends them: `MouseEvent { x, y }` "Coordinates are 1-based as the terminal sends them (PL-11, AC-3)" (`packages/core/src/engine/input/events.ts:27-42`). View `bounds` are **0-based** parent-relative integer rects (`Rect { x, y, width, height }`, view.ts:36; reflow writes 0-based origins). RD-04 describes the hit-test purely as "absolute `(x,y)` … contained in absolute bounds" with no mention of the off-by-one base difference.
**The Problem:** A hit-test that compares 1-based event coordinates against 0-based bounds is off by one on both axes — exactly the silent correctness bug AC-7/AC-8 are meant to pin down. The RD defers coordinate *translation to view-local* to planning, but does not flag the *base normalization* as the first step.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add an explicit note: the loop normalizes event coords to 0-based (`x-1`, `y-1`) at the dispatch boundary before hit-testing and view-local translation | One conversion point; downstream stays 0-based like the rest of ui | One sentence/AC to add |
| B | Leave it to planning as part of "coordinates … finalized in planning" | No doc change now | Easy to miss; AC-7/AC-8 read as if bases already match |

**Recommendation:** Option **A** — call out the 1-based→0-based normalization explicitly in the hit-test behavior note (and ideally AC-7), since it is a non-obvious cross-package gotcha precisely in the area the ACs test. Cheap to state, expensive to miss.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-405: "Batch" / event-queue / `onIdle`-drain model is underspecified against the singular `dispatch(event)` 🟡 MINOR

**Dimension:** 1 (Ambiguity) / 4 (Completeness)
**Location:** RD-04 — `dispatch(event)` ("flushes one coalesced frame for the whole batch"), AR-54 wording, AC-16 ("dispatching a **batch of N events**"), AC-18 / `onIdle` ("when the dispatch **queue** drains").
**Codebase Evidence:** The public API exposes only `dispatch(event: AppEvent): void` — **singular**, no array form, no begin/end-batch, no queue surface (RD-04 line 211). Yet AC-16 asserts "a batch of N events … exactly one flush" and AR-58/AC-18 speak of an internal "event queue" that drains to fire `onIdle`.
**The Problem:** It is ambiguous what a "batch" is and where the "queue" lives: (a) one `dispatch` call plus the synchronous command cascade it raises (so "queue drains" = cascade done, one frame per `dispatch`), or (b) multiple external `dispatch` calls coalesced by a deferring scheduler (so "batch of N" = N host calls, one frame per turn). Interpretation (b) depends entirely on PF-402's scheduler injection working; (a) needs `dispatch` to document the internal cascade queue. The two ACs (16 vs 18) read as different models.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define a "dispatch tick" = one `dispatch(event)` call + its internal command cascade; the queue is the cascade queue, `onIdle` fires when it drains, one coalesced frame per tick. Reword AC-16 away from "batch of N external events" | Matches the singular `dispatch`; deterministic; no extra API | AC-16's "N events" wording must change |
| B | Add an explicit batch boundary (array `dispatch(events[])` or `beginBatch`/`endBatch`) so N external events truly coalesce into one frame | AC-16's literal "batch of N" holds; host can group a read chunk | New API surface; more to test |

**Recommendation:** Option **A** — anchor the "batch" to one `dispatch` call's synchronous cascade and reword AC-16/AC-18 to that model; it fits the singular `dispatch` already in the surface and the deterministic one-frame-per-tick intent, without adding API. Choose B only if the host genuinely needs to hand the loop a multi-event chunk atomically (decide alongside PF-402).

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-406: `focusable` default and disabled/visible ancestor propagation are unspecified 🟡 MINOR

**Dimension:** 9 (Edge Cases) / 1 (Ambiguity)
**Location:** RD-04 — "Focusable predicate (AR-56)" ("default per the widget"), predicate `visible && !disabled && focusable`, AC-4/AC-5.
**Codebase Evidence:** The RD-03 base `View` has no `focusable` field (`view.ts` — `state` is `{ visible, disabled, focused }` only); RD-04 adds it. The predicate is evaluated **per view** with no ancestor walk. `Group` focusability is *derived* ("iff it has a focusable descendant").
**The Problem:** Two gaps: (1) the default value of the new `focusable` option on a plain `View` is left as "per the widget" — but RD-04's own acceptance uses bare test `View` subclasses, so the base default decides whether those are focus-eligible (AC-4 traversal). (2) The predicate checks only the view's own `visible`/`disabled`; it does not say whether a view inside a **disabled or invisible ancestor Group** is still focus-eligible / hit-testable. TV semantics disable the whole subtree; the literal local predicate would not.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify base `View.focusable` default = `false` (decorative by default; interactive widgets opt in), and state that focus-eligibility & hit-testing skip any subtree under a `!visible` or `disabled` ancestor | Unambiguous; matches TV subtree semantics; safe default | Slightly more predicate logic (ancestor check) |
| B | Default `focusable = true` for a plain leaf `View`, ancestor propagation deferred to planning | Test subclasses are focusable without opting in | "Everything focusable by default" is surprising for decorative views; propagation still unresolved |

**Recommendation:** Option **A** — default `focusable` to `false` and make eligibility/hit-testing honor a `!visible`/`disabled` ancestor (subtree semantics), matching Turbo Vision and avoiding a focusable control buried in a disabled panel. Note the base default explicitly so AC-4's test subclasses set `focusable: true` deliberately.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-407: AC-19 requires screen-safe logging of handler errors, but the `EventLoop` API exposes no logger seam 🟡 MINOR

**Dimension:** 4 (Completeness) / 8 (Security Blind Spot)
**Location:** RD-04 — Security § ("logged via the screen-safe logger, dispatch continues"), AC-19 (handler-error isolation), `EventLoopOptions` (lines 200-207).
**Codebase Evidence:** The `RenderRoot`'s logger is `private` and **not exposed** on the `RenderRoot` interface (`render-root.ts:123` `private readonly logger`; interface at `render-root.ts:34-45` has no logger accessor). `EventLoopOptions` (RD-04 lines 200-207) has `keymap`/`commands`/`onIdle` but **no `logger`**. So an `onEvent` that throws — caught in the loop, not in the render root — has no injected `Logger` to write to, and cannot reach the root's private one.
**The Problem:** AC-19 ("a view whose `onEvent` throws is logged via the screen-safe logger and the loop continues") is not satisfiable with the current API: the loop has no logger to call. RD-03 solved the parallel `draw()`-throws case (AR-42) by injecting a `logger` into `RenderRootOptions`; RD-04 omits the equivalent for `onEvent`.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `logger?: Logger` to `EventLoopOptions` (default a disabled `createLogger()`, mirroring `RenderRootOptions`) | Symmetric with RD-03's AR-42; AC-19 becomes satisfiable; consistent | One option field to add |
| B | Expose the root's logger on the `RenderRoot` interface and have the loop reuse it | Single logger for draw + dispatch errors | New RenderRoot surface (RD-03 change not in the additive list); couples loop to root internals |

**Recommendation:** Option **A** — add an injectable `logger?: Logger` to `EventLoopOptions` defaulting to a disabled `createLogger()`, exactly as `RenderRootOptions` does for `draw()` errors (AR-42, types.ts:59). It makes AC-19 testable (assert the logger saw the error) and keeps the render root's surface unchanged.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

### PF-408: Illustrative API block imports `KeyEvent`/`MouseEvent`/`WheelEvent` it never uses 🔵 OBSERVATION

**Dimension:** 12 (Consistency)
**Location:** RD-04 — "Public API surface" import line (`import type { InputEvent, KeyEvent, MouseEvent, WheelEvent } from '@jsvision/core';`).
**Codebase Evidence:** In the shown surface only `InputEvent` is referenced (in `AppEvent`); `KeyEvent`/`MouseEvent`/`WheelEvent` are imported but unused. The project's coding standard removes unused imports, and the real file would fail `noUnusedLocals`/ESLint.
**The Problem:** Cosmetic only — the block is labeled "indicative … finalized during planning." But since the RD is the template implementers copy from, an unused-import example mildly contradicts the no-dead-code standard.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Trim the illustrative import to what the snippet uses (`InputEvent`), or add a comment that the others are for the wider surface | Matches the no-dead-code standard | Trivial edit |
| B | Leave as-is (it is explicitly indicative) | No change | Minor inconsistency with the standard |

**Recommendation:** Option **A** (trivial) — trim to `InputEvent` (the others reappear naturally once the full surface is written in planning). Non-blocking.

**User Decision:** Resolved — User accepted recommendation (Option A); applied to RD-04 and recorded as an AR entry (AR-60…AR-66).

---

> **Adversarial checklist (same-model safeguard):** Verified the dispatch contract against the
> *actual* core `InputEvent` (readonly, no `handled`) rather than from memory (PF-401); verified the
> schedule seam is construct-time/private rather than assuming a runtime setter (PF-402); caught the
> pre-existing `createKeymap` the RD reinvented (PF-403). Turbo Vision conformance (3-phase order,
> `ofSelectable`, focus-chain, modal stack) is described from the RD's own framing — not cross-checked
> against TV source; flagged for human review if TV-faithfulness is a hard requirement.
