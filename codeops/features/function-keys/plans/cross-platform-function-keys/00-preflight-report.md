# Preflight Report: Cross-Platform Function Keys

> **Status**: PASSED — 17 findings resolved (0 critical, 12 major, 5 minor)
> **Iterations**: 3 (full scan, full corrective re-scan, bounded blocking-fix verification)
> **Artifact**: implementation plan at `codeops/features/function-keys/plans/cross-platform-function-keys/`
> **Graph Target / Gate**: `function-keys/PLAN-CROSS` / `audit`
> **Audited Content Hash**: `sha256:721e86c1ae4062348d9fafb7d354dc640266b2e79c406c6f8eb7c9e863d68e59`
> **Codebase Grounded**: core, UI, web, examples, plugin-impact, package scripts, and generated-distribution boundaries examined
> **Last Updated**: 2026-07-23

> **SAME-SESSION REVIEW:** This artifact was created in the current session. Same-agent bias risk
> was reduced with five independent scan clusters and one independent major-finding challenger.
> A fresh-session preflight remains available for maximum independence.

## Codebase Context Summary

**Tech Stack:** Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, Vitest, xterm.js 6.

**Architecture:** The core decoder owns byte-faithful terminal grammar; the UI event loop owns
application input policy; the web host bridges xterm.js events and bytes; generated SDK/plugin
material is synchronized from canonical sources.

**Key evidence:** `packages/core/src/engine/input/keys.ts`,
`packages/ui/src/event/event-loop.ts`, `packages/ui/src/app/application.ts`,
`packages/web/src/host.ts`, `packages/web/src/key-reclaim.ts`, `packages/web/src/mount.ts`,
`packages/examples/web-xterm/main.ts`, `tools/jsvision-plugin-impact.json`, and root verification
scripts.

