# Requirements: Cross-Platform Function Keys

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

JSVision applications must expose F1–F12 actions consistently across supported native terminals and
xterm.js. Physical keys are preferred, while the approved number-row aliases provide a portable
path when firmware, an operating system, a terminal emulator, or a browser reserves a physical key.

## Functional Requirements

### Must Have

- **R1 — Canonical physical keys:** Recognized native and browser representations of F1–F12 produce
  exactly one canonical `KeyEvent` whose key is `f1` through `f12`.
- **R2 — Modifier preservation:** Protocol-encoded Shift, Alt, and Ctrl modifiers on physical
  function keys are retained when the representation is unambiguous.
- **R3 — Portable aliases:** With number-row fallback enabled, `Alt+1…9,0,-,=` becomes unmodified
  F1–F12 respectively; unrelated input remains unchanged.
- **R4 — Default and opt-out:** `createApplication` enables number-row fallback when its option is
  omitted and accepts `'none'` to preserve literal Alt chords. Bare `createEventLoop` remains
  compatibility-default `'none'`; direct event-loop consumers opt in explicitly. See AR-2 and AR-7.
- **R5 — Escape semantics:** Fast Escape-prefixed number-row input follows R3; input arriving after
  the existing 50 ms boundary remains a bare Escape followed by an ordinary key. See AR-3.
- **R6 — Browser interception:** A focused DOM xterm.js terminal that exposes a custom key-event
  hook converts supported physical F-key `keydown` events and exact Alt-only alias codes directly,
  prevents the browser default where possible, and emits no duplicate byte-decoded event. Repeat,
  Meta-modified, and unrelated events remain on the existing path. See AR-5.
- **R7 — Graceful browser fallback:** Headless or structurally minimal terminals without the custom
  hook retain the existing `onData` decoder path.
- **R8 — Bounded input handling:** Unknown, malformed, partial, and out-of-scope functional-key
  sequences preserve the decoder's carry cap, drop, and resynchronization guarantees.
- **R9 — Consumer accuracy:** Public API docs, keyboard guidance, changelogs, examples where needed,
  and generated plugin references describe the fallback, opt-out, and interception limitation.

### Should Have

- **R10 — Diagnostic clarity:** Documentation gives troubleshooting heuristics for distinguishing
  outer-layer interception from unsupported bytes where observable. No runtime diagnostic or
  keystroke-logging feature is introduced.

### Won't Have

- F13 and later function keys.
- General keypad aliases.
- Key release or repeat events.
- Full Kitty keyboard-protocol negotiation or global enhanced-keyboard activation.
- A promise that JSVision can capture a physical key consumed before it reaches the process/page.
- Runtime terminfo subprocesses or new runtime dependencies.

## Technical Requirements

### Performance

- Key normalization remains constant-time and allocation-bounded per event.
- The decoder continues using fixed allowlists; it performs no filesystem, subprocess, or network I/O.

### Compatibility

- Existing canonical F1–F12 byte sequences and public key names remain unchanged.
- `decode()` continues reporting literal Alt+number-row events; fallback is a UI policy.
- Applications that configure `'none'` retain their existing Alt+number-row behavior.
- Headless xterm.js-compatible test terminals remain structurally valid.

### Security

- Terminal and browser input is untrusted and matched only against bounded allowlists.
- Unknown CSI-u private-use identifiers and invalid modifier parameters must not synthesize keys.
- Browser handling is active only while the terminal is focused and must not globally suppress
  unrelated page input.
- No raw keystroke logging, dynamic evaluation, shell execution, or dependency installation is added.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Planning unit | Feature / maintenance task | Feature | Cross-package public behavior and compatibility require a cohesive contract | AR-1 |
| Alias location | UI policy / decoder rewrite | UI policy | Keeps the byte decoder truthful and gives consumers an opt-out | AR-2 |
| Escape window | Retain / lengthen | Retain 50 ms | Avoids adding latency to Escape-driven UI interactions | AR-3 |
| Encoding breadth | Primary xterm only / bounded interoperable set | Bounded interoperable set | Covers established terminal families without runtime discovery | AR-4, AR-8 |
| Browser route | Direct key event / bytes only | Direct when available, bytes otherwise | Removes browser encoder variance while preserving headless compatibility | AR-5 |
| Guarantee | Physical capture / accessible action | Accessible action | Outer software and firmware are beyond JSVision control | AR-6 |
| Default | Aliases on / aliases off | On in UI | Supplies the approved permanent fallback, with explicit opt-out | AR-7 |
| Extended keys | F1–F12 / broader protocol | F1–F12 | Keeps scope aligned with JSVision's public named-key model | AR-9 |

## Acceptance Criteria

1. Every input/output pair in ST-1 through ST-20 passes.
2. Existing classic keyboard, hardening, fuzz, host, event-loop, menu, accelerator, browser-host,
   key-reclaim, and mount tests remain green.
3. The public fallback option is typed, documented, exported where consumers need it, defaults on
   at `createApplication`, and remains off for bare `createEventLoop` unless explicitly enabled.
4. Browser direct interception emits once and byte-only terminals still work.
5. `yarn plugin:update`, `yarn plugin:check`, and `yarn verify` pass. See AR-10.
