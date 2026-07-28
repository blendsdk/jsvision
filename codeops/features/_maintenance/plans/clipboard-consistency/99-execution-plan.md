# Task T-03: Unify Clipboard Behavior Across Widgets and Hosts

> **Type**: Maintenance bug fix
> **Feature-Set**: `_maintenance`
> **Status**: Complete
> **Created**: 2026-07-26
> **Last Updated**: 2026-07-27 03:15
> **Progress**: 6/6 tasks complete
> **Phase baseline tree**: a803e702a4ee5f0309b1a3cedbab29ca5c79827a
> **CodeOps Artifact Schema**: 1

## Objective

Provide one clipboard model for every editable JSVision control while preserving the host
integration mechanisms that are actually available in browsers and terminal emulators.

JSVision owns the canonical plain-text clipboard. Copy and cut update that value first and then
offer the same text to the host adapter. Paste received from the host updates the canonical value
before using the control's normal insertion path. This makes `Ctrl+C`/`Ctrl+X`/`Ctrl+V` reliable
inside JSVision and makes host gestures aliases into the same pipeline instead of a second,
divergent clipboard.

## Confirmed Behavior Contract

- `Input`, `Editor`, and `CodeEditor` use the same copy, cut, paste, and external-paste semantics.
- Copy and cut preserve the exact selected plain text, including Unicode and line endings, in the
  JSVision clipboard before attempting host synchronization.
- `Ctrl+V` pastes the current JSVision clipboard.
- Host paste events, including browser or terminal `Ctrl+Shift+V`, update the JSVision clipboard
  and paste that exact text through the same control insertion path.
- `Ctrl+Shift+C`, when the host delivers that key event to JSVision, invokes the same copy command
  as `Ctrl+C`. Browser hosting must deliberately route this gesture because xterm.js otherwise
  reserves it for terminal selection.
- Browser outbound copy passes raw text to the browser Clipboard API. Native terminal outbound
  copy encodes raw text as OSC 52 only when the detected terminal capability supports it.
- A denied or unavailable host clipboard must never erase the JSVision clipboard or break
  application-local copy and paste.
- Clipboard behavior and tests cover Windows, macOS, and mainstream Linux environments without
  invoking platform-specific clipboard executables or reading the host clipboard directly.
- Host synchronization remains capability-based: browser Clipboard API permissions and terminal
  OSC 52 support are host constraints, not operating-system guarantees. Unsupported hosts retain
  fully functional JSVision-local clipboard behavior.
- The host boundary accepts plain text only. Clipboard contents are not logged, interpreted as
  control sequences, or reused as terminal-ready output.

## Tasks

### T-03.1 — Add immutable clipboard behavior specifications

- [x] T-03.1 Add immutable clipboard behavior specifications. ✅ (completed: 2026-07-26 23:24)

- Add specification tests that fail against the current implementation and cover the
      confirmed behavior contract before production code changes.
- Exercise `Input`, `Editor`, and `CodeEditor` with the same command and external
      `PasteEvent` scenarios.
- Prove that external paste updates the canonical clipboard by repeating it with `Ctrl+V`.
- Prove that copy/cut retains the canonical value when host synchronization rejects or is
      unavailable.
- Cover empty selections, read-only controls, multiline text, Unicode, and preserved line
      endings.
- Add browser-mount specifications that copy selected text from both `Input` and
      `CodeEditor` through an injected host clipboard bridge.
- Add shortcut specifications for `Ctrl+C`, `Ctrl+V`, delivered `Ctrl+Shift+C`, and host
      `Ctrl+Shift+V`, including a no-double-dispatch assertion.

**Verify**:

```sh
yarn workspace @jsvision/ui test
yarn workspace @jsvision/code-editor test
yarn workspace @jsvision/web test
```

Expected before implementation: the new regression cases fail for the identified missing paths
while the existing suites remain green.

**Red-phase evidence**: UI 4 intended failures; CodeEditor 2 intended failures; web mount 2
intended failures. Existing web clipboard and mount baselines remain green.

### T-03.2 — Establish one raw-text clipboard pipeline

- [x] T-03.2 Establish one raw-text clipboard pipeline. ✅ (completed: 2026-07-27 00:50)

- Make the event loop the single owner of the canonical clipboard value.
- Introduce a host-neutral raw-text outbound clipboard boundary and preserve compatibility
      for existing public event-loop integrations.
- Update copy and cut to commit locally before invoking the host boundary.
- Update incoming host paste handling to adopt the received text before dispatching it to the
      focused control.
- Define failure handling so asynchronous browser rejection and unsupported native
      capabilities cannot invalidate local state or create unhandled promise rejections.
- Keep clipboard payloads as raw text until the native adapter explicitly converts them to
      OSC 52.

**Verify**:

```sh
yarn workspace @jsvision/ui typecheck
yarn workspace @jsvision/ui test
```

**Verification evidence**: UI typecheck passed; 327 test files and 1,899 tests passed. Plugin
generation and integrity checks passed for the changed public application-shell surface.

### T-03.3 — Connect browser and native host adapters

- [x] T-03.3 Connect browser and native host adapters. ✅ (completed: 2026-07-27 00:54)

- Wire browser mounts to the existing Clipboard API bridge rather than writing OSC 52 back
      into xterm.js.
- Make the browser clipboard bridge injectable so behavior, rejection, and unsupported API
      cases are deterministic in tests.
- Route browser `Ctrl+Shift+C` to the canonical copy command without interfering with
      ordinary browser shortcuts outside the mounted terminal or dispatching copy twice.
