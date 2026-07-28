# Requirements: Native Clipboard

> **Status**: Approved
> **Owning set**: [clipboard-native requirements](../../requirements/README.md)
> **CodeOps Artifact Schema**: 1

## Traceability

| Requirement | Plan ownership | Acceptance summary |
|---|---|---|
| [RD-01](../../requirements/RD-01-host-neutral-clipboard-adapters.md) | 03-01, 03-02, 03-03 | Optional raw-text seams; canonical write/read; ordering; destination continuity; lifecycle and UTF-8 bounds |
| [RD-02](../../requirements/RD-02-tvedit-native-adapter.md) | 03-04 | Private examples dependency, async `clipboardy` mapping, injection, headless degradation |
| [RD-03](../../requirements/RD-03-quality-compatibility-release.md) | 03-05, 07, 99 | Immutable specs, compatibility/security coverage, docs/plugin sync, automated and manual evidence |

## Plan-level acceptance criteria

1. Public SDK packages expose only host-neutral `string`/`Promise<string>` callback contracts.
2. Existing no-adapter copy, cut, paste, OSC 52, bracketed paste, and application command handling
   remain compatible.
3. One native read is attempted per eligible unhandled paste gesture, reads execute serially, and
   results deliver in gesture order without blocking input/rendering.
4. A result is adopted and delivered only while scope, route, focus/modal generation, lifecycle
   generation, and mount incarnations are unchanged.
5. Direct native strings are bounded to `PASTE_CAP_BYTES` without splitting a Unicode code point.
6. Empty success clears canonical state and performs no edit; failure falls back once to the
   canonical value at ordered delivery.
7. `clipboardy` is a private examples runtime dependency and automated tests use injected fakes,
   never the machine clipboard.
8. Clipboard contents, derived previews, thrown host values, stderr, and helper details are absent
   from logs.
9. Consumer documentation and every impacted canonical/generated plugin surface are synchronized.
10. Focused tests, package checks, `yarn plugin:check`, and `yarn verify` pass; the environmental
    matrix reports only actually observed results.

## Scope exclusions

Rich clipboard formats, polling, history, retries, timeouts, automatic helper installation, OSC 52
reads, remote-local SSH transport, terminal-owned shifted shortcuts, and issue #188 implementation
remain excluded.
