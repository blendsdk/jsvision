# JSVision Native Clipboard — Requirements Documents

> **Project**: JSVision — optional symmetric native plain-text clipboard integration
> **Status**: Complete
> **Created**: 2026-07-28
> **Source**: [GitHub issue #191](https://github.com/blendsdk/jsvision/issues/191)
> **Architecture**: Node 22+, ESM TypeScript, Yarn workspaces, host-neutral UI with example-owned OS adapter
> **CodeOps Artifact Schema**: 1

## Overview

JSVision already owns a canonical application-local plain-text clipboard and mirrors copy/cut to
browser or capability-gated terminal hosts. Native terminal applications still cannot use ordinary
`Ctrl+C` and `Ctrl+V` symmetrically with the desktop clipboard when OSC 52 is unavailable, notably
in stock GNOME Terminal.

This feature adds optional raw-text host callbacks, ordered focus-safe asynchronous reads, and a
`clipboardy` adapter owned only by the private `tvedit` example. SDK consumers that configure
nothing retain the merged PR #190 behavior. Terminal bracketed paste remains an independent direct
`PasteEvent` route, including the CodeEditor behavior tracked by issue #188. *(AR-01–AR-05,
AR-10–AR-14)*

## Selected domain lenses

| Lens | Evidence |
|---|---|
| Distributed and concurrent | Clipboard reads are asynchronous requests whose completion may reorder, outlive focus/modal state, or settle after teardown. |
| Data and migration | Raw text has a canonical representation, UTF-8 byte boundary, compatibility contract, and state-adoption rules across existing and new host paths. |

Universal security, public API, accessibility, failure, compatibility, traceability, and
verification concerns also apply.

## Stakeholders

| Role | Key need |
|---|---|
| Local desktop TUI user | Ordinary `Ctrl+C`/`Ctrl+V` interoperability with desktop applications. |
| SDK application author | Optional host-neutral callbacks with safe fallback and no OS package dependency in UI. |
| Framework maintainer | Deterministic ordering, lifecycle safety, reusable bounds, and regression coverage. |
| Headless/remote/restricted user | Continued app-local clipboard and terminal bracketed paste when native access fails. |
| Documentation and Codex-plugin consumer | Accurate public contracts, recipes, limitations, and generated API guidance. |

## Comparable-system analysis

| System | Relevant behavior adopted | Behavior deliberately excluded |
|---|---|---|
| VS Code and mainstream desktop editors | One ordinary copy/paste shortcut family and focus-bound insertion. | Rich formats, files, images, clipboard history. |
| GNOME Terminal / VTE | Respect that shifted copy is terminal-owned while raw-mode `Ctrl+C`/`Ctrl+V` reaches the TUI. | Terminal reconfiguration or replacement. |
| Browser Clipboard API hosting | Optional request-driven raw-text adapter that may reject without corrupting local state. | Permission policy changes and browser-native reads. |
| `clipboardy` 5.3 | Async cross-platform text read/write with platform helpers and documented headless failure. | Sync methods, image APIs, automatic system installation. |

## Domain glossary

| Term | Definition |
|---|---|
| Canonical clipboard | The event loop's in-memory raw plain-text value used for reliable app-local fallback. |
| Native adapter | Optional application-owned callback that reads or writes desktop clipboard text. |
| Native paste request | One explicit `Commands.paste` gesture handled while a reader is configured. |
| Paste destination | The captured focused-leaf route and active modal scope that would receive a paste event. |
| Destination generation | Internal continuity token changed by focus or modal-scope transitions so leave-and-return races are rejected. |
| Mount incarnation | Internal token distinguishing one continuous mount from a later remount of the same view object. |
| Bracketed paste | Terminal-decoded `PasteEvent` input that already contains text and must not invoke a native reader. |
| Bounded paste | Text limited to `PASTE_CAP_BYTES` UTF-8 bytes without a partial code point, with an accurate `truncated` flag. |
| Fallback paste | Exactly one delivery of the then-canonical app-local value after a native read fails. |

## Document index

| # | Document | Description | Depends On |
|---|---|---|---|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Product decisions and delegated technical design | — |
| **RD-01** | [Host-neutral clipboard adapters](RD-01-host-neutral-clipboard-adapters.md) | Public callbacks, canonical state, ordered focus-safe reads, UTF-8 bounds, lifecycle | — |
| **RD-02** | [`tvedit` native adapter](RD-02-tvedit-native-adapter.md) | Example-owned `clipboardy` integration and platform behavior | RD-01 |
| **RD-03** | [Quality, compatibility, and release governance](RD-03-quality-compatibility-release.md) | Security, performance, tests, docs, plugin synchronization, manual evidence | RD-01, RD-02 |

## Dependency graph

```text
RD-01 Host-neutral clipboard adapters
  └── RD-02 tvedit native adapter
        └── RD-03 Quality, compatibility, and release governance
RD-01 ────────────────────────────────────────────────────────┘
```

## Suggested implementation order

| Phase | Documents | Description |
|---|---|---|
| **A: Framework** | RD-01 | Specify and implement the bounded host-neutral pipeline and async invariants. |
| **B: Native demonstration** | RD-02 | Inject `clipboardy` into `tvedit` without leaking it into SDK packages. |
| **C: Release evidence** | RD-03 | Complete parity, security, docs/plugin, focused gates, and manual matrix reporting. |

## Key architecture decisions

| Decision | Choice | AR Ref |
|---|---|---|
| Read scheduling | One non-blocking serialized read queue | AR-07 |
| Target safety | Route, generation, lifecycle, and mount-incarnation continuity | AR-06, AR-08 |
| Delivery | Existing `PasteEvent` route after an atomic synchronous guard | AR-05, AR-06 |
| Byte safety | Core-owned bounded `TextEncoder.encodeInto` helper | AR-09 |
| Dependency ownership | `clipboardy` only in private examples | AR-10, AR-11 |
| Degradation | Canonical local fallback; no polling, retries, prompts, or installs | AR-04, AR-05, AR-14, AR-17 |

## User journeys

1. A local `tvedit` user selects Unicode text and presses `Ctrl+C`. JSVision commits the raw
   selection locally, then the native writer makes it available to desktop applications.
2. The user copies text in another application and presses `Ctrl+V` in a focused JSVision editor.
   JSVision captures the destination, reads asynchronously, bounds the result, revalidates the
   destination, adopts the result, and delivers one normal paste.
3. A reader fails over SSH or without a display. The same captured destination receives the
   canonical app-local value once; bracketed terminal paste remains available.
4. Focus changes, a modal opens, the view remounts, or the app stops before completion. The result is
   discarded without state adoption, logging clipboard data, dispatch, or repaint.

## Explicit exclusions

- `Ctrl+Shift+C` semantic selection copy in terminals that consume the chord.
- OSC 52 clipboard reads or terminal clipboard queries.
- Clipboard history, monitoring, polling, rich text, HTML, images, files, or multiple MIME types.
- Automatic installation of `wl-clipboard`, `xsel`, or any other system package.
- Remote-local clipboard transport over SSH.
- Replacing `clipboardy` with platform-specific Node addons.
- Implementing the widget-local CodeEditor bracketed-paste fix tracked by issue #188.

## How to use these documents

The three RDs form one planning group. The implementation plan under
`plans/native-clipboard/` traces all three documents and preserves specification-first ordering.
