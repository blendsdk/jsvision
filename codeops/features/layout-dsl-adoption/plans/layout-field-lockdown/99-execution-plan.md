# Execution Plan: layout-field-lockdown

> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.11.0
> **Last Updated**: 2026-07-20
> **Progress**: 0/46 tasks (0%)

> **Execution rules**
> 1. Specification-first: spec tests → red → implement → green → impl tests → verify.
> 2. Mark `[~]` on implementation, `[x]` only after verify passes.
> 3. Update Progress + Last Updated after EVERY task — never batch.
> 4. Verify command: `yarn verify` (AR-12).
> 5. If a detail is not covered here or in the register, STOP and ask — never guess.

---

## Phase 1: Typecheck coverage (#132 + the repo-wide gap)

> **Reference**: [03-01](03-01-typecheck-coverage.md) · **Routing**: standard
> **Objective**: FR-1…FR-4. 206 errors across ~121 files.

### Step 1.1 — Spec tests

- [ ] 1.1.1 [spec-author] ST-1, ST-2, ST-3 — the coverage gate and its demonstrated failure. ST-2 must inject, observe failure, and revert

### Step 1.2 — Turn coverage on

- [ ] 1.2.1 `packages/examples`: `include: ["**/*.ts"]`. Expect ~53 errors — do not fix yet, record the list
- [ ] 1.2.2 Add `tsconfig.typecheck.json` (`rootDir: "."`, `include: ["src","test"]`) + script change to `ui`, `core`, `web`, `files`, `forms`. **`rootDir: "."` is load-bearing** — `"src"` yields 606 phantom `TS6059`, omitting it yields `TS2209` that hides 80 real errors
- [ ] 1.2.3 `docs-site`: add `test/**/*.ts` to its existing include
- [ ] 1.2.4 `theme-designer`: confirm it has no `test/`; no change expected

### Step 1.3 — Clear the errors

- [ ] 1.3.1 The `.mjs` seam: 8 hand-written `.d.mts` files (AR-5). Declare only the surface the tests consume. Expect the 14 `TS7016` **and** most of the 14 `TS7006` to fall together
- [ ] 1.3.2 `examples` — the remaining ~25 errors, excluding the latent-defect set
- [ ] 1.3.3 `ui/test` — 80 errors / 50 files
- [ ] 1.3.4 `core/test` — 65 errors / 32 files (18 in `input-demux.spec`, 16 in `input-responses.impl`)
- [ ] 1.3.5 `files/test` (3) and `web/test` (0 — confirm)
- [ ] 1.3.6 The latent defects, **one verdict each** — 4× `TS2722` + `TS2554` + `TS2345` + 2× `TS2740` in `examples/test`, 4× `TS2322` + `TS2739` in `forms/test`. Record *fixture wrong* or *assertion weaker than it reads*; no blanket non-null assertions
- [ ] 1.3.7 Cross-package test imports that cannot resolve: follow datagrid's documented `exclude` precedent, with a comment saying why

### Step 1.4 — Accept

- [ ] 1.4.1 ST-2 in anger: break a demo entry, confirm `yarn typecheck` fails, revert
- [ ] 1.4.2 Measure the `turbo typecheck` wall-clock delta and record it
- [ ] 1.4.3 Full verify

**Verify**: `yarn verify`

---

## Phase 2: The lockdown (#117-P4)

> **Reference**: [03-02](03-02-layout-field-lockdown.md) · **Routing**: sensitive (core engine)
> **Objective**: FR-5…FR-8. 816 conversions, then the flip.

### Step 2.1 — Spec tests

- [ ] 2.1.1 [spec-author] ST-4, ST-5, ST-6 — merge, single reflow, and the `Object.assign` identity contract
- [ ] 2.1.2 [spec-author] ST-7, ST-8 — the **type-level** ratchet. These are the only guard against a future edit silently dropping `readonly`, because `readonly` is erased at runtime. Must compile only because the error is expected

### Step 2.2 — Convert shipped source (113 sites)

- [ ] 2.2.1 `ui/src` wholesale writes (≈20 sites) — Rule 1. Flag any site that relied on replacement erasing a prop
- [ ] 2.2.2 `ui/src` rect mutations (8) — Rule 2, dropping the paired `invalidateLayout()`: `desktop/gestures.ts` (3), `window/window.ts` (3), `desktop/arrange.ts`, `editor/edit-window.ts`
- [ ] 2.2.3 `datagrid/src` (12; 8 of them in `grid-panels.ts`)
- [ ] 2.2.4 `docs-site` `src` + `examples` (5) · `theme-designer/src` (4)
- [ ] 2.2.5 `examples/**` non-test (61 across 30 files), including the 9 raw-spine teaching sites which convert but **stay absolute** (AR-8)

