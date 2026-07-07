# Execution Plan — accelerator-overlay

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0
> **Implements**: jsvision-ui/#40 (reliability remainder) + #41 (discoverability) — no RD (AR-6)
> **Progress**: 19/19 tasks (100%) — ✅ COMPLETE · **Last Updated**: 2026-07-07
> **Gate**: ✅ Zero-Ambiguity PASSED (00-ambiguity-register.md)

Spec-first ordering per phase: **spec tests → red → implement → green → impl tests → verify**. Specs
derive from [07-testing-strategy.md](07-testing-strategy.md); design in
[03-01](03-01-reveal-overlay.md) / [03-02](03-02-armed-mode.md). **No `@jsvision/core` change**
(AR-15). Not TV-derived — no fidelity gate.

## Phase 1 — Reveal seam + underline emphasis (FR-1, FR-6)

**Spec tests (red):**
- [x] P1.1 Write `accelerator-reveal.spec.test.ts` — **ST-1** (reveal underlines the hot glyph on
      Button + Label; off ⇒ none) and **ST-6** (disabled hotkey not underlined). Use a `RenderRoot`
      with a `setRevealAccelerators` seam (added in P1.4) — assert the buffer cell `Attr.underline`.
- [x] P1.2 Run red — confirm ST-1/ST-6 fail (no seam / no emphasis yet).

**Implement (green):**
- [x] P1.3 `view/types.ts`: add `DrawContext.revealAccelerators: boolean` (additive JSDoc, mirror the
      `caps` field `:57-64`). `view/draw-context.ts`: accept + expose it (`:64-70,190`), default via
      the test helper.
- [x] P1.4 `view/render-root.ts`: hold mutable `revealAccelerators` + `revealScope`; add
      `setRevealAccelerators(on, scope?)` (store + `markRelayout` on change, AR-14) to the
      `RenderRoot` interface; thread the flag into `composeView`→`makeDrawContext`→recursion
      (`:135,156,303,316-328`) with an `insideScope` param so reveal is modal-scoped (03-01 "Reveal
      scoping", FR-4). Add **ST-4-reveal** coverage (background window not underlined) to P1.1.
- [x] P1.5 Add the shared `accentStyle(base, reveal)` underline helper (03-01) and wrap the **hot run
      only** in all 7 drawers: Button (`button.ts:156-158`), Label (`label.ts:60-62`), Cluster
      (`cluster.ts:104-105`), MenuBar (`menubar.ts:63-66`), TabView strip (`tab-strip.ts:341-342`),
      StatusLine (`statusline.ts:144-145`). Honor existing disabled paths (FR-6).
- [x] P1.6 Run green — ST-1/ST-6 pass; full `packages/ui` unit suite green (no regressions in the
      widget draw specs).

**Impl tests:**
- [x] P1.7 `accelerator-reveal.impl.test.ts` — **IT-3** (TabView reveal scope), **IT-4** (Cluster
      family underline), **IT-2** (one coalesced frame per flag flip).

## Phase 2 — Armed mode + synth-alt fire (FR-2…FR-5, FR-7, FR-8)

**Spec tests (red):**
- [x] P2.1 Write `accelerator-fire.spec.test.ts` — **ST-2** (arm→plain letter fires like Alt),
      **ST-3** (F12 toggles), **ST-4** (modal scope), **ST-5** (dismiss: Esc/other-key/click, no
      residual), **ST-7** (menu precedence), **ST-8** (`revealKey` null/override), **ST-9**
      (collision = Alt order), **ST-10** (StatusLine Alt-item fires, Ctrl-chord does not).
- [x] P2.2 Run red — confirm all fail (no mode/intercept yet).

**Implement (green):**
- [x] P2.3 `event/types.ts`: `EventLoopOptions.revealKey?: string \| null` (default `'f12'`, `null`
      disables).
- [x] P2.4 `event/event-loop.ts`: `acceleratorMode` + `revealKey` state; `setAcceleratorMode(on)`
      (flips flag + `renderRoot.setRevealAccelerators`, inside `runTick`, AR-14); supply
      `acceleratorMode`/`toggleAcceleratorMode` in `routeContext()` (`:299-346`).
- [x] P2.5 `event/dispatch.ts`: add the two optional `RouteContext` fields (`:22-59`) and the
      intercept step at `:129` — toggle on `revealKey`; when armed, Esc dismisses, a plain single
      letter dismisses-then-re-dispatches as `{...inner, alt:true}` (03-02), any other key dismisses
      and passes through. Add mouse-branch dismiss (`:147-151`).
- [x] P2.6 Menu precedence (AR-7): `setAcceleratorMode(false)` when a MenuBar menu opens
      (`menu/controller.ts` open path or the app wiring).
- [x] P2.7 Run green — all Phase-2 specs pass; full `packages/ui` unit suite green.

**Impl tests:**
- [x] P2.8 `accelerator-fire.impl.test.ts` — **IT-1** (re-entrancy: synth-alt can't re-arm),
      **IT-5** (armed `f` opens the File menu + dismisses), **IT-6** (no-match letter dismisses,
      no change).

## Phase 3 — Kitchen-sink story, docs, issue sync, verify

- [x] P3.1 Kitchen-sink story (AR-11): a dialog with `~O~pen`/`~C~ancel` buttons + a `~N~ame` Label +
      a small menu; blurb explains F12; register in `stories/index.ts`. Extend
      `kitchen-sink.smoke.spec.test.ts` to arm reveal and assert a hot glyph gains `Attr.underline`.
- [x] P3.2 Packaging spec **ST-11** — `DrawContext.revealAccelerators` + `EventLoopOptions.revealKey`
      exist; assert **no** new `@jsvision/core` export (AR-15).
- [x] P3.3 Full **`yarn verify` + `yarn lint`** (AR-12).
- [x] P3.4 Update GH #41 (reveal shipped) and #40 (reliability path shipped via arm-to-fire); close if
      appropriate. Add a follow-up roadmap note (AR-6). Note the OUT-of-scope items (Kitty hold-Alt
      DEF-1; StatusLine Ctrl-chord fire; #6 duplicate warning).

**Verify**: `yarn verify` + `yarn lint`
