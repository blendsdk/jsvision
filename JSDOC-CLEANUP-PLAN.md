# JSDoc & Code-Comment Cleanup Plan

> Systematically rewrite every JSDoc and code comment in shipped source (`packages/*/src`) so it
> serves **framework users and AI agents**, not maintainers. Governed by the
> **"Documentation for users & AI agents (NON-NEGOTIABLE)"** directive in `AGENTS.md`.
>
> **This plan lives outside `codeops/`** deliberately — `codeops/` is being removed, so the plan that
> purges references to it cannot depend on it.

---

## 1. Objective & definition of done

Transform the docs from maintainer-facing to consumer/agent-facing. The work is **complete** when:

1. `scripts/check-jsdoc.mjs` is **green** across `packages/*/src`, meaning:
   - **Zero** banned references anywhere in shipped code (JSDoc _and_ `//`/`/* */` comments):
     `RD-`/`PA-`/`AR-`/`PF-`/`HR-`/`GATE-`/`AC-`/`ST-`/`ADR-`/`DEF-` codes, `codeops|plans|requirements` paths,
     and TV/C++ provenance (`t*.cpp`/`*.h` citations, `getColor(N)` palette archaeology).
   - **Every public export** (each symbol re-exported from a package `index.ts`) has a lead sentence,
     `@param`/`@returns` where applicable, and an **`@example`**.
2. Above-junior logic carries short _why_ comments a junior developer can follow.
3. `yarn verify` passes (the guard is wired into it) and CI enforces it on every PR.

**Scale (measured):** ~193 of 195 source files carry banned references (~2,730 code occurrences +
693 C++ citations). This is effectively a whole-codebase pass.

**Scope boundary:** shipped source only. Out of scope — `AGENTS.md`, `codeops/`, `test/**`. Example
code (`packages/examples/**`) follows the spirit but is not gated by the guard.

---

## 2. The rewrite rules (what "good" looks like)

### 2.1 The banned → rewritten transform (semantic, not mechanical)

The codes annotate _real behavior_. **Keep the behavior, drop the code.** Never blind-delete a
sentence.

| Before (maintainer)                                                                   | After (user/agent)                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Command emitted via ev.emit on activation (PA-1).`                                   | `Command name emitted when the button is activated.`                            |
| `index is DISPLAY order, item the T (PF-003).`                                        | `Called on selection; index is the display-order row, item the selected value.` |
| `Faithful to TButton::drawState (tbutton.cpp:102-165). cShadow = getColor(8) = 0x70…` | _(delete entirely — provenance, no user value)_                                 |
| `The overlay's visibility (RD-14 PA-5/PF-001)…`                                       | `The overlay is visible whenever it hosts a popup, hidden otherwise.`           |

### 2.2 The public-symbol JSDoc template

Every symbol re-exported from an `index.ts` gets:

```ts
/**
 * <One lead sentence: what it is / does, in plain language.>
 *
 * <Behaviors, constraints, and gotchas a caller must know — ordering rules,
 *  reactive-vs-imperative seams, footguns. Only what a USER needs.>
 *
 * @param <name> <what it is and any constraint>
 * @returns <what comes back, and when>
 * @example
 * <realistic, copy-pasteable usage — correct enough to paste and run>
 */
```

Per symbol kind:

- **Component class** (`Button`, `DataGrid`) — lead = what the widget is + primary interaction;
  `@example` = construct + add to a parent + bind a signal.
- **Options interface** (`ButtonOptions`) — lead = "Options for `X`."; document each field inline;
  the worked `@example` lives on the class, not repeated here.
- **Factory / function** (`createApplication`, `filter`) — lead = what it produces; full
  `@param`/`@returns`; `@example` = the call in context.
- **Pure helper** (`addDays`, `nearest16`) — lead = the transform; `@example` = input → output.

### 2.3 Code comments (the above-junior rule)

