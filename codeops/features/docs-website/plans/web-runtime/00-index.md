# `@jsvision/web` Browser Runtime — Implementation Plan

> **Feature**: Extract the proven `packages/examples/web-xterm/` spike into a first-class, tested
> `@jsvision/web` package — the runtime that lets any JSVision app run in a browser tab inside an
> xterm.js terminal, with no backend: a browser host over the reused pure engine, a browser
> capability profile, an in-memory virtual `FileSystem`, key-chord reclaim, a clipboard bridge, and
> the node-builtin stub strategy.
> **Implements**: docs-website/RD-02
> **Source**: [RD-02](../../requirements/RD-02-web-runtime.md)
> **Status**: Planning Complete
> **Created**: 2026-07-09
> **CodeOps Skills Version**: 3.3.2

## Overview

`@jsvision/web` is the second slice of the docs-website feature-set (Phase A) and the substrate the
whole live-example story runs on. The engine is already host-agnostic — `serialize()` emits ANSI,
`decode()` consumes ANSI, which is exactly xterm.js's output/input contract — so this package
**replaces only the OS boundary** and adds the three browser-specific facilities a real app needs:
an in-memory virtual FileSystem (so file/directory dialogs and the editor work), key-chord reclaim
(so the browser doesn't steal F-keys and chords from a focused terminal), and a clipboard bridge.

The behavior is already proven in the spike (`packages/examples/web-xterm/`): `createBrowserHost`
renders and decodes correctly against the reused engine. This plan promotes that behavior into a
tested package — **verbatim in behavior, rewritten in JSDoc** (the spike's comments carry banned
CodeOps IDs that `check:docs` rejects in shipped code) — implements the virtual FS + reclaim +
clipboard as first-class tested surfaces, ships the node-builtin stub as a `browser-stubs` subpath,
adds the `mountApp` convenience RD-03 builds its Play dialog on, and dogfoods the extraction back
into the spike.

Unlike the docs-site, `@jsvision/web` is a genuine product surface: its build script **is** named
`build`, so it participates fully in `yarn verify`/CI (typecheck, build, unit tests, `check:deps`,
`check:docs`). It carries **zero native runtime dependencies** — xterm is a peer/optional dependency
of consumers, and `@xterm/headless` is a devDependency for the host/decode golden tests.

## Document Index

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — 8/8 resolved |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria (from RD-02) |
| [02-current-state.md](02-current-state.md) | The spike, the reused engine surface, the `FileSystem` seam, package/tooling conventions |
| [03-01-package-scaffold.md](03-01-package-scaffold.md) | The `packages/web` workspace: package.json, tsconfig, vitest, index barrel, `browser-stubs` subpath, turbo/verify wiring |
| [03-02-browser-host.md](03-02-browser-host.md) | `createBrowserHost`, `start()` DECSET modes, `buildBrowserCaps`, the `mountApp` convenience |
| [03-03-virtual-filesystem.md](03-03-virtual-filesystem.md) | The in-memory seedable `FileSystem` implementation |
| [03-04-browser-integration.md](03-04-browser-integration.md) | Key-chord reclaim, clipboard bridge, node-builtin stub strategy + entry-point docs, spike dogfood |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-1…ST-12 ↔ AC-1…AC-9) |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, ordering, progress |

## Key Decisions (see the register for full traceability)

| Decision | Choice | AR |
|----------|--------|----|
| Entry-point shape | Single `.` entry + shipped `@jsvision/web/browser-stubs` subpath + documented Vite-alias guidance | AR-1 |
| Version sync | Static at root version (`0.1.0`) like `@jsvision/files`; no `sync-versions` change | AR-2 |
| Should-Have scope | Include `mountApp`; defer the File System Access bridge + WebGL helper | AR-3 |
| DOM test environment | Hand-mocked globals (no `jsdom`/`happy-dom`); host/decode via `@xterm/headless` | AR-4 |
| Spike disposition | Refactor `web-xterm` to consume the package (dogfood) | AR-5 |
| Virtual FS fidelity | Files + dirs only, deterministic mtime, POSIX string ops, matching error shapes | AR-6 |
| Kitchen-sink story | None (non-visual runtime infra; RD-03 is its live demo) | AR-7 |

## Verify

- **Package integrity**: `yarn verify` (lint → turbo `typecheck build test check:docs`) stays green,
  now including `@jsvision/web`.
- **Dependency policy**: `yarn check:deps` green (no native runtime dependency in `@jsvision/web`).
- Commits via `/gitcm` / `/gitcmp` — never raw git in plan docs.
