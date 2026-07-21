# Preflight Report: Global Clipboard & Selection

> **Status**: ✅ PASSED WITH NOTES — 5 findings resolved, all applied to the plan docs (0 critical, 1 major, 2 minor, 2 observation)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/global-clipboard/`
> **Codebase Grounded**: 18 source files examined, ~40 references verified
> **Last Updated**: 2026-07-12

> **Review independence:** This plan was authored in a prior session (not the current one), so the
> same-session bias banner does not apply. The same model *family* likely authored and reviewed it,
> so the scan actively re-verified every code claim against source rather than reasoning from the
> plan's assertions, and independently challenged the one high-stakes finding (below).

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero
runtime deps. Packages: `@jsvision/core` (engine), `@jsvision/ui` (widget framework), examples.

**Architecture:** The plan targets `@jsvision/ui`'s event loop + two editable widgets. The
key→command→focused-widget path is fully wired: `route()` (`event/dispatch.ts:115-218`) converts a
keymapped chord to a command and swallows the raw key (`:121-128`), then a 3-phase sweep delivers the
command to the focused chain clamped to `scopeRoot` (`:198-217`). The loop owns the keymap
(`event/event-loop.ts:169,443`) and the single clipboard-write seam (`:457-460`). `Input`
(`controls/input.ts`) and `Editor` (`editor/`) already honor `Commands.copy/cut/paste`; the gap is a
missing framework default keymap, a missing `Commands.selectAll`, and a no-op `Input` paste.

**Key Files Examined:** `event/event-loop.ts`, `event/dispatch.ts`, `event/types.ts`,
`event/commands.ts`, `event/index.ts`, `status/commands.ts`, `controls/input.ts`,
`controls/input-clipboard.ts`, `editor/editor-events.ts`, `editor/editor-clipboard.ts`,
`editor/editor-draw.ts`, `editor/editor.ts`, `view/types.ts`, `view/view.ts`,
`app/application.ts`, core `input/keymap.ts`, core `input/events.ts` (KEY_NAMES), core
`render/osc.ts` (setClipboard).

**Reference verification:** The plan is exceptionally well-grounded. Nearly every `file:line`
citation was verified accurate (setClipboard import `event-loop.ts:11`; keymap seam `:169`; clipboard
sink `:457-460`; the swallow-the-raw-chord path `dispatch.ts:121-128`; `Input` command branch
`input.ts:232-238`, `clipboardChord` `input-clipboard.ts:27-32`, raw Ctrl+A `input.ts:310`; Editor
`mirrorSink` `editor-events.ts:25` and command branch `:65-79`; `Editor.execute('selectAll')`
`editor.ts:221`; classic chord grammar compiles — `insert`/`delete` are in `KEY_NAMES`). Two
structural design assumptions were confirmed sound: (1) core's `Keymap` is a **structural interface**
(`{ lookup(event) }`), so the "compose-at-lookup" merge in `buildKeymap` type-checks without a class;
(2) commands are **enabled by default** (`event/commands.ts:43-47`), so an unseeded `selectAll`
emits. No other widget consumes raw `Ctrl+A/C/X/V` or the classic clipboard chords, so globalizing
them causes **no hidden regression** (verified by grep across `packages/ui/src`).

**One claim did not verify** — the "existing selection-change signal" the enable-gating design rests
on does not exist (PF-001).

### Summary by Dimension

| #  | Dimension            | Findings | Highest Severity |
|----|----------------------|----------|------------------|
| 1  | Ambiguities          | 0        | —                |
| 2  | Implicit Assumptions | 0        | —                |
| 3  | Logical Contradictions | 0      | —                |
| 4  | Completeness Gaps    | 1        | 🟡 Minor         |
| 5  | Dependency Issues    | 0        | —                |
| 6  | Feasibility Concerns | 0        | —                |
| 7  | Testability          | 1        | 🟡 Minor         |
| 8  | Security Blind Spots | 1        | 🔵 Observation   |
| 9  | Edge Cases           | 1        | 🔵 Observation   |
| 10 | Scope Creep          | 0        | —                |
| 11 | Ordering & Sequencing | 0       | —                |
| 12 | Consistency          | 0        | —                |
| 13 | Codebase Alignment   | 1        | 🟠 Major         |

### Summary by Severity

| Severity    | Count | Status      |
|-------------|-------|-------------|
| CRITICAL    | 0     | —           |
| MAJOR       | 1     | ✅ resolved |
| MINOR       | 2     | ✅ resolved |
| OBSERVATION | 2     | ✅ resolved |

---

### PF-001: Enable-gating (R13) rests on a selection-change signal that does not exist 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Phantom Reference / Stale Assumption); also 4 — Completeness
**Location:** `03-03-widget-integration.md` §Input.5 (`:48-56`); `00-ambiguity-register.md` AR-17
(`:29`); `99-execution-plan.md` task 4.2.1 (`:194`)
**Codebase Evidence:** `packages/ui/src/controls/input.ts:70-78` (selection is plain protected fields
`selStart`/`selEnd`/`anchor`, mutated then `invalidate()`d — not a signal); `packages/ui/src/view/view.ts:136-138`
(`focusSignal()` is a focus-only tick, poked only at `event/focus.ts:110,114`); `Input` writes only
its `value` `Signal<string>`. Contrast: the Editor self-greys via a reactive `ed.hasSelection` signal
+ an enable seam pushed on every selection change (`editor/editor.ts:83`; `editor/editor-draw.ts:61,77-82`).

**The Problem:** The plan designs the Should-Have enable-gating around `Input.hasSelection()` **plus**
"the existing selection-change signal" (named `Input.onSelectionChange`, "the existing per-view
focus/selection signal"). That signal does not exist. `Input`/`View` expose only `focusSignal()`
(fires on a focus flip between views) and the `value` text signal (fires on text change). Neither
fires on a **pure selection change** — Shift+Arrow extend (`input.ts:318-341`), drag-select
(`:465-472`), double-click select-all (`:451-453`), or Ctrl+A on an already-focused field
(`:310-313`) all change `selStart`/`selEnd` with unchanged text and unchanged focus. So an app that
tries to live-grey `copy`/`cut` by binding to "the existing signal" (i.e. `focusSignal()`) would show
**stale** enablement after exactly the gestures that create/clear a selection. The sole oracle, ST-24
(`07-testing-strategy.md:71`), checks only that `hasSelection()` returns the right boolean — so the
missing signal ships green and no test catches it. The `hasSelection()` accessor half of the design is
sound; the reactive half is a phantom. *(Independently verified by a challenger against source; verdict:
real defect, MAJOR at the lower boundary — a genuine grounding error, kept below CRITICAL only because
R13 is a Should-Have and the accessor is sound.)*

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a reactive selection-change hook to `Input` (a `hasSelection: Signal<boolean>` updated wherever `selStart`/`selEnd` change), mirroring the Editor's `ed.hasSelection` (`editor-draw.ts:61`). App binds it to drive `enableCommand`. Update §Input.5 / AR-17 / task 4.2.1 to say "add" not "reuse the existing signal". | Delivers R13 properly; well-precedented (Editor already does exactly this); corrects the factual error | A genuinely new primitive (small), not the "free reuse" the plan implies; touch ~4 selection sites in `input.ts` |
| B | Ship only `Input.hasSelection()` (accessor); document that app greying re-evaluates on focus/value change only, not on pure selection gestures. | Cheapest; ST-24 passes as-is | Greying is stale for Shift-select/drag/double-click/Ctrl+A — the common cases; R13's "greys when there is no selection" only half-honored |
| C | Defer R13 (enable-gating) entirely to a fast-follow (it is a Should-Have). | Removes the phantom from this plan; core Must-Haves unaffected | Overrides AR-7/AR-17; drops a decided Should-Have |

**Recommendation:** Option A — the Editor already proves the pattern (`ed.hasSelection` at
`editor-draw.ts:61`), so adding a symmetric selection signal to `Input` is small, low-risk, and the
only option that both corrects the phantom reference and delivers the live-greying UX R13 promises.
The doc must stop calling it "the existing signal." *(Confidence: High — verified directly in source
and by an independent challenger. Hardening: challenger confirmed severity; no change to pick.)*

**User Decision:** Resolved — accepted recommendation (Option A); applied to the plan docs.

---

### PF-002: ST-8's "OS write fires" assertion needs a clipboard-capable caps profile 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md` ST-8 (`:45`) + Test Data / Mock Requirements (`:112-120`)
**Codebase Evidence:** `packages/core/src/engine/render/osc.ts:58-59` — `setClipboard(text, caps)`
returns `''` when `!caps.osc.clipboard52`; the dual-sink only calls `writeClipboard` when the seq is
non-empty (`event-loop.ts:457-460`, per the plan's `03-02` dual-sink).

**The Problem:** ST-8 asserts that dispatching `Commands.copy` both fills the app buffer **and**
emits an OS write sequence to the host clipboard sink. The buffer fill is unconditional, but the OS
write is gated on `caps.osc.clipboard52`. If the executor builds the test loop with a caps profile
that lacks clipboard52 (e.g. a minimal/mono profile), `setClipboard` returns `''`, `writeClipboard`
is never called, and ST-8's OS-write assertion fails spuriously — a confusing red that looks like an
implementation bug but is a test-setup gap. The plan's Test Data section does not state this
precondition.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a note to ST-8 / Test Data: the loop's caps must advertise `osc.clipboard52` for the OS-write half of the assertion; the buffer-fill half is caps-independent. | One sentence; prevents a spurious red | None |
| B | Split ST-8 into two oracles: buffer-fill (caps-independent) and OS-write (clipboard-capable caps), so each precondition is explicit. | Most precise | Slightly more ceremony |

**Recommendation:** Option A — a one-line precondition note is enough; the executor already needs a
fake `writeClipboard` sink, and stating "with clipboard-capable caps" alongside it removes the trap.

**User Decision:** Resolved — accepted recommendation (Option A); applied to the plan docs.

---

### PF-003: `clipboardKeys: 'none'` leaves copy/cut/paste with no fallback (only Ctrl+A survives) 🟡 MINOR

**Dimension:** 4 — Completeness (also 12 — Consistency)
**Location:** `02-current-state.md` Gap 2 fix (`:78`); `03-03-widget-integration.md` §Input.3-4
(`:38-42`); `01-requirements.md` R10 (`:38-40`)
**Codebase Evidence:** Under `'none'` with no user keymap, `buildKeymap` returns `undefined` and
`route()` globalizes nothing (`dispatch.ts:122`). The plan keeps raw Ctrl+A in `handleKey`
(`input.ts:310`) as the 'none' fallback but **retires** `clipboardChord()` (`input-clipboard.ts:27-32`,
AR-5), which today is the only raw-key path for classic copy/cut/paste (`input.ts:251-256`).

**The Problem:** After retirement, an `Input` under `clipboardKeys: 'none'` **with no user keymap**
can select-all (raw Ctrl+A) but cannot copy, cut, or paste by any chord — the modern chords aren't
bound, the classic chords aren't bound, and `clipboardChord()` is gone. The plan keeps a raw fallback
for select-all but not for copy/cut/paste, an asymmetry that isn't called out. This is defensible
(`'none'` means "I'll supply my own keymap"), but it is strictly less capable than today's
no-keymap default (where `clipboardChord` gives classic copy/cut/paste), and a reader could
reasonably expect `'none'` to behave like today. It is not a regression to the shipped default
(`'both'` preserves everything), only to the new `'none'` mode.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Document the asymmetry: under `'none'` the framework binds no clipboard chords; only the widgets' raw Ctrl+A select-all remains, and apps wanting copy/cut/paste under `'none'` must supply their own keymap. Add to the `clipboardKeys` JSDoc + R10. | Sets correct expectations; no code change | — |
| B | Also drop the raw Ctrl+A fallback under `'none'` for full consistency (a truly bare mode). | Symmetric | Loses a working select-all for no benefit; contradicts ST-20 |
| C | Under `'none'`, keep `clipboardChord()` alive as the sole raw path (don't fully retire it). | `'none'` preserves classic copy/cut/paste like today | Re-introduces the dual path AR-5 set out to remove; more code |

**Recommendation:** Option A — the asymmetry is an acceptable, intentional consequence of `'none'`
meaning "opt out of framework bindings," but it must be documented so it doesn't read as a bug. B and
C both fight decisions already made (ST-20 keeps Ctrl+A; AR-5 retires the dual path).

**User Decision:** Resolved — accepted recommendation (Option A); applied to the plan docs.

---

### PF-004: `onCommand` handlers now intercept the globalized clipboard commands before the widget 🔵 OBSERVATION

**Dimension:** 9 — Edge Cases (integration)
**Location:** `03-01`/`03-03` (the design globalizes `copy`/`cut`/`paste`/`selectAll` as command names)
**Codebase Evidence:** `event/event-loop.ts:418-424` — the loop delivers a command event to its
`CommandSink` (registered `onCommand` handlers) **before** the tree's dispatch, and a handled command
`return`s without reaching the focused view. Skipped only while a modal is active.

**The Problem:** This plan turns `copy`/`cut`/`paste`/`selectAll` into framework-wide command names
raised on every keystroke. If an app registers `app.onCommand('paste', …)` (or copy/cut/selectAll),
the loop-owned sink consumes the command in pre-process and the focused `Input`/`Editor` silently
never performs the clipboard action. This is the documented `onCommand` precedence, not a new bug, but
globalizing these exact names grows the surface where an app can accidentally shadow in-widget
clipboard. Worth a sentence in the `Commands`/`clipboardKeys` JSDoc so app authors know these are now
live command names.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Note in the `Commands.copy/cut/paste/selectAll` JSDoc (and/or `clipboardKeys`) that registering an `onCommand` for these intercepts in-widget clipboard. | Prevents a surprising footgun; doc-only | — |
| B | Accept silently — it is inherent `onCommand` semantics, already documented on `onCommand`. | No work | Leaves a non-obvious interaction undocumented at the new call site |

**Recommendation:** Option A — a one-line note where the commands are defined is cheap insurance now
that these are framework-globalized names.

**User Decision:** Resolved — accepted recommendation (Option A); applied to the plan docs.

---

### PF-005: New in-memory retention of copied text — "no new attack surface" is slightly overbroad 🔵 OBSERVATION

**Dimension:** 8 — Security Blind Spots
**Location:** `00-ambiguity-register.md` AR-16 (`:28`); `01-requirements.md` §Security (`:74-79`)
**Codebase Evidence:** Today `Input.runClipboard('paste')` is a no-op and `Input` holds **no**
clipboard buffer (`input.ts:269-279`); Input-copied text goes only to the OS clipboard via
`setClipboard` (`event-loop.ts:457-460`). The plan adds a loop-global `clipboardText` retained for the
app's lifetime (`03-02` §New loop state).

**The Problem:** AR-16 concludes "no new attack surface … In-memory only, reuse existing sanitizers,
no new I/O surface." That is accurate for I/O, but the plan **does** introduce a new in-memory
retention: the loop now holds the last-copied text (which could be a password copied from an `Input`,
which previously had no buffer at all) for the app's lifetime, never cleared. The risk is low (in-
process memory, no serialization, same threat model as any clipboard), but the "no new attack
surface" phrasing understates it. Optional: acknowledge the in-memory retention (and that clearing it
is out of scope / not more protective than the OS clipboard) so the security note is precise.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reword AR-16 / §Security to acknowledge the new in-memory retention (last-copied text held for the app's lifetime) while noting it is low-risk and no worse than the OS clipboard. | Precise; low effort | — |
| B | Leave as-is — the retention is benign and standard for any clipboard. | No work | The explicit "no new attack surface" claim remains slightly imprecise |

**Recommendation:** Option A — the plan deliberately enumerated the security surface, so making the
one imprecise clause precise keeps the audit trail honest. Easily dismissed if you consider the
retention self-evidently benign.

**User Decision:** Resolved — accepted recommendation (Option A); applied to the plan docs.

---

## Pass/Fail

**✅ PREFLIGHT PASSED WITH NOTES — all 5 findings resolved** (Option A each), applied to the plan docs
on 2026-07-12:
- **PF-001** (major): §Input.5, AR-17, task 4.2.1, and the 07 impl row now specify **adding** a
  reactive `Input.hasSelection` signal (mirroring the Editor's) instead of "reusing" a non-existent one.
- **PF-002** (minor): 07 Mock Requirements now states ST-8 needs a clipboard-capable caps profile.
- **PF-003** (minor): 03-01 `clipboardKeys` JSDoc note + R10 now document the `'none'` fallback asymmetry.
- **PF-004** (observation): 03-01 Commands-JSDoc rewrite now notes the `onCommand` interception.
- **PF-005** (observation): AR-16 + 01 §Security now acknowledge the benign in-memory retention.

The plan was already strongly codebase-grounded; these were documentation/spec corrections, not
structural redesigns. The plan is cleared for `exec_plan global-clipboard`. Roadmap advanced to
**Plan Preflighted** 🔬.