Add a short _why_ comment where a junior would stall: non-obvious algorithms, invariants, subtle
ordering/lifecycle rules (e.g. "`bind()` must run in `onMount` because the reactive scope doesn't
exist in the constructor"), and deliberate performance choices. Trivial lines get nothing. No
maintainer traceability.

---

## 3. Phase 0 — the guard, first (red → green infrastructure)

Build the enforcement **before** touching a single doc, so it produces the objective worklist and
becomes the regression gate. Expect it to fail across ~193 files on first run — that is the point.

### 3.1 `scripts/check-jsdoc.mjs` specification

**Inputs:** all `*.ts` under `packages/*/src` excluding `*.test.ts`.

**Check A — banned references (whole file, comments only):**

- Strip string/template literals, then scan comment ranges for:
  - `/\b(RD|PA|AR|PF|HR|GATE|AC|ST|ADR|DEF)-\d+/`
  - `/\b(codeops|plans|requirements)\//`
  - `/\b[a-z][a-z0-9]*\.(cpp|h)\b/` (TV/C++ source refs) and `/getColor\s*\(/` inside comments
- Report `file:line: banned reference "<match>"`.

**Check B — `@example` on public exports:**

1. Resolve the **public set**: parse each `packages/<pkg>/src/index.ts`, follow its `export { … } from`
   / `export * from` re-exports to the declaring symbol.
2. For each public symbol's declaring JSDoc block, require an `@example` tag (and a non-empty lead
   line). Report `file:line: public export "<name>" missing @example`.
   - _Note on `export *`:_ `reactive/index.ts` uses `export *` — expand it to concrete names so
     nothing slips through. (Also a good moment to consider converting it to explicit named exports
     for consistency, but that's optional and separate.)

**Behavior:** exit non-zero with a grouped, per-file report on any violation. Support
`--summary` (counts only) so progress is trackable during the cleanup.

**Optional hardening (recommended):** verify `@example` snippets **type-check** — extract each
`@example` body into a temp `.ts` that imports from the built package and run `tsc --noEmit`. This is
what makes examples trustworthy for agents. Can start as a warning, become an error later.

### 3.2 Wiring

- `packages/*/package.json`: add `"check:docs": "node ../../scripts/check-jsdoc.mjs <pkgDir>"`.
- `turbo.json`: add a `check:docs` pipeline entry.
- Root `package.json`: add `check:docs` and fold it into `verify` (`turbo run typecheck build test check:docs`).
- `.github/workflows/ci.yml`: run `yarn check:docs` (or rely on `verify`).
- Enable `"stripInternal": true` in `tsconfig.base.json` (harmless now; useful later).

### 3.3 Establish the shared assets

- Commit the JSDoc template (§2.2) into `packages/docs-site/reference/guides/development.md` (or a short `CONTRIBUTING` note).
- Run `node scripts/check-jsdoc.mjs --summary` and capture the baseline counts per package — the
  burn-down target.

---

## 4. Phases 1..N — systematic cleanup, batched by subsystem

Each subsystem is an **independent unit**: rewrite public JSDoc, strip banned refs, add above-junior
comments, then `check:docs` for that directory must go green. Ordered by how much a
user/agent touches the API (highest-traffic first).

> **Every phase's per-file checklist:**
>
> 1. Rewrite the file-header JSDoc for a consumer (drop plan/C++ archaeology).
> 2. For each public export: lead sentence → behaviors/gotchas → `@param`/`@returns` → **`@example`**.
> 3. Rewrite banned-code sentences semantically (keep meaning, drop code); delete pure provenance.
> 4. Add _why_ comments to above-junior logic; delete maintainer traceability comments.
> 5. `node scripts/check-jsdoc.mjs packages/<pkg>/src/<dir>` → green.
> 6. `yarn typecheck` (examples must still compile) and spot-run the example.

### `@jsvision/ui` (146 files) — user-facing first

| Phase | Subsystem (dir)                                                                         | Why this order                                                       |
| ----- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1     | `controls/` (Button, Input, Label, CheckGroup, RadioGroup, MultiCheckGroup, validators) | The most-used leaf widgets; highest doc traffic.                     |
| 2     | `view/` + `reactive/`                                                                   | The authoring + reactivity contracts every custom widget depends on. |
| 3     | `event/` + `app/` + `desktop/` + `window/` + `menu/` + `status/`                        | The app-shell surface (`createApplication`, commands, modality).     |
| 4     | `dialog/` + `scroll/` + `list/` + `dropdown/`                                           | Containers, scrolling, lists, dropdowns.                             |
| 5     | `table/` + `tree/` + `tabs/`                                                            | Data/navigation components.                                          |
| 6     | `date/` + `color/` + `feedback/` + `surface/`                                           | Pickers, feedback, surface.                                          |
| 7     | `editor/` + `terminal/` + `layout/` + top-level `index.ts`                              | Editor family, layout primitives, the barrel.                        |

### `@jsvision/core` (47 files) — the leaked-into-UI path matters most

| Phase | Subsystem (dir)                                                                   | Notes                                                                      |
| ----- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 8     | `capability/` + `color/` (`resolveCapabilities`, `Attr`, `Style`, `toRgb`, theme) | These leak into every UI app — prioritize.                                 |
| 9     | `input/` + `render/`                                                              | Decoder + rendering primitives (`ScreenBuffer`, `serialize`, `charWidth`). |
| 10    | `host/` + `safety/` + top-level `index.ts`                                        | Host lifecycle, errors/logger, the barrel.                                 |

---

## 5. Execution model

The phases are independent, so this parallelizes cleanly:

- **Recommended:** one subagent per subsystem (Phase 1..10), each handed §2's rules + §4's checklist,
  each gated by `check:docs` going green for its directory. A subagent returns only when its slice is
  green and `typecheck` passes. This is a natural multi-agent fan-out; if you want it run as an
  orchestrated workflow, say so and I'll drive it.
- **Alternatively:** work the phases sequentially, committing per subsystem (`docs(<subsystem>): …`).
- **Commit granularity:** one commit per phase keeps the burn-down reviewable and easy to revert.
- **Guard discipline:** never mark a phase done on a hand-wave — the objective signal is
  `node scripts/check-jsdoc.mjs packages/<pkg>/src/<dir>` returning zero violations.

---

## 6. Risks & gotchas

- **Examples must be correct** — agents will trust and paste them. This is why §3.1 recommends
  type-checking `@example` bodies. A wrong example is worse than none.
- **Semantic rewrite, not regex delete** — the codes tag real behavior; a naive `sed` that strips
  `(PA-3)` and leaves a dangling clause, or deletes whole useful sentences, degrades the docs. Human/
  agent judgment per sentence is required.
- **`export *` in `reactive/index.ts`** complicates the public-set detection (§3.1 Check B) — expand
  it explicitly in the guard.
- **Existing 16 `@internal` blocks** — decide their fate per the directive: if they contain banned
  provenance, purge it; `@internal` is not an exemption from the ban (it only hides from published
  types).
- **Don't break the examples package** — `packages/examples/**` imports these symbols; run
  `yarn typecheck` after each phase so a doc edit that accidentally changes a signature is caught.
- **File-header JSDoc** is the densest jargon (whole paragraphs of RD/PA history) — budget the most
  rewrite time there; it's also the highest-value fix since it's the first thing a reader sees.

---

## 7. Effort & sequencing

- **Phase 0 (guard):** ~half a day — small, self-contained, unblocks everything and makes progress
  measurable.
- **Phases 1–10 (cleanup):** the bulk. ~193 files, but highly regular per the checklist; the
  `@example` authoring is the real cost (~200 examples). Parallelized across subagents by subsystem,
  this is a small number of focused passes rather than one monolithic slog.
- **Sequencing:** Phase 0 must land first (it's the gate). Phases 1–10 can then run in parallel;
  merge order doesn't matter because each is independently green.

---

## 8. Expected DX gain

This is the single highest-leverage initiative from the DX assessment (`DX-ASSESSMENT.md`):

- **Docs / discoverability dimension: 3 → ~8.**
- **Overall framework DX: ~6.0 → ~7.0–7.3** from this initiative alone.
- **Agent-assisted development:** the largest practical win — clean, example-first, jargon-free JSDoc
  lets an AI agent (or a new human) write correct code on the first try instead of spelunking source.
- **Zero rendered glyphs and zero architecture touched** — pure documentation + comment work, gated
  by a mechanical guard that keeps it from ever rotting back.