Protocol grounding used the primary [xterm control-sequence
reference](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html), [Kitty keyboard
protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/), and [xterm.js Terminal
API](https://xtermjs.org/docs/api/terminal/classes/terminal/).

## Summary by Dimension

| # | Dimension | Findings | Final state |
|---:|-----------|---------:|-------------|
| 1 | Ambiguities | 1 | Resolved |
| 2 | Implicit Assumptions | 2 | Resolved |
| 3 | Logical Contradictions | 2 | Resolved |
| 4 | Completeness Gaps | 2 | Resolved |
| 5 | Dependency Issues | 1 | Resolved |
| 6 | Feasibility Concerns | 3 | Resolved |
| 7 | Testability | 3 | Resolved |
| 8 | Security Blind Spots | 1 | Resolved |
| 9 | Edge Cases | 3 | Resolved |
| 10 | Scope Creep Indicators | 3 | Resolved |
| 11 | Ordering & Sequencing | 1 | Resolved |
| 12 | Consistency | 2 | Resolved |
| 13 | Codebase Alignment | 4 | Resolved |

One finding may contribute to several dimensions.

## Summary by Severity

| Severity | Count | Status |
|----------|------:|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 12 | All resolved |
| 🟡 MINOR | 5 | All resolved |
| 🔵 OBSERVATION | 0 | — |

## Findings and Resolutions

### PF-001: Default boundary exceeded the approved shell scope 🟠 MAJOR

**Dimension:** Logical Contradictions / Codebase Alignment
**Location:** `01-requirements.md`, R4; `03-02-fallback-policy.md`, Public Contract
**Codebase Evidence:** `packages/ui/src/event/types.ts`; `packages/ui/src/app/application.ts`

The original plan defaulted every direct event loop to aliases-on, silently consuming existing Alt
bindings outside the application-shell boundary.

**Options:** Keep direct loops default-off and default `createApplication` on; or broaden the
breaking change to every direct loop.

**Recommendation:** Keep the compatibility boundary.

**User Decision:** Resolved — user pre-authorized the strongest recommendation. The plan now keeps
bare `createEventLoop` at `'none'` and defaults `createApplication` to `'number-row'`.

### PF-002: Browser aliases remained dependent on xterm.js encoding 🟠 MAJOR

**Dimension:** Completeness Gaps / Edge Cases
**Location:** `03-03-browser-integration.md`, Direct Function-Key Handling
**Codebase Evidence:** `packages/web/src/host.ts`

Delegating Alt aliases to `onData` preserved the OS/layout/encoder variance the fallback is meant
to remove.

**Recommendation:** Intercept exact Alt-only physical codes and dispatch literal raw Alt chords so
the UI policy and `'none'` opt-out remain authoritative.

**User Decision:** Resolved — strongest recommendation selected and specification tests added.

### PF-003: Strict CSI grammar and modifier domains were undefined 🟠 MAJOR

**Dimension:** Ambiguities / Security Blind Spots / Feasibility Concerns
**Location:** `03-01-terminal-decoder.md`, Classification Rules
**Codebase Evidence:** `packages/core/src/engine/input/keys.ts`

The existing numeric parser loses private markers, colon syntax, field boundaries, and
intermediates. Permissive modifier masking could also synthesize unsupported states.

**Options:** Preserve structured grammar metadata for the new F-key families; or add a duplicate
raw-byte validator dedicated to CSI-u.

**Recommendation:** Use one bounded structured parse for new F-key families. Accept legacy xterm
modifier values 1–16 and Kitty CSI-u values 1–8; reject unsupported syntax and bits.

**User Decision:** Resolved — challenger-confirmed recommendation selected with adversarial tests.

### PF-004: Plugin-impact review omitted `references/theming.md` 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** `03-04-documentation-and-distribution.md`, Distribution Governance
**Codebase Evidence:** `tools/jsvision-plugin-impact.json`

**Recommendation:** Require the exact deduplicated set reported by the impact tooling and name the
currently expected five references.

**User Decision:** Resolved — strongest recommendation selected.

### PF-005: Public packaging work targeted an unrelated immutable oracle 🟠 MAJOR

**Dimension:** Testability / Codebase Alignment
**Location:** `99-execution-plan.md`, Phase 4.1
**Codebase Evidence:** `packages/ui/test/accelerator.packaging.spec.test.ts`,
`packages/ui/test/event.packaging.spec.test.ts`, `packages/ui/test/app-shell.packaging.spec.test.ts`

**Options:** Add feature-owned packaging oracles; or extend aligned event/app-shell oracles.

**Recommendation:** Add feature-owned UI/web public-package oracles and leave the accelerator
oracle unchanged.

**User Decision:** Resolved — challenger-confirmed recommendation selected.

### PF-006: Full verification preceded required plugin synchronization 🟠 MAJOR

**Dimension:** Dependency Issues / Ordering & Sequencing
**Location:** `99-execution-plan.md`, phase verification gates
**Codebase Evidence:** root `package.json`; `scripts/check-plugin.mjs`;
`tools/jsvision-plugin-impact.json`

Each phase changes mapped source, while `yarn verify` includes `plugin:check`.

**Options:** Synchronize before every full phase gate; or use only focused gates until one final
sync.

**Recommendation:** Review impacts and run `plugin:update`/`plugin:check` before each phase-level
`yarn verify`, preserving committable checkpoints.

**User Decision:** Resolved — strongest recommendation selected.

### PF-007: Fake terminals did not prove the real xterm.js contract 🟠 MAJOR

**Dimension:** Testability
**Location:** `07-testing-strategy.md`; `99-execution-plan.md`, Phase 4
**Codebase Evidence:** `packages/examples/package.json`; `packages/examples/web-xterm/main.ts`

**Options:** Use the existing real xterm.js example for compile-time compatibility plus manual
Chromium/Firefox evidence; or add new browser-runner tooling.

**Recommendation:** Use the existing dependency and committed smoke evidence; avoid unrelated
browser-runner scope.

**User Decision:** Resolved — challenger-confirmed recommendation selected.

### PF-008: Reclaim refactor was broader than the feature 🟠 MAJOR

**Dimension:** Scope Creep Indicators
**Location:** `03-03-browser-integration.md`, Reclaim Coordination
**Codebase Evidence:** `packages/web/src/key-reclaim.ts`

**Recommendation:** Extract only F1–F12 classification and preserve all unrelated chord, wildcard,
focus, and capture behavior.

**User Decision:** Resolved — strongest recommendation selected.

### PF-009: Repeat and Meta input could synthesize destructive actions 🟠 MAJOR

**Dimension:** Edge Cases
**Location:** `03-03-browser-integration.md`, Structural Types and Direct Handling
**Codebase Evidence:** `packages/web/src/key-reclaim.ts`

**Recommendation:** Carry `repeat` and `metaKey`; do not synthesize direct events for either and
delegate them through the existing/unhandled path.

**User Decision:** Resolved — challenger-refined recommendation selected.

### PF-010: Acceptance criteria stopped at ST-17 🟡 MINOR

**Dimension:** Consistency
**Location:** `01-requirements.md`, Acceptance Criteria
**Recommendation:** Require ST-1 through ST-20.

**User Decision:** Resolved — strongest recommendation selected.

### PF-011: Linux-console current behavior was described incorrectly 🟡 MINOR

**Dimension:** Codebase Alignment
**Location:** `02-current-state.md`, Code Analysis
**Codebase Evidence:** `packages/core/src/engine/input/keys.ts`

**Recommendation:** State that `ESC[[A…E` drops the prefix and leaks the trailing printable letter.

**User Decision:** Resolved — corrected and directly re-verified.

### PF-012: Input-only normalizer was applied to `AppEvent` without narrowing 🟡 MINOR

**Dimension:** Feasibility Concerns / Edge Cases
**Location:** `03-02-fallback-policy.md`, Routing Order
**Codebase Evidence:** `packages/ui/src/event/event-loop.ts`; `packages/ui/src/view/types.ts`

**Recommendation:** Narrow to `event.type === 'key'` before normalization and test command identity.

**User Decision:** Resolved — strongest recommendation selected.

### PF-013: Diagnostics and numeric coverage goals were not enforceable 🟡 MINOR

**Dimension:** Testability / Scope Creep Indicators
**Location:** `01-requirements.md`, R10; `07-testing-strategy.md`, Coverage
**Codebase Evidence:** package test scripts

**Recommendation:** Make diagnostics documentation-only and use the enumerated behavior matrix
instead of introducing coverage/instrumentation tooling.

**User Decision:** Resolved — strongest recommendation selected.

### PF-014: xterm.js custom-handler singleton ownership was unspecified 🟠 MAJOR

**Dimension:** Feasibility Concerns / Edge Cases
**Location:** `03-03-browser-integration.md`, Structural Types and Reclaim Coordination
**Codebase Evidence:** xterm.js `attachCustomKeyEventHandler` implementation;
`packages/web/src/host.ts`

The hook replaces the previous handler and cannot restore it through a getter or disposable.

**Recommendation:** Make JSVision the active singleton owner, accept an optional downstream handler,
delegate every unhandled event using its boolean result, and document non-restoration.

**User Decision:** Resolved — applied in iteration 2; a residual return-value contradiction was
fixed and closed by bounded iteration-3 verification.

### PF-015: Corrected plan semantics left traceability snapshots stale 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** `codeops/features/function-keys/traceability.json`
**Codebase Evidence:** `codeops_state.py validate` and audit-readiness output

**Recommendation:** Refresh semantic revisions and dependent validation snapshots, then rerun both
gates.

**User Decision:** Resolved — graph validation and `audit` readiness pass with all 10 nodes.

### PF-016: Browser smoke evidence was created but not scheduled to run 🟠 MAJOR

**Dimension:** Testability
**Location:** `07-testing-strategy.md`; `99-execution-plan.md`, Phase 4.3
**Recommendation:** Add a distinct task that executes the named Chromium/Firefox checklist and
records date, OS, versions, and results before final verification.

**User Decision:** Resolved — task count is now 26 and bounded iteration-3 verification passed.

### PF-017: Changelog glob included unrelated packages 🟡 MINOR

**Dimension:** Scope Creep Indicators
**Location:** `99-execution-plan.md`, Task 4.2.1
**Recommendation:** Limit changes to the root and impacted core/UI/web changelogs.

**User Decision:** Resolved — bounded iteration-3 verification passed.

## Hardening and Final Verification

**Confidence:** High.
**Hardening:** Five independent dimension clusters, one independent challenger for the complete
major-finding batch, a full iteration-2 re-scan, and bounded iteration-3 checks for residual
blockers.

| Check | Result |
|-------|--------|
| 13-dimension iteration-1 scan | Completed |
| Independent major-finding challenge | Completed; recommendations refined |
| Full 13-dimension iteration-2 scan | Completed |
| Bounded iteration-3 residual checks | Passed |
| Traceability graph validation | Passed |
| Audit readiness for `function-keys/PLAN-CROSS` | Passed |

## Final Result

**PASSED.** No unresolved critical, major, minor, or observation finding remains. Execution may
consume only the artifact matching the audited content hash above; later semantic changes require a
targeted re-check.
