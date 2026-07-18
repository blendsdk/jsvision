# RD-04: Non-functional (performance, packaging, security, testing, gates)

- **Priority:** Must
- **Depends on:** RD-01…03
- **Status:** Drafted

## Summary

The cross-cutting guarantees for the code-grade editor: the performance NFR and its **validation
probe** (the one empirical value the lost spike owed us), the packaging + zero-dep discipline, the
security posture for hostile file content, and the testing/showcase/doc gates. This RD is where the
soft-cap threshold value (AR-19) gets *measured*, not guessed.

## Functional requirements

### FR-4.1 — Performance NFR (informational, off-CI, non-gating) *(AR-07)*
Mirroring the house RD-10 pattern: on the dev box, for a **below-cap** file, a keystroke's
**edit + viewport reparse + redraw completes < 16 ms**, and the whole-document parse runs **off-frame**
(time-budgeted slices) so no single frame is blocked. Asserted **off-CI only** (skipped under
`CI` / `TUI_SKIP_PERF`); it **never gates** the build — consistent with jsvision's "perf never gates".

### FR-4.2 — The scoped validation probe (early build task) *(AR-07, AR-19)*
A **scoped, committed** probe — run right after RD-01/RD-02 stand up the seam — that measures:
1. the **buffer → Lezer `Input`** incremental feed (correctness + fragment reuse), and
2. **parse/highlight timing across file sizes**,
and from (2) **sets the soft-cap threshold value** (AR-19) used by RD-03 FR-3.10. It lands as tracked,
committed code (not a throwaway spike) so its numbers can't be lost again. It is not a 9-probe
re-spike — just this one question.

### FR-4.3 — Packaging & zero-dep discipline *(AR-00b, AR-09)*
- `@jsvision/core` and `@jsvision/ui` keep **`{}` runtime deps**; `check:deps` stays clean. The only
  package carrying deps is `@jsvision/lang` (`@lezer/*`, pure-JS).
- `@jsvision/lang` and `@jsvision/editor` join the **lockstep-version set** (`sync-package-versions`);
  both are ESM-only, NodeNext `.js` specifiers, single-barrel `src/index.ts`, explicit named
  re-exports; files target 200–500 lines (≤ 700 hard).
- Additive-only cross-package surface: the RD-01 core additions are additive; no breaking change to
  any shipped API.

### FR-4.4 — Security posture *(AR-18)*
- **Hostile file/paste content is the headline vector.** Every drawn cell — highlighted, folded, or
  plain — routes through core's write-time **`sanitize`** boundary (the existing editor rule, extended
  to highlighted/folded rendering), so no control sequence in a file reaches the terminal.
- `@jsvision/lang` parses buffer **strings** only: **no `eval`**, no code execution, no filesystem or
  network access. Malformed/hostile UTF-8 must never crash a parse, a highlight query, or a fold.
- **Supply chain:** the `@lezer/*` deps are pinned (lockfile) and pure-JS (`check:deps`); adding a
  grammar is a reviewed dependency addition.
- File I/O stays behind the `@jsvision/files` `FileSystem` seam (unchanged); this feature adds no new
  fs surface.

### FR-4.5 — Testing strategy *(spec-first; AR-01…12)*
- **Spec oracles** (`*.spec.test.ts`, immutable): the tag→bucket mapping and fold ranges for **JSON**
  and **TS/JS** on fixed sample documents; the gutter-width/geometry math; the soft-cap degrade
  behaviour; sanitize-at-draw for hostile content.
- **Impl tests** (`*.impl.test.ts`): incremental reparse/fragment reuse, `pending()` progression,
  fold row-flow removal, keymap resolution for Tab/Shift+Tab + the extended Ctrl-K fold entries.
- **Kitchen-sink smoke** (mandatory): the JSON + TS/JS stories mount headlessly and paint (RD-03
  FR-3.12).
- **e2e** where feasible: a headless walkthrough (open → highlight appears → fold/unfold → comment
  toggle → indent) as an ASCII-frame demo.

### FR-4.6 — Documentation gates *(JSDoc standard)*
Every public/exported symbol across `@jsvision/core` (new seam types/roles), `@jsvision/lang`, and
`@jsvision/editor`'s new API carries JSDoc with a real, copy-pasteable **`@example`**; no CodeOps/TV-C++
provenance in shipped code; `check:docs` passes.

## Acceptance criteria

- [ ] The perf spec asserts the < 16 ms below-cap keystroke frame off-CI and **skips under `CI`/`TUI_SKIP_PERF`**; it never fails the build.
- [ ] The validation probe is committed, measures the buffer→`Input` feed + timing, and **records a chosen soft-cap threshold** that RD-03 FR-3.10 consumes.
- [ ] `check:deps` passes; `@jsvision/core` + `@jsvision/ui` `package.json` runtime deps are `{}`; `@jsvision/lang` carries only `@lezer/*` (+ core). `sync-package-versions --check` passes with `lang` + `editor` in the set.
- [ ] A buffer/terminal line containing `\x1b]0;x\x07` + C0 bytes renders as inert cells with highlighting active (no escape reaches the stream) — asserted at the serialize level.
- [ ] Malformed UTF-8 / lone surrogates in a buffer never crash a parse, highlight, or fold (fuzz/edge spec).
- [ ] `yarn verify` (lint + typecheck + build + test + check:docs) is green; the kitchen-sink smoke passes; all new/changed files ≤ 700 lines.
- [ ] `check:docs` passes: every new public export has an `@example`; no banned provenance refs.

## Out of scope
Feature behaviour (RD-01…03). Publishing/release mechanics (existing pipeline). CI matrix changes
(none needed). The deferred features (#104–#107).

## Traceability
AR-00b, AR-01, AR-04, AR-07, AR-09, AR-18, AR-19.
