# Ambiguity Register: Glyph Auto-Swap Fallback

> **Status**: ✅ GATE PASSED — all 17 items resolved
> **Last Updated**: 2026-07-02
> **Feature**: jsvision-ui · **Plan**: glyph-auto-swap

Every decision below was presented to the user with grounded options and resolved by an
explicit user choice (batches of AskUserQuestion on 2026-07-02). AR-15/16/17 were surfaced
mid-authoring under the surface-during-authoring rule and resolved before any plan document
was written.

| #     | Category      | Ambiguity / Gap | Options Presented | User Decision | Status |
| ----- | ------------- | --------------- | ----------------- | ------------- | ------ |
| AR-1  | Scope         | Ceremony: full plan vs task mini-plan | Full compact plan / T-NN mini-plan | **Full plan, compact** — real design decisions warrant the gate + spec docs | ✅ Resolved |
| AR-2  | Naming        | Target feature (nested layout) | jsvision-ui / _maintenance | **jsvision-ui** — keeps it next to the width-probe context (RD-11 follow-up, commit `217f9ea`) | ✅ Resolved |
| AR-3  | Scope         | Which deferred follow-ups are in scope | Auto-swap only / + ASCII mode / + in-app warning | **Auto-swap + explicit ASCII mode**; in-app warning visibility stays deferred (→ DEF-24) | ✅ Resolved |
| AR-4  | Technical     | Where the probe result acts | Host-side effective caps / capability-layer integration | **Host-side effective caps** — host already runs the probe in the right window (`host.ts:180`) and owns `serialize` (`host.ts:239`); zero app API churn | ✅ Resolved |
| AR-5  | Data & state  | New capability flag: name, polarity, default | `glyphs.ambiguousWide=false` / `glyphs.ambiguousNarrow=true` / reuse `unicode.widthMode` | **`glyphs.ambiguousWide`, default `false`** — defect polarity keeps the all-false `CONSERVATIVE_DEFAULTS` convention (`defaults.ts:30`), existing app overrides untouched; reusing `widthMode` rejected (a font-fallback terminal is not ambiguous-wide for content — would corrupt width accounting semantics) | ✅ Resolved |
| AR-6  | Technical     | Probe granularity + which flags flip | Two-group probe / single probe one flag / single probe flip-all | **Two-group probe**: group 1 = arrow/geometric chrome set → flips `ambiguousWide`; group 2 = box-drawing + shade sample → flips effective `boxDrawing`/`halfBlocks` off (downgrade only). Probe strings realigned to the glyphs chrome actually draws (drops the no-longer-drawn `■`) | ✅ Resolved |
| AR-7  | UX            | The concrete ASCII swap map | ncurses-style / TV-mono-inspired variants | **ncurses-style**: `▲→^ ▼→v ◄→< ►→> •→* ↑→^ ↕→v ×→x` (existing `┌─┐│→+-\|`, `█▀▄░▒▓→#` unchanged) | ✅ Resolved |
| AR-8  | Integration   | Forced-ASCII switch: name + placement | `JSVISION_ASCII` env layer / host-only / `TUI_ASCII` | **`JSVISION_ASCII`**, NO_COLOR-style presence = on. Placement **revised by AR-15** (env layer proved ineffective) | ✅ Resolved (placement superseded by AR-15) |
| AR-9  | Integration   | Host API for auto-adaptation | Additive `adaptAmbiguousWidth` bool / policy union replacing `warnAmbiguousWidth` | **`adaptAmbiguousWidth?: boolean`** — default `false` in core, ui passes default `true`; exactly mirrors `warnAmbiguousWidth` (`types.ts:64`, `run.ts:59`). One shared probe run feeds warn + adapt | ✅ Resolved |
| AR-10 | UX            | Warning wording (adapted vs warn-only) | Two variants naming the switch / one shared message | **Two variants**: adapt-ON = "…ASCII-safe glyphs enabled automatically. For full fidelity use a monospaced font with full Unicode coverage."; warn-only = existing message with the fix clause "…or set JSVISION_ASCII=1." (full texts in 03-01) | ✅ Resolved |
| AR-11 | Scope         | Tracking & roadmap linkage (no RD) | DEF-23/24 + DEF-linked row / roadmap row only | **DEF-23/24 in DEFERRED.md** (DEF-23 glyph auto-swap = realized by this plan; DEF-24 in-app warning visibility = stays deferred); plan declares `Implements: jsvision-ui/DEF-23`; feature roadmap gets a DEF-23 row | ✅ Resolved |
| AR-12 | Scope         | Explicit non-goals | Confirm all six / adjust | **All six confirmed**: (1) content width accounting untouched (`unicode.widthMode` semantics unchanged; ui `WIDTH_MODE='wcwidth'` stays); (2) no ui edits — *amended by AR-17 to "no ui rendering/widget/chrome changes"*; (3) no per-glyph selective swap (group granularity; per-glyph = possible v2); (4) no kitchen-sink story — `JSVISION_ASCII=1 demo:kitchen` documented as the manual showcase instead; (5) in-app warning visibility deferred as DEF-24; (6) non-TTY/silent-terminal behavior unchanged (probe degrades to no-op) | ✅ Resolved (item 2 amended per AR-17) |
| AR-13 | Edge cases    | Probe when caps already fully ASCII-safe (e.g. JSVISION_ASCII set) | Skip probe entirely / run warn-only | **Skip probe entirely** — nothing to learn or swap; no warning (the user opted in); saves the CPR round-trip | ✅ Resolved |
| AR-14 | Naming        | Plan folder slug | glyph-auto-swap / ascii-safe-glyphs | **glyph-auto-swap** | ✅ Resolved |
| AR-15 | Integration   | (Revises AR-8) JSVISION_ASCII placement — new evidence: no capability layer ever sets glyph caps true; every real app passes `override.glyphs` (`kitchen-sink/main.ts:32`, `tvision-demo/main.ts:128`) and override outranks env (PL-7, `profile.ts:117`), so a pure env-layer switch is defeated by every real app | Host-level / env layer + special precedence / both layers | **Host-level**: `createHost` reads `JSVISION_ASCII` via injectable `HostOptions.env` (default `process.env`, mirroring `ResolveOptions.env` at `profile.ts:119`) and fully degrades its effective serialize caps; probe skipped per AR-13. PL-7 contract untouched | ✅ Resolved |
| AR-16 | Technical     | Two-group probe changes the shipped public probe API (`probeAmbiguousWidth`/`WidthProbeResult`, exported `index.ts:90`, shipped `217f9ea`) + its 16 spec/impl oracles | Amend in place / additive second function | **Amend in place** — pre-1.0 lockstep, unpublished (DEF-1), API one day old; CHANGELOG note. **Explicit user approval to update the existing width-probe spec oracles to the grouped contract** (immutable-oracle exception, AR-16 cited in the updated tests). `warnIfAmbiguousWide` keeps its signature | ✅ Resolved |
| AR-17 | Scope         | (Amends AR-12 non-goal 2) AR-9's "ui passes default true" requires threading the option through ui `app/run.ts` + `app/application.ts` — a ui-package edit the strict fence forbade; strict fence would make adapt unreachable for ui apps (`createApplication` owns `createHost`) | Amend non-goal 2 / keep strict fence (rescinds AR-9's ui default) | **Amend non-goal 2** to "no ui **rendering/widget/chrome** changes"; the additive option threading (2 files, mirrors `warnAmbiguousWidth`) is IN scope | ✅ Resolved |

