# Native Clipboard Implementation Plan

> **Feature**: Optional host-neutral native plain-text clipboard integration
> **Implements**: clipboard-native/RD-01, clipboard-native/RD-02, clipboard-native/RD-03
> **Status**: Implementation Complete
> **Created**: 2026-07-28
> **Source**: [GitHub issue #191](https://github.com/blendsdk/jsvision/issues/191)
> **CodeOps Artifact Schema**: 1

## Outcome

Add symmetric native clipboard callbacks and install a lazy system clipboard automatically for
native `Application.run()`, with an explicit opt-out and custom callback precedence. Native paste
requests are serialized, bounded to the existing UTF-8 safety limit, and delivered only to the
unchanged focus/modal/mount destination. Published UI owns `clipboardy` as an optional dependency;
all opted-out and degraded paths retain app-local and bracketed-paste behavior.

## Document index

| # | Document | Ownership |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Resolved implementation decisions |
| 01 | [Requirements](01-requirements.md) | Traceable scope and plan-level acceptance |
| 02 | [Current State](02-current-state.md) | Grounded repository analysis and change map |
| 03-01 | [Bounded Paste Text](03-01-bounded-paste-text.md) | Core UTF-8 cap and widget empty parity |
| 03-02 | [Host Adapter API](03-02-host-adapter-api.md) | Public callback configuration and write compatibility |
| 03-03 | [Ordered Focus-safe Paste](03-03-ordered-focus-safe-paste.md) | Command routing, serialization, continuity, teardown |
| 03-04 | [`tvedit` Native Adapter](03-04-tvedit-native-adapter.md) | Superseded example-only integration decision |
| 03-05 | [Documentation, Plugin, and Release](03-05-documentation-plugin-release.md) | Consumer guidance and generated surfaces |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification-first cases and verification matrix |
| 08-05 | [Phase 5 Quality Review](08-phase-5-quality-review.md) | Default-on runtime review and audit evidence |
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

Application.run() ── lazy clipboardy read/write ──► event-loop callbacks
```

## Quick reference

| Contract | Planned outcome |
|---|---|
| Automatic default | Native reader/writer installed lazily by `Application.run()` |
| Opt-out | `systemClipboard: false` retains local clipboard and OSC 52 behavior |
| Native success | Bound raw text, adopt canonically, deliver once in request order |
| Empty success | Canonical becomes empty; editable widgets perform no mutation |
| Native failure | Stable payload-free warning, then deliver current canonical fallback once |
| Destination changes | Drop result without adoption, dispatch, warning detail, or repaint |
| Stop/dispose | Invalidate queued/in-flight work; clear runtime callback references |
| Dependency | Optional `clipboardy ^5.3.2` in published `@jsvision/ui`; loaded on first operation |
| Final gate | Focused checks, `yarn plugin:check`, authoritative `yarn verify` |

## Expected modification set

- `packages/core/src/engine/input/` and public exports
- `packages/ui/src/event/`, `packages/ui/src/app/`, editable widget implementations, and exports
- `packages/examples/src/`, package manifest, tests, and lockfile
- `packages/docs-site/`, `tools/jsvision-skill/`, impact mapping when required, generated plugin
- `codeops/features/clipboard-native/` execution and traceability evidence

Anything outside this set requires an explicit plan update before implementation.
