# Runtime Hardening Implementation Plan

> **Feature**: RD-13 runtime hardening & defect remediation — audit-surfaced correctness, fidelity & lifecycle fixes
> **Status**: Planning Complete
> **Created**: 2026-07-02
> **Implements**: jsvision-ui/RD-13
> **CodeOps Skills Version**: 3.1.0

## Overview

Remediates the 2026-07-02 five-agent deep audit's confirmed-defect backlog ([RD-13](../../requirements/RD-13-runtime-hardening.md)):
**3 critical** (hostile-UTF-8 stdin crash · modal mouse offset · use-after-dispose resurrection),
**12 major** (DCS keystroke leak, C0 in the cell grid, logger-on-UI, glyph capability gap,
dead `close` command, hot inactive-frame zones, dangling focus, detached `isFocusable`, dropped
mid-flush invalidations, `addDynamic` leak, stale gestures), and **~20 minor** correctness/TV-fidelity
gaps across the decoder, renderer, reactive core, view/render root, event loop, app shell, controls,
and containers.

No new features or subsystems: the plan edits shipped code in place, spec-first per HR-NN
(RED→GREEN→impl), with the critical trio additionally fuzz/property-locked and every TV-fidelity
item behind a GATE-1 decode / GATE-2 diff against the original C++ (the `.cpp` outranks our
oracles). 10 phases, ordered by blast radius per the RD's closing note (PA-19).

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | ✅ GATE PASSED — 19 decisions (11 user PA-1…11 + 8 dominant PA-12…19) |
| 00 | [Index](00-index.md) | This document |
| 01 | [Requirements](01-requirements.md) | Scope, tiers, decisions table, AC-1…AC-10 |
| 02 | [Current State](02-current-state.md) | Defect→file map, verified evidence, risks |
| 03-01 | [Core input decoder](03-01-core-input-decoder.md) | HR-01, 04, 16, 22, 23, 24 |
| 03-02 | [Core render & output](03-02-core-render-output.md) | HR-05, 17, 18, 19, 20, 21, 25 |
| 03-03 | [Core safety/capability/host](03-03-core-safety-capability-host.md) | HR-06, 07, 15, 26 |
| 03-04 | [Reactive core](03-04-reactive-core.md) | HR-03, 13, 27, 28, 29 |
| 03-05 | [View / render root](03-05-view-render.md) | HR-12, 30, 31, 32, 33, 34 |
| 03-06 | [Event loop & focus](03-06-event-loop-focus.md) | HR-02, 10, 11, 38, 39, 42 |
| 03-07 | [App shell](03-07-app-shell.md) | HR-08, 09, 14, 35, 36, 37, 40, 41 (GATE) |
| 03-08 | [Controls & input editor](03-08-controls-input.md) | HR-43…48, 52, 54…60 (GATE) |
| 03-09 | [Containers & lists](03-09-containers-lists.md) | HR-49…51, 53, 61, 62 (GATE) |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST oracles per AC group; spec/impl file map |
| 99 | [Execution Plan](99-execution-plan.md) | 10 phases / 29 sessions / 120 tasks |

## Quick Reference

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Plan shape | Single plan, phases mirror RD AC groups (PA-1) |
| Quit during modal | TV-faithful `endModal(quit)` cascade, `valid()` veto (PA-2) |
| `ESC ESC` | Alt+Escape same-chunk; flush path yields two escapes (PA-3) |
| Env branding | `JSVISION_DEBUG`/`JSVISION_LOG`, no alias (PA-4) |
| C0 at the grid | one space per control char (PA-5) |
| Logger-on-UI | `'auto'`→ring fallback; explicit stderr throws (PA-6) |
| Clipboard | exact bytes, base64-framed (PA-7) |
| Visibility | `invalidate()` honors flips both directions (PA-8) |
| Glyph caps | env layer (UTF-8 locale); all 3 demos drop overrides (PA-9) |
| Focus re-home | next focusable, else null (PA-10) |
| Full table | [01-requirements.md → Scope Decisions](01-requirements.md) (PA-11…PA-19) |

### Fidelity gates

Phases 4/7/8/9 carry BEFORE-decode / AFTER-diff task pairs per
[`codeops/tv-fidelity-gate.md`](../../../../tv-fidelity-gate.md) against
`/home/gevik/workdir/github/tvision` (`tframe`, `tmenuview`, `tprogram`/`tgroup`, `tinputli`,
`tbutton`, `tcluster`, `tstatict`, `tscrlbar`, `tlstview`, `tscrolle`).

## Related Files

- Modified: ~30 source files across `packages/core/src/engine/{input,render,safety,capability,host}/`
  and `packages/ui/src/{reactive,layout,view,event,desktop,window,menu,status,controls,scroll,list,dialog}/`
  (full map in [02-current-state.md](02-current-state.md)).
- New tests: 10 `*-hardening.{spec,impl}.test.ts` pairs (map in [07-testing-strategy.md](07-testing-strategy.md)).
- New dev script: EAW WIDE-table generator (PA-18). Demos: 3 `main.ts` override removals.
- Governance: `CHANGELOG.md` backfill + RD-13 entries.

**To begin implementation:** run the exec_plan skill on `runtime-hardening`.