### Resolution Notes

**AR-5:** The rejected `unicode.widthMode` reuse was dropped because the probe detects a
*chrome-glyph* rendering defect (often font fallback), which does not imply the terminal is
ambiguous-wide for *content*; conflating them would corrupt `charWidth` accounting semantics.

**AR-6:** Box-drawing (U+2500–257F) and block/shade (U+2580–259F) code points are East-Asian
Ambiguous too; under an ambiguous-wide locale, frames shear exactly like arrows. Group 2 exists
so that case degrades frames to `+-|` while the (more common) font-fallback case — arrows wide,
box drawing fine — keeps Unicode frames.

**AR-15/16/17** were surfaced during Phase 2 authoring (surface-during-authoring rule) and
resolved before any plan document was written. AR-15 supersedes AR-8's placement (name and
presence-semantics stand). AR-17 amends AR-12's non-goal 2 (all other non-goals stand).

**Final confirmation:** user confirmed the complete register ("Confirmed — gate passes",
2026-07-02) at 14 items; AR-15…17 were subsequently each explicitly resolved by the user
before document writing began.

### Runtime decisions (exec_plan)

**AR-R1 (runtime, Phase 2)** — Probe read strategy: the grouped probe writes BOTH groups
(`\r`+arrows+`ESC[6n`+`\r`+boxes+`ESC[6n`) up front and parses both CPR replies from one byte
stream under the single shared timeout, rather than interleaving a read between the two writes.
Observably identical to a real terminal processing the writes in order (same writes, same
`WidthProbeResult`); the ST-05…07 oracles and impl tests don't mandate an interleaved read. More
robust and simpler to drive headlessly.

**AR-R2 (runtime, Phase 2)** — The two-group probe requires two CPR replies, which breaks the
Phase-1-era `host-width-warn.impl.test.ts` (it fed a single CPR). To avoid leaving the suite red
across a whole phase, that impl test's two probe-feeding cases were updated to feed both CPRs
during Phase 2 (a minimal green-keeping edit); the broader message-text assertions the plan
assigns to task 3.1.6 are finalized in Phase 3 when `host.ts` gains the adapt path.
