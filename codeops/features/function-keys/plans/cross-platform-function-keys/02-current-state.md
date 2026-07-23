# Current State: Cross-Platform Function Keys

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The core input decoder already exposes F1–F12 in `KEY_NAMES`, recognizes SS3 F1–F4 and the common
numeric-tilde F1–F12 family, preserves xterm modifier bits for numeric-tilde keys, carries incomplete
escape sequences, and bounds malformed input. The native host feeds decoded events to its consumer
and manages the 50 ms Escape timer.

The UI event loop routes keymaps before view dispatch, handles F12 accelerator reveal globally, and
lets `MenuBar` consume canonical F10. The web host feeds xterm.js `onData` strings into the same core
decoder. A separate capture-phase reclaim helper prevents browser defaults for F1–F12 and common
chords while the terminal is focused.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/core/src/engine/input/keys.ts` | Bounded keyboard byte grammar | Add missing standard F-key forms and strict CSI-u classification |
| `packages/core/src/engine/input/events.ts` | Public key and decoder types | Add fallback policy type only if core owns the shared normalizer contract |
| `packages/core/test/fixtures/input-corpus/keyboard.json` | Cross-chunk input corpus | Add portable physical encodings without duplicating all policy tests |
| `packages/core/test/input-keyboard.spec.test.ts` | Core keyboard oracle | Add concrete F-key representations and modifiers |
| `packages/ui/src/event/event-loop.ts` | Global input routing | Normalize aliases before keymap, focus, accelerator, and view routing |
| `packages/ui/src/event/types.ts` | Event-loop public options | Add `functionKeyFallback` |
| `packages/ui/src/app/application.ts` | Application public options | Pass through and document the UI default/opt-out |
| `packages/web/src/host.ts` | xterm.js byte host and structural terminal type | Add optional pre-encoding key hook and canonical direct dispatch |
| `packages/web/src/mount.ts` | Browser application wiring | Ensure direct handling participates in normal lifecycle |
| `packages/web/src/key-reclaim.ts` | Focused browser shortcut suppression | Reuse one chord classification policy and avoid duplicate listeners |

## Code Analysis

`TILDE_KEYS` maps F10 from parameter 21 correctly. The gap is `classifyCsi()`: after handling `~`
and backtab it checks only cursor finals, so CSI `P/Q/R/S` and their modifier form are dropped.
Linux-console `ESC [[ A…E` currently causes the `ESC [[` prefix to be dropped and leaks the
trailing letter as printable input. Kitty CSI-u functional identifiers have no classifier.

`route()` currently receives the raw decoded `KeyEvent` and applies the keymap first. Alias
normalization therefore belongs immediately before routing policy, so F10 menu behavior, F12 reveal,
user keymaps, and focused widgets all observe the same canonical event.

`TerminalLike` intentionally excludes DOM-only members so `@xterm/headless` remains compatible.
Any custom-key hook must consequently be optional and expressed through a narrow local structural
event type.

## Gaps Identified

### Gap 1: Incomplete terminal grammar

**Current Behavior:** Several established F-key encodings are dropped or split into printable input.

**Required Behavior:** R1, R2, and R8.

**Fix Required:** Add narrowly classified sequence families ahead of generic CSI final handling,
with explicit modifier validation and corpus coverage.

### Gap 2: No portable fallback policy

**Current Behavior:** `ESC` plus a printable becomes an Alt-modified printable, and the UI has no
normalization option.

**Required Behavior:** R3–R5.

**Fix Required:** Add a pure event normalizer and invoke it once at the event-loop boundary.

### Gap 3: Browser depends on byte synthesis

**Current Behavior:** Reclaim only prevents defaults; xterm.js must still encode the key into bytes.

**Required Behavior:** R6 and R7.

**Fix Required:** Add optional pre-encoding interception with one-event dispatch and byte fallback.

## Dependencies

### Internal Dependencies

- Core `KeyEvent`, decoder state, and host timing contract.
- UI event-loop ordering, keymap lookup, menu F10, and accelerator F12 handling.
- Web `TerminalLike`, browser host, mount lifecycle, and reclaim focus predicate.
- Generated public API pages and plugin references owned by `yarn plugin:update`.

### External Dependencies

- Published xterm-compatible legacy function-key encodings.
- Linux virtual-console function-key encodings.
- Kitty CSI-u functional-key identifiers.
- xterm.js `attachCustomKeyEventHandler` behavior.

No new package dependency is required.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Default aliases consume an existing Alt binding | Medium | Medium | Typed `'none'` opt-out, changelog, migration docs, spec tests |
| Direct browser and byte paths both dispatch | Medium | High | Suppress xterm processing for handled `keydown`; integration test exact event count |
| Generic CSI-u parsing accepts unintended keys | Medium | High | Exact private-use allowlist and valid modifier arity/range only |
| Linux-console prefix conflicts with generic CSI parsing | Medium | Medium | Recognize the complete fixed family before generic classification |
| Headless terminal no longer satisfies `TerminalLike` | Low | High | Optional hook and structural packaging/typecheck tests |
| Physical key is consumed outside JSVision | High | Medium | Document limitation and always-present number-row fallback |
