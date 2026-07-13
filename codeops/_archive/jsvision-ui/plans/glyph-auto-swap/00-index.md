# Glyph Auto-Swap Fallback Implementation Plan

> **Feature**: Probe-driven ASCII-safe chrome — wire the ambiguous-width CPR probe result into
> the host's effective capabilities so wide-rendering terminals automatically get aligned ASCII
> chrome, plus the explicit `JSVISION_ASCII` force switch.
> **Status**: Planning Complete
> **Created**: 2026-07-02
> **Implements**: jsvision-ui/DEF-23
> **CodeOps Skills Version**: 3.1.0

## Overview

The RD-11 follow-up width probe (commit `217f9ea`) measures — via a Cursor-Position-Report —
whether the terminal renders our East-Asian-Ambiguous chrome glyphs (`▲▼◄►…`) double-width
(font fallback for missing glyphs, or a CJK/ambiguous-width locale). Today the result only
produces a one-line stderr warning and the UI then renders sheared anyway. This plan closes the
loop: the probe result flips the host's *effective* serialize capabilities so `fallbackGlyph`
substitutes ASCII-safe chrome, turning "warn and render broken" into "detect and render
correct" — with zero changes to app code and zero ui rendering changes (the `ScreenBuffer`
always stores the real Unicode glyph; substitution is serialize-time, per the RD-04 design).

Three pieces: (1) a new `glyphs.ambiguousWide` capability flag gating a new 8-entry ASCII
fallback map in `fallbackGlyph` (AR-5/7); (2) the probe amended to measure **two groups** —
arrow/geometric chrome vs box-drawing/shade — so each flips only the flags it implicates
(AR-6/16); (3) host wiring: an additive `adaptAmbiguousWidth` option (core default off, ui
default on, mirroring `warnAmbiguousWidth`), the `JSVISION_ASCII` host-level force switch, and
two warning-message variants (AR-9/10/15). The deferred follow-ups from `217f9ea` are finally
tracked: DEF-23 (this plan) and DEF-24 (in-app warning visibility, stays deferred) per AR-11.

## Document Index

| #   | Document                                       | Description                                 |
| --- | ---------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (17, audit trail) |
| 00  | [Index](00-index.md)                           | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)             | Feature requirements and scope              |
| 02  | [Current State](02-current-state.md)           | Analysis of the shipped probe + fallback    |
| 03  | [Core Glyph Swap](03-01-core-glyph-swap.md)    | Technical spec: flag, map, probe, host, ui threading |
| PF  | [Preflight Report](00-preflight-report.md)     | Codebase-grounded audit — 7 findings, all resolved |
| 07  | [Testing Strategy](07-testing-strategy.md)     | ST-01…ST-16 spec oracles + verification     |
| 99  | [Execution Plan](99-execution-plan.md)         | 4 phases, task checklist                    |

## Quick Reference

### Usage Examples

```ts
// App code: nothing changes. ui's createApplication threads adaptAmbiguousWidth
// (default true) exactly like warnAmbiguousWidth — a wide-rendering terminal
// now gets aligned ASCII chrome automatically.

// Core host, explicit:
const host = createHost({ caps, adaptAmbiguousWidth: true });

// End-user force switch (any value, NO_COLOR-style presence):
//   JSVISION_ASCII=1 yarn workspace @jsvision/examples demo:kitchen
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Where the probe result acts | Host-side effective caps (serialize only) | AR-4 |
| Capability flag | `glyphs.ambiguousWide`, default `false` | AR-5 |
| Probe granularity | Two groups: arrows→`ambiguousWide`; boxes→`boxDrawing`/`halfBlocks` off | AR-6 |
| Swap map | ncurses-style `^ v < > * ^ v x` | AR-7 |
| Force switch | `JSVISION_ASCII`, host-level, presence = on | AR-8/15 |
| Host option | `adaptAmbiguousWidth` (core off, ui on) | AR-9/17 |
| Probe API evolution | Amend `probeAmbiguousWidth`/`WidthProbeResult` in place; oracles updated with approval | AR-16 |
| Probe skip | Skipped when caps already fully ASCII-safe | AR-13 |

## Related Files

Modified (core): `packages/core/src/engine/capability/{profile,defaults}.ts`,
`render/glyphs.ts`, `host/{width-probe,types,host,signals,index}.ts` (signals: the SIGCONT
resume repaint switches to effective caps, PF-001), `src/engine/index.ts`.
Modified (ui, additive threading only): `packages/ui/src/app/{run,application}.ts`.
Tests: `packages/core/test/glyph-swap.{spec,impl}.test.ts` (new),
`width-probe.{spec,impl}.test.ts` (amended per AR-16),
`host-width-adapt.{spec,impl}.test.ts` (new), `host-width-warn.impl.test.ts` (amended),
`packages/ui/test/app-shell.adapt.spec.test.ts` (new).
Docs: `CHANGELOG.md`, `codeops/features/jsvision-ui/requirements/DEFERRED.md` (DEF-23/24).
