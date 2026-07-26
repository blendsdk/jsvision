# Task T-03: Unify Clipboard Behavior Across Widgets and Hosts

> **Type**: Maintenance bug fix
> **Feature-Set**: `_maintenance`
> **Status**: Plan Created
> **Created**: 2026-07-26
> **Last Updated**: 2026-07-26 23:24
> **Progress**: 1/6 tasks complete
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

- [ ] T-03.2 Establish one raw-text clipboard pipeline.

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

### T-03.3 — Connect browser and native host adapters

- [ ] T-03.3 Connect browser and native host adapters.

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

### T-03.4 — Align every editable control

- [ ] T-03.4 Align every editable control.

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

### T-03.5 — Update consumer guidance and generated plugin surfaces

- [ ] T-03.5 Update consumer guidance and generated plugin surfaces.

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
yarn workspace @jsvision/docs-site check:docs
```

### T-03.6 — Run the cross-platform release gate

- [ ] T-03.6 Run the cross-platform release gate.

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

## Completion Criteria

- All six tasks and their verification commands pass.
- The three editable controls conform to one tested clipboard behavior contract.
- Browser copy reaches the browser Clipboard API and browser paste reaches the focused control.
- Native copy uses OSC 52 only on supporting terminals and fails safely everywhere else.
- Windows, macOS, and Linux CI remain green.
- Plugin and consumer documentation match the shipped behavior.