- Keep browser paste on xterm.js's external paste-event path so `Ctrl+Shift+V` and menu paste
      use the same inbound pipeline.
- Keep native terminal output capability-gated and encode OSC 52 at the native host boundary.
- Test host selection by injected Windows, macOS, and Linux runtime profiles; do not make
      behavior depend on platform clipboard subprocesses.

**Verify**:

```sh
yarn workspace @jsvision/web typecheck
yarn workspace @jsvision/web test
yarn workspace @jsvision/core test
```

**Verification evidence**: web typecheck passed; web 12 test files and 46 tests passed; core 119
test files and 768 tests passed. Plugin generation, integrity, formatting, and web documentation
checks passed.

### T-03.4 — Align every editable control

- [x] T-03.4 Align every editable control. ✅ (completed: 2026-07-27 01:48)

**Runtime decision resolved**: [AR-01](00-ambiguity-register.md) normalizes inserted text to the
target document's established line-ending style while leaving the canonical clipboard raw.

- Add external `PasteEvent` handling to `CodeEditor`.
- Ensure `Input`, `Editor`, and `CodeEditor` share the global clipboard commands without
      control-specific modifier exceptions.
- Preserve each control's established edit rules for read-only state, selections, maximum
      length, undo history, and change notifications.
- Remove or consolidate duplicate clipboard paths only after their behavior is covered by the
      specification tests.
- Add implementation tests for control-specific edit invariants that are not part of the
      public behavior specification.

**Verify**:

```sh
yarn workspace @jsvision/ui test
yarn workspace @jsvision/code-editor test
```

**Verification evidence**: UI 327 test files and 1,899 tests passed; CodeEditor 48 test files and
345 tests passed. CRLF paste, undo, redo, read-only handling, formatting, documentation, and
plugin integrity checks passed.

### T-03.5 — Update consumer guidance and generated plugin surfaces

- [x] T-03.5 Update consumer guidance and generated plugin surfaces. ✅ (completed: 2026-07-27 01:55)

- Correct stale editor clipboard documentation.
- Document the canonical clipboard model, primary portable shortcuts, host aliases, browser
      permission behavior, and native OSC 52 limitation.
- Update the kitchen-sink clipboard examples or hints so `Input` and `CodeEditor` visibly
      demonstrate the same behavior.
- Review every reference reported by `tools/jsvision-plugin-impact.json` for the changed
      source paths.
- Run the plugin generator and include its generated documentation, recipes, snapshot, and
      assembled skill updates.

**Verify**:

```sh
yarn plugin:update
yarn plugin:check
yarn check:docs
```

**Verification evidence**: plugin generation and integrity checks passed; repository documentation
checks passed for all eight documented packages; docs-site typecheck and 96 tests passed; examples
typecheck and 341 tests passed. The source-impact snapshot and assembled Codex skill were refreshed.

### T-03.6 — Run the cross-platform release gate

- [x] T-03.6 Run the cross-platform release gate.
  ✅ (completed: 2026-07-27 03:15)

- Run focused clipboard suites after all implementation and documentation changes.
- Run the authoritative repository verification gate.
- Confirm the CI matrix still exercises Node 22 and 24 on Ubuntu, macOS, and Windows.
- Record any remaining terminal-emulator limitation as capability behavior, with a regression
      test for graceful fallback.
- Update this plan and the maintenance roadmap with final verification evidence.

**Verify**:

```sh
yarn verify
```

**Verification evidence**: `yarn verify` passed in 212.08 seconds with 38/38 workspace tasks.
UI passed 327 files and 1,901 tests; CodeEditor passed 49 files and 346 tests. Serial performance
budgets, documentation checks, and plugin integrity passed. The CI matrix remains Node 22 and 24
across Ubuntu, macOS, and Windows. Unsupported host clipboard paths retain the canonical in-memory
clipboard and are covered by capability and rejection regressions.

## Quality review

| Finding | Severity | Resolution |
|---------|----------|------------|
| RV-001 | Major | Resolved: Editor paste reads only the canonical event-loop clipboard; stale visible projection text cannot override Input or host-origin data. |
| RV-002 | Minor | Resolved: generated interface method signatures preserve `?`, with generator regression coverage and refreshed canonical/distributed references. |
| RV-003 | Minor | Resolved after the scoped re-review: canonical copy/cut writes notify event-scoped projection observers, so Input and CodeEditor refresh visible projections immediately; observer failures are isolated. |

- **Authority**: User — the user explicitly authorized fixing the review findings as completely as
  practical.
- **Hardening**: One independent phase review identified RV-001 and RV-002. The single permitted
  scoped re-review confirmed both resolved and identified RV-003. RV-003 was then fixed and covered
  by focused Input, CodeEditor, canonical-commit, and observer-failure tests; the final full gate
  passed. No further re-review was run because the review budget was exhausted.
- **Confidence**: High — the behavior is grounded in one canonical ownership boundary, immutable
  cross-control specifications, focused implementation regressions, the full repository gate, and
  the six-platform CI matrix.
- **Reopen triggers**: A new editable control bypasses `DispatchEvent.setClipboard`, a host adapter
  writes terminal-ready data into the canonical buffer, or a mainstream host cannot deliver its
  documented copy/paste gesture.

## Completion Criteria

- All six tasks and their verification commands pass.
- The three editable controls conform to one tested clipboard behavior contract.
- Browser copy reaches the browser Clipboard API and browser paste reaches the focused control.
- Native copy uses OSC 52 only on supporting terminals and fails safely everywhere else.
- Windows, macOS, and Linux CI remain green.
- Plugin and consumer documentation match the shipped behavior.
