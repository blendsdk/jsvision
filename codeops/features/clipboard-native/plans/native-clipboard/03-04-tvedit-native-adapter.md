# Component: Automatic Native Application Clipboard

> **Implements**: RD-02
> **Status**: Superseded and amended by execution-plan Phase 5
> **CodeOps Artifact Schema**: 1

## Responsibility

Enable symmetric desktop clipboard integration automatically for every native
`Application.run()`. The original `tvedit`-only implementation proved the adapter but was
superseded after kitchen-sink validation exposed its application-specific scope.

## Dependency and composition

- Recheck the current compatible release before editing the manifest; planned range is
  `clipboardy: ^5.3.2` on the repository's Node 22+ baseline.
- Add it to `packages/ui/package.json` optional runtime dependencies and review the lockfile diff.
- Import only asynchronous `read` and `write`; do not call synchronous APIs.
- Load it on the first system clipboard operation and map it to raw-text UI callbacks without
  normalization, previews, or exception logging.
- Install it only when no explicit callback owns the boundary; support
  `systemClipboard: false`.
- Keep the adapter factory dependency-injectable so automated tests use fakes.

## Runtime behavior

| Environment | Expected behavior |
|---|---|
| macOS | Async `pbcopy`/`pbpaste` path through `clipboardy`; raw Unicode/line endings preserved. |
| Windows | Hidden PowerShell/native helper path through `clipboardy`; no visible console window. |
| X11 Linux | `xsel` path when available. |
| Wayland Linux | Supported helper path when available. |
| Headless/SSH/missing helper | Payload-free warning and canonical app-local fallback; process remains usable. |

The framework and example do not install helpers, alter permissions, retry, poll, or claim remote
clipboard transport.

## Test seam

Automated tests inject:

- a writer spy proving exact raw text and non-fatal rejection;
- a reader sequence proving Unicode, empty success, failure, and order;
- a never/late-settling reader proving non-blocking lifecycle safety;
- host errors containing sentinel secrets to prove diagnostics do not expose them.

No automated test imports a platform executable, reads the developer clipboard, or writes it.

## Manual evidence

Execution records attempted matrix cells by OS, display/session, terminal, copy, paste, empty read,
and failure fallback. Unavailable environments are marked unavailable—not passed. Stock GNOME
Terminal is the priority Linux acceptance environment from issue #191.
