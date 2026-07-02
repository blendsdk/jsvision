# Requirements: Glyph Auto-Swap Fallback

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: commit `217f9ea` deferred follow-ups → [DEFERRED.md](../../requirements/DEFERRED.md) DEF-23 (no RD; tracked per AR-11)

## Feature Overview

When the startup CPR width probe detects that the terminal renders East-Asian-Ambiguous chrome
glyphs double-width, the host must automatically degrade its **effective serialize
capabilities** so every emitted frame uses ASCII-safe chrome — aligned, if less pretty —
instead of merely warning on stderr and rendering a sheared UI. Additionally, end users get an
explicit force switch (`JSVISION_ASCII`) that the current warning text already promises.

## Functional Requirements

### Must Have

- [ ] FR-1 — `GlyphCaps` gains `ambiguousWide: boolean` (default `false` in
      `CONSERVATIVE_DEFAULTS`); `true` means the terminal renders the ambiguous chrome glyph
      set double-width and the serializer must swap. *(AR-5)*
- [ ] FR-2 — `fallbackGlyph` swaps the 8 ambiguous chrome glyphs to the ncurses-style ASCII map
      (`▲→^ ▼→v ◄→< ►→> •→* ↑→^ ↕→v ×→x`) when `caps.glyphs.ambiguousWide` is `true`; the
      existing box-drawing and block/shade fallbacks are unchanged. *(AR-7)*
- [ ] FR-3 — The width probe measures **two groups** in one probe pass: group 1 = the
      arrow/geometric chrome set (`▲▼◄►•↑↕×`), group 2 = a box-drawing + shade sample
      (`┌┐└┘─│▒█`). `probeAmbiguousWidth`/`WidthProbeResult` are amended in place (grouped
      result; `WidthProbeOptions.glyphs` → `arrowGlyphs?`/`boxGlyphs?`, PF-004);
      `warnIfAmbiguousWide` keeps its signature. *(AR-6, AR-16)*
- [ ] FR-4 — New additive `HostOptions.adaptAmbiguousWidth?: boolean` (core default `false`).
      When on and the probe reports a wide group, the host derives effective caps: group 1 wide
      → `ambiguousWide: true`; group 2 wide → `boxDrawing: false` + `halfBlocks: false`
      (downgrade only, never upgrade). **All** the host's frame-emitting `serialize` calls use
      effective caps — `render()` (`host.ts:239`) AND the SIGCONT resume repaint
      (`signals.ts:118`, via a `getSerializeCaps` seam on `installSignals`, PF-001);
      decode/modes/restore keep the original caps. *(AR-4, AR-6, AR-9)*
- [ ] FR-5 — `JSVISION_ASCII` (presence = on, any value including empty, NO_COLOR-style) is
      read **host-level** via an injectable `HostOptions.env` (default `process.env`): the host
      fully degrades effective caps (`boxDrawing: false`, `halfBlocks: false`,
      `ambiguousWide: true`) and skips the probe. *(AR-8, AR-13, AR-15)*
- [ ] FR-6 — The probe is skipped whenever effective caps are already fully ASCII-safe —
      including `unicode.utf8: false`, where every glyph above U+007F already emits `?`
      (PF-003); no warning is emitted in that case. *(AR-13)*
