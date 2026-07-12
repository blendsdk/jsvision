# Ambiguity Register — Out-of-tick repaint (missing-flush bug class)

> **Plan**: `plans/out-of-tick-repaint/`
> **Status**: ✅ GATE PASSED — all items resolved, user-confirmed 2026-07-12
> **Implements**: jsvision-ui/RD-04 (hardens the event loop's flush contract)
> **Driver**: GitHub issue #68 — "Audit: state mutations outside a loop tick don't repaint"
> **CodeOps Skills Version**: 3.4.1

This plan hardens **RD-04** (`requirements/RD-04-event-loop.md`). RD-04's behavioral decisions
(AR-47…AR-66 upstream, plus PA-1…PA-12 in `plans/event-loop/00-ambiguity-register.md`) are
inherited verbatim and **not** re-litigated — in particular **AR-61 / event-loop PA-11**: the loop
constructs the render root with a **deferring `schedule`** and drives `renderRoot.flush()` itself
once per tick. This plan changes exactly that seam: the deferring `schedule` becomes a *coalesced
out-of-tick painter* so mutations that reach the tree **outside** a `runTick` still paint.

This register captures only the **plan-level** decisions, numbered `PA-NN`.

## Plan-level decisions (PA-NN)

| PA # | Category | Question | Options Considered | Decision | Status |
|------|----------|----------|--------------------|----------|--------|
| PA-1 | Architecture / systemic fix | How to close the whole missing-flush class (not just the shipped `removeWindow` exemplar)? | **(A) coalesced `schedule`** — replace the loop's no-op `schedule` seam (`event-loop.ts:193`) with a painter that coalesces + flushes any out-of-tick mutation; **(B)** enforce "never mutate the tree outside a tick" + route all mutators through `runTick`; **(C)** audit-and-fix each site individually | **(A)** — B contradicts the framework's own reactivity (`View.bind()` is effect-based and *meant* to fire from timers/promises/streams; `run-spinner.ts` is a shipped counterexample) and C cannot reach the reactive path (the `invalidate` lives in one generic effect at `view.ts:236-237`; the real "site" is every async signal write in every app). The coalescing machinery already exists (`render-root.ts:326` `scheduleFlush`/`scheduled`), so A is small. | ✅ Resolved (user) |
| PA-2 | Naming / public API | The injectable microtask seam that lets tests step the out-of-tick paint deterministically — public opt vs internal? | (a) **add `EventLoopOptions.scheduleMicrotask?: (cb: () => void) => void`, default `queueMicrotask`** (mirrors the existing `now`/`timer`/`schedule` injection idioms); (b) keep it internal, tests drain real microtasks (rejected by user: flakier, non-deterministic) | **(a) `EventLoopOptions.scheduleMicrotask` (default `queueMicrotask`)** | ✅ Resolved (user) |
| PA-3 | Naming / lifecycle API | How is the out-of-tick painter hard-gated after teardown (so a stray microtask cannot write to a stopped host)? | (a) **add `EventLoop.stop(): void`** — sets an internal `stopped` flag the out-of-tick painter checks; `run()`'s `finally` calls it after `host.stop()` (alongside the existing sink-nulling, `run.ts:135-138`); headless `createApplication` never calls `run()`, so `stopped` stays `false` and out-of-tick paints keep working in tests; (b) minimal try/catch + `rootView` guard only (rejected by user in favour of the explicit seam) | **(a) explicit `EventLoop.stop()` + `stopped` flag** | ✅ Resolved (user) |
| PA-4 | Behavioral / scope | Direct WM public mutators (`desktop.cascade()`/`tile()`, `window.zoom()`) called **directly between ticks** — how do they repaint? | (a) **Option A backstop only** — they already call `invalidateLayout()` → the new coalesced `schedule` → repaint on the next microtask (one code path, minimal edit); (b) also wrap them in `runTick` for synchronous paint (rejected by user: larger edit surface, two paths to one outcome) | **(a) backstop only; a direct `desktop.cascade()` paints on the next microtask** | ✅ Resolved (user) |
| PA-5 | Technical / painter mechanics | What exactly does the coalesced painter run, and how are redundant paints avoided? | Grounded in the code, no viable alternative: **(1)** the seam callback → if `draining` or `stopped`, no-op (the tick's trailing paint / teardown handle it); else set a loop-owned `flushPending` flag and enqueue **one** microtask via `scheduleMicrotask`. **(2)** the microtask → if `stopped` or `!flushPending`, return; else `paint()`. **(3)** `paint()` = `flushPending=false; renderRoot.flush(); onFrame?.(buffer()); emitCaret()` — the **exact trio order** from `event-loop.ts:375-377` (in `run()`, `onFrame` only stashes `pendingFrame`; `onCaret` does the real `host.render`, so a wrong order never reaches the terminal / drifts the caret) — extracted from `runTick`'s tail and reused; **`paint()` does NOT call `onIdle`** (command-queue-drain semantics, not repaint). **(4)** every synchronous loop-paint path (`runTick` via `paint()`, `resize`, `mount`) ends with `flushPending=false`, so the redundant microtask Option A introduces after `resize()`/`mount()` (both run with `draining===false`) becomes a clean no-op. | **As specified (1)–(4)** — see `03-01` | ✅ Resolved (grounded) |
| PA-6 | Process / plan shape + RD linkage | Document-set weight and requirements linkage. | (a) **full multi-doc set** + **`Implements: jsvision-ui/RD-04`** (the fix lives in the loop and hardens its flush contract; roadmap tracks it under RD-04); (b) single-file mini-plan, issue-driven no RD (rejected by user) | **(a) full multi-doc set; hardens RD-04** | ✅ Resolved (user) |
| PA-7 | Scope / DoD deliverable | The issue's "written audit of all mutators / `invalidate*` sites with tick-safety classification" — where does it live? | (a) **`02-current-state.md` captures the exhaustive 41-site `invalidate`/`invalidateLayout` classification** (in-tick vs out-of-tick) + the mutator/async-source inventory produced this session; (b) a separate standalone audit doc (rejected: `02-current-state` is exactly the owning doc for current-code analysis) | **(a) in `02-current-state.md`** | ✅ Resolved (DoD) |
| PA-8 | Scope / tests | Where do the regression tests live, and what do they assert? | (a) **`packages/ui/test/` only** — the fix is in the loop; `@jsvision/web`/`@jsvision/theme-designer`/`@jsvision/files` inherit it (they wire the same loop). Reuse the `desktop-removewindow-repaint.impl` pattern: assert the **painted** frame via `loop.onFrame`, never a manual `renderRoot.flush()`. (b) also add web/designer tests (rejected: redundant — the loop is the single fix point; inheritance noted in `03-01`) | **(a) `packages/ui/test/` only** | ✅ Resolved (dominant) |
| PA-9 | Scope / no-redo | Is the shipped `Desktop.removeWindow` else-branch fix re-touched? | (a) **No** — it shipped in v0.2.0 (PR #70, closed #67 + the #68 exemplar); Option A becomes a belt-and-suspenders backstop for it. Do not re-fix; the existing `desktop-removewindow-repaint.impl.test.ts` `toBe(1)` oracle must stay green. | **(a) do not redo; keep it green** | ✅ Resolved (fact) |
| PA-10 | Process / verify | The verify command that fills every Verify line. | Detected from `CLAUDE.md`: **`yarn verify`** (= `yarn lint` then `turbo run typecheck build test check:docs`). | **`yarn verify`** | ✅ Resolved (detected) |
| PA-11 | Architecture / file layout | Which files change? | Confined + additive: **`packages/ui/src/event/event-loop.ts`** (the `schedule` seam → coalesced painter, `paint()` extraction, `flushPending`, `stopped`, `stop()`), **`packages/ui/src/event/types.ts`** (`EventLoopOptions.scheduleMicrotask` + `EventLoop.stop()`), **`packages/ui/src/app/run.ts`** (`finally` calls `loop.stop()`). No render-root change (its `scheduleFlush`/`scheduled` coalescing already exists). No change to the 40 already-safe in-tick call sites. | **As listed** | ✅ Resolved (grounded) |
| PA-12 | Technical / painter mechanics **(runtime — discovered during execution)** | `03-01`'s `mount()` call-site edit ("after `emitCaret()`, add `this.flushPending = false;`") strands the render root's private `scheduled` flag. During `renderRoot.mount()` → `flush()`, the initial layout fires each view's `onMount` → `bind`, whose first effect run calls `invalidate()` → `scheduleFlush()`, re-setting `scheduled = true` **after** the flush cleared it (a re-schedule `resize` never causes — it re-runs no `onMount`). Clearing `flushPending` then leaves the queued microtask a no-op that never calls `renderRoot.flush()`, so `scheduled` stays `true` and every later out-of-tick `scheduleFlush()` returns early at `if (this.scheduled) return` — blocking the first out-of-tick paint in a real app, not just a test. Empirically confirmed (an out-of-tick write left `pending.length === 0`). | (a) **`mount()` must NOT clear `flushPending`** — the mount-time microtask IS the drain that clears `scheduled` (its `paint()` calls `renderRoot.flush()`); leaving `flushPending` set lets it run. `resize()` keeps its clear (its synchronous flush leaves `scheduled` clean). The spec/impl harness settles mount by running the deferred paint (`runPending()`) before wiring `onFrame`. (b) add a public `RenderRoot.pendingFlush` query and gate the microtask on it (rejected: heavier, adds render-root surface the design avoided; (a) is sufficient and stays additive-free on the render root). | **(a) — verified; single viable path (correctness-forced, no new public/render-root surface)** | ✅ Resolved (runtime) |

> **Additive-only public surface.** The two new public symbols — `EventLoopOptions.scheduleMicrotask`
> and `EventLoop.stop()` — are additive (optional opt; new method). No existing signature changes.
> Behaviour of every loop-wrapped mutator is unchanged; the only new behaviour is that **out-of-tick**
> mutations now paint (previously they silently went stale until the next input).

## Category scan (12-category sweep)

| Category | Findings |
|----------|----------|
| Functional scope | Covered PA-1, PA-4, PA-7, PA-9 |
| Naming & terminology | PA-2 (`scheduleMicrotask`), PA-3 (`stop`) — confirmed |
| Technical unknowns / architecture | PA-1, PA-5, PA-11 |
| Data / state | The loop-owned `flushPending` + `stopped` booleans (PA-5, PA-3); no persistent data |
| Error handling | `paint()` runs host/user code (`onFrame`/`onCaret`); it inherits the loop's existing isolation posture — `stopped` prevents post-teardown paints (PA-3). No new error surface. |
| Security | No new input path. The painter only re-runs the existing sanitized compose/serialize pipeline. No injection/authz surface (a terminal-render library). |
| Performance | Coalescing (PA-5) guarantees **at most one** microtask paint per burst; `flush()` is a near-no-op when nothing is dirty (`render-root.ts:332`). No added per-frame cost on the in-tick path. |
| Testing | PA-8; ST-cases in `07-testing-strategy.md` |
| Dependencies | None new — pure `@jsvision/core` + existing RD-03/RD-04 surface |
| Backward compatibility | PA-11 note; 90+ manual-`flush()` tests don't wire `onFrame` (invisible to stray paints); the 3 exact-`onFrame`-count tests are synchronous → stay green; full `yarn verify` re-run required (`07 §Verification`) |
| Deployment / rollout | Single lockstep-versioned change to `@jsvision/ui`; inherited by web/designer/files |
| Docs | JSDoc on the two new public symbols (`@example`, per the project's non-negotiable doc rule); no `codeops/`/RD refs in shipped code |

> **Traceability:** every design/scope/error decision in the plan documents back-references a `PA-#`
> row here. Grounded per the coding standards' options-and-recommendations directive: code-modifying
> options are cited to `file:line`, rejected options named (not strawmanned).
