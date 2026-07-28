# Native Clipboard Implementation Plan

> **Feature**: Optional host-neutral native plain-text clipboard integration
> **Implements**: `clipboard-native/RD-01`, `clipboard-native/RD-02`, `clipboard-native/RD-03`
> **Status**: Planning Complete
> **Created**: 2026-07-28
> **Source**: [GitHub issue #191](https://github.com/blendsdk/jsvision/issues/191)
> **CodeOps Artifact Schema**: 1

## Outcome

Add symmetric, optional native clipboard callbacks without introducing an OS dependency into SDK
packages. Native paste requests are serialized, bounded to the existing UTF-8 safety limit, and
delivered only to the unchanged focus/modal/mount destination. The private `tvedit` example owns
the `clipboardy` runtime adapter; all unconfigured and degraded paths retain app-local and
bracketed-paste behavior.

## Document index

| # | Document | Ownership |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Resolved implementation decisions |
| 01 | [Requirements](01-requirements.md) | Traceable scope and plan-level acceptance |
| 02 | [Current State](02-current-state.md) | Grounded repository analysis and change map |
| 03-01 | [Bounded Paste Text](03-01-bounded-paste-text.md) | Core UTF-8 cap and widget empty parity |
| 03-02 | [Host Adapter API](03-02-host-adapter-api.md) | Public callback configuration and write compatibility |
| 03-03 | [Ordered Focus-safe Paste](03-03-ordered-focus-safe-paste.md) | Command routing, serialization, continuity, teardown |
| 03-04 | [`tvedit` Native Adapter](03-04-tvedit-native-adapter.md) | Examples-owned `clipboardy` integration |
| 03-05 | [Documentation, Plugin, and Release](03-05-documentation-plugin-release.md) | Consumer guidance and generated surfaces |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification-first cases and verification matrix |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered task checklist |

## Architecture summary

```text
ApplicationOptions / EventLoopOptions
        │ raw read/write callbacks
        ▼
EventLoop canonical clipboard ── write ──► optional host writer
        │
        └─ unhandled Commands.paste
              → capture destination tokens
              → serialized async read
              → UTF-8 bound
              → atomic continuity guard
              → ordinary PasteEvent route

@jsvision/examples/tvedit ── clipboardy read/write ──► injected callbacks
```

## Quick reference

| Contract | Planned outcome |
|---|---|
| No adapter | Existing local clipboard and OSC 52 behavior unchanged |
| Native success | Bound raw text, adopt canonically, deliver once in request order |
| Empty success | Canonical becomes empty; editable widgets perform no mutation |
| Native failure | Stable payload-free warning, then deliver current canonical fallback once |
| Destination changes | Drop result without adoption, dispatch, warning detail, or repaint |
| Stop/dispose | Invalidate queued/in-flight work; clear runtime callback references |
| Dependency | `clipboardy ^5.3.2` only in private `@jsvision/examples`; recheck at execution |
| Final gate | Focused checks, `yarn plugin:check`, authoritative `yarn verify` |

## Expected modification set

- `packages/core/src/engine/input/` and public exports
- `packages/ui/src/event/`, `packages/ui/src/app/`, editable widget implementations, and exports
- `packages/examples/src/`, package manifest, tests, and lockfile
- `packages/docs-site/`, `tools/jsvision-skill/`, impact mapping when required, generated plugin
- `codeops/features/clipboard-native/` execution and traceability evidence

Anything outside this set requires an explicit plan update before implementation.