- [ ] FR-7 — Two warning variants (exact texts in [03-01](03-01-core-glyph-swap.md#warning-messages)):
      adapt-ON reports the automatic switch; warn-only names `JSVISION_ASCII=1` as the remedy.
      One shared probe run feeds both warn + adapt. *(AR-9, AR-10)*
- [ ] FR-8 — ui threads `adaptAmbiguousWidth` (default `true`) through
      `createApplication`/`run()` exactly like `warnAmbiguousWidth`. *(AR-9, AR-17)*
- [ ] FR-9 — Tracking: `DEFERRED.md` gains DEF-23 (realized by this plan) and DEF-24 (in-app
      warning visibility, stays deferred); the feature roadmap gets a DEF-23 row; `CHANGELOG.md`
      records the probe-API amendment. *(AR-11, AR-16)*

### Should Have

- [ ] SR-1 — `JSVISION_ASCII=1 demo:kitchen` documented as the manual showcase for ASCII-safe
      chrome (README/demo note; no kitchen-sink story). *(AR-12)*

### Won't Have (Out of Scope) *(AR-12, item 2 as amended by AR-17)*

- Content width accounting changes — `unicode.widthMode` semantics untouched; ui controls keep
  `WIDTH_MODE='wcwidth'`.
- ui rendering/widget/chrome changes — only the additive option threading in
  `app/run.ts` + `app/application.ts` touches the ui package.
- Per-glyph selective swap (group granularity only; per-glyph probe is a possible v2).
- A kitchen-sink story (host-serialize behavior is not reachable from a headless story).
- In-app (on-screen) warning visibility — deferred as DEF-24.
- Non-TTY/silent-terminal behavior changes (probe keeps degrading to a no-op).

## Technical Requirements

### Performance

- The two-group probe stays within the existing single `DEFAULT_WIDTH_PROBE_TIMEOUT_MS = 200`
  whole-probe budget (`width-probe.ts:40`); one extra CPR round-trip, no extra timeout.
- Zero per-frame cost beyond one extra `Map` lookup per emitted glyph, gated behind a boolean.

### Compatibility

- All changes to shipped public API are the AR-16-approved in-place amendment of
  `probeAmbiguousWidth`/`WidthProbeResult` (+ new exports); everything else is additive.
  Pre-1.0 lockstep, unpublished (foundation DEF-1) — CHANGELOG note required.
- Existing app override shapes (`override.glyphs: { boxDrawing: true, halfBlocks: true }`)
  keep compiling and behaving identically (deep-merge; new field defaults `false`).

### Security

- CPR replies remain untrusted input: parsed as data only, existing byte cap
  (`CPR_BUFFER_CAP`), digit cap (`MAX_CPR_DIGITS`), and single timeout apply to both reads;
  any failure degrades to `probed: false` with no flag changes.
- `JSVISION_ASCII` is presence-checked only — its value is never parsed, logged, or echoed.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Ceremony | Full plan / mini-plan | Full compact plan | Real design decisions + spec oracles | AR-1 |
| Feature home | jsvision-ui / _maintenance | jsvision-ui | Width-probe context lives there | AR-2 |
| Scope | swap / +ASCII mode / +in-app warning | swap + ASCII mode | Adaptation makes warning visibility less urgent | AR-3 |
| Acting layer | host / capability layer | Host-side effective caps | Probe already runs in host's raw-mode window | AR-4 |
| Switch placement | env layer / host / both | Host-level | Env layer defeated by app overrides (evidence in AR-15) | AR-15 |
| Probe API | amend / additive fn | Amend in place | 1-day-old unpublished API; no dead aggregate probe left behind | AR-16 |

## Acceptance Criteria

1. [ ] AC-1 On a terminal answering "group 1 wide", a host with `adaptAmbiguousWidth: true`
       emits frames where `▲▼◄►•↑↕×` appear as `^v<>*^vx` and box-drawing stays Unicode.
2. [ ] AC-2 On a terminal answering "group 2 wide", the same host emits `+-|`/`#` chrome while
       arrows stay Unicode.
3. [ ] AC-3 With `JSVISION_ASCII` set (any value), frames are fully ASCII-safe and **no probe
       bytes are written** to the terminal. (ASCII-safety covers *chrome* via the serialize
       fallback; app *content* Unicode passes through by design, PF-003.)
4. [ ] AC-4 With adaptation off and warning on, a wide terminal gets the warn-only message
       naming `JSVISION_ASCII=1`; with adaptation on, the adapted-variant message.
5. [ ] AC-5 A silent/non-TTY terminal: behavior identical to today (no flags flipped, no
       warning, UI unchanged).
6. [ ] AC-6 A ui `createApplication` app gets adaptation by default with zero app-code changes.
7. [ ] AC-7 All spec oracles ST-01…ST-16 green; full `yarn verify` + `yarn gate` pass.
8. [ ] AC-8 CHANGELOG + DEFERRED.md (DEF-23/24) + roadmap row updated.