### Step 2.3 — Convert tests (703 sites)

- [ ] 2.3.1 `ui/test` — 474 sites / 147 files, by directory batch
- [ ] 2.3.2 `datagrid/test` — 167 / 75
- [ ] 2.3.3 `forms/test` (31) · `files/test` (18)
- [ ] 2.3.4 `examples/test` (6) · `docs-site/test` (4) · `web/test` (3)

### Step 2.4 — Flip

- [ ] 2.4.1 `view.ts`: `readonly layout: Readonly<LayoutProps>` + `setLayout` on `Object.assign`
- [ ] 2.4.2 The 10 subclass hatches → `override readonly layout: Readonly<LayoutProps>`
- [ ] 2.4.3 ST-7/ST-8 go green; confirm they were red against the pre-flip field

### Step 2.5 — Accept

- [ ] 2.5.1 AC-3 grep: 0 executable writes outside `spike-data-studio` and `setLayout`'s body
- [ ] 2.5.2 **AC-5** — re-run the discovery spike (flip + per-package `tsc`): **0 `TS2540`**
- [ ] 2.5.3 Full verify

**Verify**: `yarn verify`

---

## Phase 3: Canvas adoption (#129)

> **Reference**: [03-03](03-03-canvas-adoption.md) · **Routing**: standard, but design-heavy
> **Objective**: FR-9…FR-11. 18 sites / 8 canvases + 5 shadows.

### Step 3.1 — Baselines first

- [ ] 3.1.1 Capture cell-exact renders (glyph + fg/bg + attrs + width) for all 8 canvases at 80×24, after a build
- [ ] 3.1.2 [spec-author] ST-10, ST-11

### Step 3.2 — Convert

- [ ] 3.2.1 `dropdowns-demo` (6) — largest; per-file judgment on what is structurally flex
- [ ] 3.2.2 `containers-demo` (5)
- [ ] 3.2.3 `playground` (2) · `themes-demo` · `color-demo` · `date-demo` · `controls-live` · `status-bar.story` (1 each)
- [ ] 3.2.4 Confirm `tabs-demo` carries 0 sites and needs no conversion
- [ ] 3.2.5 The 2 `theme-designer` shadows — real conversions; call sites become `g.add(at(v, …))`
- [ ] 3.2.6 The 3 examples shadows — `keyboard-mouse-playground:126`, `analog-clock:70` (a polar helper, not a placer), `layout.story:30` (a rename)

### Step 3.3 — Accept

- [ ] 3.3.1 Re-render all 8; **a recorded verdict per canvas** — byte-identical, or an explained and accepted delta
- [ ] 3.3.2 AC-7 grep: no local binding shadows a DSL builder
- [ ] 3.3.3 Full verify

**Verify**: `yarn verify`

---

## Phase 4: Close-out

> **Routing**: trivial

- [ ] 4.1.1 Close #132, #117, #129 with measured close-out comments; note #131 remains open as the uncoupled lane
- [ ] 4.1.2 Roadmap sync + portfolio cascade; the epic #108 umbrella can close once #117 and #129 do
- [ ] 4.1.3 `yarn lint:fix`, commit what it changes, final `yarn verify` (prime directive)

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1  (#132 — the instrument: without it Phase 2 measures 57 of 113)
    ↓
Phase 2  (#117-P4 — compiler-driven; 816 conversions then the flip)
    ↓
Phase 3  (#129 — design work, wants both the compiler and the render control behind it)
    ↓
Phase 4  (close-out)
```

Phase 3 has no hard technical dependency on Phase 2, but runs after it so only one surface moves
at a time and so its canvases are already compiler-covered.

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Test typechecking surfaces more than 206 errors | 1 | Measured with the exact datagrid pattern; a delta is a finding, not a surprise |
| 816 edits swamp review | 2 | Batched by directory; each batch verifies and commits independently |
| A site relied on wholesale replacement erasing a prop | 2 | Rule 1 flags rather than assumes |
| A canvas is not structurally flex | 3 | It may stay absolute — record why; the compiler cannot decide this |
| `readonly` silently dropped later | — | ST-7/ST-8 are the only guard; runtime tests cannot catch it |
