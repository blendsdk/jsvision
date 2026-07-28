# Component: `tvedit` Native Clipboard Adapter

> **Implements**: RD-02
> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Responsibility

Demonstrate symmetric desktop clipboard integration in `tvedit` while keeping all OS process
integration and dependency ownership inside private `@jsvision/examples`.

## Dependency and composition

- Recheck the current compatible release before editing the manifest; planned range is
  `clipboardy: ^5.3.2` on the repository's Node 22+ baseline.
- Add it only to `packages/examples/package.json` runtime dependencies and review the lockfile diff.
- Import only asynchronous `read` and `write`; do not call synchronous APIs.
- Map them to raw-text UI callbacks without adding normalization, previews, or exception logging.
- Keep a small adapter factory dependency-injectable so automated tests use fakes.

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
