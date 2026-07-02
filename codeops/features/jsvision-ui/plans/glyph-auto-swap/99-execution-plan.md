# Execution Plan: Glyph Auto-Swap Fallback

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-02
> **Progress**: 20/20 tasks (100%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Wire the ambiguous-width CPR probe into the host's effective serialize capabilities so
wide-rendering terminals automatically get aligned ASCII chrome (`glyphs.ambiguousWide` flag +
8-entry fallback map + two-group probe + host adapt/`JSVISION_ASCII` incl. the signals resume
repaint + ui threading). Spec docs: [03-01](03-01-core-glyph-swap.md); oracles:
[07](07-testing-strategy.md) (ST-01…ST-16; preflighted, see
[00-preflight-report.md](00-preflight-report.md)).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 1 | Capability flag + fallback map | 1 | ~2 h |
| 2 | Two-group probe (AR-16 amendment) | 1 | ~3 h |
| 3 | Host adapt + JSVISION_ASCII + ui threading | 1 | ~3–4 h |
| 4 | Governance, docs & gate | 1 | ~1–2 h |

**Total: 4 sessions, ~9–12 hours**

---

## Phase 1: Capability flag + fallback map

### Session 1.1 (compressed spec-first ordering)

**Reference**: [03-01 §1–2](03-01-core-glyph-swap.md) · **Objective**: `ambiguousWide` flag +
`AMBIGUOUS_FALLBACK` map, behavior-neutral by default.

| #     | Task | File |
| ----- | ---- | ---- |
| 1.1.1 | Write spec tests ST-01…ST-04 (MUST NOT read implementation) | `packages/core/test/glyph-swap.spec.test.ts` |
| 1.1.2 | Run them — verify RED | — |
| 1.1.3 | Implement: `GlyphCaps.ambiguousWide` + default `false` + the 8-entry map in `fallbackGlyph` | `capability/{profile,defaults}.ts`, `render/glyphs.ts` |
| 1.1.4 | Run spec tests — verify GREEN (fix code, never tests) | — |
| 1.1.5 | Impl tests: utf8-off interplay, `''` passthrough, existing render-glyphs cases green | `packages/core/test/glyph-swap.impl.test.ts` |

**Verify**: `yarn verify`

---

## Phase 2: Two-group probe

### Session 2.1

**Reference**: [03-01 §3](03-01-core-glyph-swap.md) · **Objective**: grouped
`probeAmbiguousWidth` + pure degrade helpers + both message texts (AR-6/10/16).

| #     | Task | File |
| ----- | ---- | ---- |
| 2.1.1 | Amend spec oracles to the grouped contract (ST-05…ST-07); cite AR-16 in the file header | `packages/core/test/width-probe.spec.test.ts` |
| 2.1.2 | Run them — verify RED | — |
| 2.1.3 | Implement: probe strings, `WidthProbeGroupResult`/`WidthProbeResult`, dual-CPR parse, `degradeCapsForWidth`/`degradeCapsFully`/`isAsciiSafe`, `WIDTH_ADAPTED_MESSAGE` + updated warn-only text, `warnIfAmbiguousWide` `adapted?` option | `host/width-probe.ts` |
| 2.1.4 | Run spec tests — verify GREEN | — |
| 2.1.5 | Amend impl tests: dual-CPR chunking, shared timeout, caps across two replies, cleanup write | `packages/core/test/width-probe.impl.test.ts` |

**Verify**: `yarn verify`

---

## Phase 3: Host adapt + JSVISION_ASCII + ui threading

### Session 3.1

**Reference**: [03-01 §4–5](03-01-core-glyph-swap.md) · **Objective**: effective-caps wiring,
probe skip, warn variants, ui default-on.

| #     | Task | File |
| ----- | ---- | ---- |
| 3.1.1 | Write spec tests ST-08…ST-13 + ST-15/ST-16 (host) and ST-14 (ui threading, probe-bytes observable per PF-005) | `packages/core/test/host-width-adapt.spec.test.ts`, `packages/ui/test/app-shell.adapt.spec.test.ts` |
| 3.1.2 | Run them — verify RED | — |
| 3.1.3 | Implement host: `HostOptions.adaptAmbiguousWidth`/`env`, effective-caps derivation (JSVISION_ASCII at create, adapt in `start()`), probe-skip (`isAsciiSafe`), warn-variant selection, `serialize` on effective caps, `getSerializeCaps` seam into `installSignals` + resume repaint on effective caps (PF-001) | `host/{types,host,signals}.ts` |
| 3.1.4 | Implement ui threading: `adaptAmbiguousWidth ?? true` mirroring `warnAmbiguousWidth` | `packages/ui/src/app/{run,application}.ts` |
| 3.1.5 | Run spec tests — verify GREEN | — |
| 3.1.6 | Impl tests: degrade-helper purity/frozen-caps, both-groups-wide, silent adapt, probe-throw startup; amend host-width-warn messages | `packages/core/test/host-width-adapt.impl.test.ts`, `host-width-warn.impl.test.ts` |

**Verify**: `yarn verify`

---

## Phase 4: Governance, docs & gate

### Session 4.1

**Objective**: exports, governance suites, tracking, full gate.

| #     | Task | File |
| ----- | ---- | ---- |
| 4.1.1 | Public exports for new/amended probe symbols (governance suites need no expectation edits — `api-stability.spec` asserts CHANGELOG/README headings only, PF-002) | `host/index.ts`, `src/engine/index.ts` |
| 4.1.2 | CHANGELOG entry (probe-API amendment per AR-16 + the new feature); document `JSVISION_ASCII=1 demo:kitchen` as the manual showcase (README note) | `CHANGELOG.md`, README |
| 4.1.3 | Tracking: flip DEF-23 → Shipped in DEFERRED.md (DEF-23/24 rows already registered at plan creation); roadmap DEF-23 row → Done | `codeops/features/jsvision-ui/requirements/DEFERRED.md`, `codeops/features/jsvision-ui/00-roadmap.md` |
| 4.1.4 | Full gate: `yarn verify` + `yarn workspace @jsvision/core test:e2e` + `yarn gate`; manual spot-check `JSVISION_ASCII=1 yarn workspace @jsvision/examples demo:kitchen` | — |

Commits per task group via **/gitcm** (mode owned by exec_plan).

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** single source of truth. Mark `[x]` + timestamp immediately after each
> task; update the Progress header every time; never batch; reconstruct from the phases above
> if missing.

### Phase 1: Capability flag + fallback map
- [x] 1.1.1 Spec tests ST-01…ST-04 (glyph-swap.spec) — 2026-07-02
- [x] 1.1.2 RED verified — 2026-07-02
- [x] 1.1.3 Implement flag + defaults + map — 2026-07-02
- [x] 1.1.4 GREEN verified — 2026-07-02
- [x] 1.1.5 Impl tests (glyph-swap.impl) — 2026-07-02

### Phase 2: Two-group probe
- [x] 2.1.1 Amend width-probe.spec to grouped contract (AR-16 cited) — 2026-07-02
- [x] 2.1.2 RED verified — 2026-07-02
- [x] 2.1.3 Implement grouped probe + helpers + messages — 2026-07-02
- [x] 2.1.4 GREEN verified — 2026-07-02
- [x] 2.1.5 Amend width-probe.impl (+ AR-R2 host-width-warn feed green-keep) — 2026-07-02

### Phase 3: Host adapt + JSVISION_ASCII + ui threading
- [x] 3.1.1 Spec tests ST-08…ST-16 (host-width-adapt.spec + app-shell.adapt.spec) — 2026-07-02
- [x] 3.1.2 RED verified — 2026-07-02
- [x] 3.1.3 Implement host wiring (incl. signals `getSerializeCaps`, PF-001) — 2026-07-02
- [x] 3.1.4 Implement ui threading — 2026-07-02
- [x] 3.1.5 GREEN verified — 2026-07-02
- [x] 3.1.6 Impl tests + host-width-warn amendments (RICH utf8:true per PF-003) — 2026-07-02

### Phase 4: Governance, docs & gate
- [x] 4.1.1 Exports (no governance-suite expectation edits needed, PF-002) — 2026-07-02
- [x] 4.1.2 CHANGELOG + JSVISION_ASCII showcase note (README) — 2026-07-02
- [x] 4.1.3 DEF-23 → Shipped + roadmap Done (DEF-24 stays deferred) — 2026-07-02
- [x] 4.1.4 Full gate: verify + core e2e + `yarn gate` all pass — 2026-07-02 (manual `JSVISION_ASCII=1 demo:kitchen` spot-check needs a real TTY — flagged to user; ST-12 proves the path headlessly)

---

## Dependencies

```
Phase 1 (flag + map — behavior-neutral)
    ↓
Phase 2 (probe groups + degrade helpers)
    ↓
Phase 3 (host + ui wiring uses both)
    ↓
Phase 4 (governance + gate)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed (AC-1…AC-8 in [01-requirements.md](01-requirements.md))
2. ✅ `yarn verify`, core `test:e2e`, and `yarn gate` all pass
3. ✅ No warnings/errors; no dead code (the old aggregate probe shape fully replaced, AR-16)
4. ✅ Security posture preserved (untrusted CPR parsing caps; JSVISION_ASCII presence-only)
5. ✅ CHANGELOG + DEFERRED.md + roadmap updated
6. ✅ Post-completion re-analysis (exec_plan skill)
