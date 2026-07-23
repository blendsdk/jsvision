# 01 · Requirements — `@jsvision/web` Browser Runtime

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-02](../../requirements/RD-02-web-runtime.md)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

## Objective

Ship `@jsvision/web`: a private, ESM-only, zero-native-runtime-dependency package that runs any
JSVision application in a browser xterm.js terminal with no backend, by replacing only the OS
boundary of the already-host-agnostic engine and adding the three browser facilities a real app
needs (virtual FS, key-chord reclaim, clipboard bridge).

## In Scope (Must-Have — RD-02)

1. **Package** `packages/web` = `@jsvision/web` (`private:true`, ESM, `type:module`,
   `engines.node >= 20`), `tsc` → `dist/`, wired into yarn workspaces + `turbo.json`
   (`build`/`typecheck`/`test`/`check:deps`/`check:docs`). Version static at root `0.1.0` (AR-2).
2. **`createBrowserHost({ term, caps, onInput })`** — the xterm.js host: `render(buffer)` diffs
   against the previous frame via `serialize()` and `term.write()`s the delta; `term.onData` bytes
   feed `decode()`; a lone-ESC disambiguation timer mirrors the native host (`ESC_TIMEOUT_MS`);
   `setCaret(cell|null)` shows/positions or hides the caret. Behavior promoted verbatim from the
   spike's `browser-host.ts`; JSDoc rewritten to shipped-code standards (03-02).
3. **`start()` DECSET mode setup** — SGR mouse `?1006`, button/drag tracking `?1000`/`?1002`,
   bracketed paste `?2004`, focus `?1004`, wrap-off `?7l`, hidden cursor; **no alternate screen**.
4. **Browser capability profile builder** — a truecolor + UTF-8 `CapabilityProfile` (synthetic
   `LANG=…UTF-8` flips `glyphs.boxDrawing`/`halfBlocks` on), `colorDepth` overridable to exercise
   downsampling.
5. **Browser virtual FileSystem** — an in-memory implementation of `@jsvision/files`' injectable
   `FileSystem` (the full interface — 14 methods + the `sep` property), seedable from a plain object, so the file-dialog family + editor
   run unchanged. Never imports `node:fs`. Files + dirs only, deterministic mtime (AR-6).
6. **Key-chord reclaim** — `attachKeyReclaim(term)` that, while the terminal is focused,
   `preventDefault()`s browser-hijacked chords (≥ F1–F12, `Ctrl+W/N/T/S/P`, `Tab`/`Shift+Tab`,
   `Alt+<letter>`, `Backspace`) so they reach the TUI; unreclaimable chords enumerated in an exported
   constant.
7. **Clipboard bridge** — outbound OSC 52 (`setClipboard`) → browser Clipboard API (gesture-gated);
   inbound paste via xterm's bracketed-paste path. **No automatic clipboard reads.**
8. **Node-builtin resolution** — a shipped `@jsvision/web/browser-stubs` subpath (promotes the
   spike's `node-stub.ts`) + documented Vite-alias guidance for the `node:fs`/`node:tty` specifiers
   the `@jsvision/core` barrel statically imports (AR-1).
9. Full JSDoc + `@example` on every public export; `check:docs` green (no CodeOps/TV-C++ references).

## In Scope (Should-Have taken this plan)

- **`mountApp({ element, app, caps })`** — the browser mirror of `run()`: wires an `@jsvision/ui`
  `Application`'s loop to a freshly created xterm terminal (frame/caret/clipboard sinks, resize,
  focus). The primary API RD-03's Play dialog builds on (AR-3).

## Out of Scope

- **Deferred Should-Haves** (AR-3): the File System Access API bridge (RD-07/tvedit consumer) and the
  WebGL renderer helper (nicety) — land when their consumers do.
- **RD Won't-Have**: native tty/signals/suspend-resume/`process.exit` (no browser meaning); any
  docs-site UI (Play button, dialog chrome) — RD-03; bundling/serving — the consumer (docs-site) owns
  Vite config; `@jsvision/web` ships library code only.
- **Symlink emulation** in the virtual FS (AR-6) — deferrable if a later demo needs it.
- **A kitchen-sink story** (AR-7) — non-visual runtime infra; RD-03 is its live demo.

## Success Criteria

The RD-02 acceptance criteria AC-1…AC-9, realized as ST-1…ST-12 in
[07-testing-strategy.md](07-testing-strategy.md). Definition of done: every ST green, `yarn verify`
green (incl. `@jsvision/web` typecheck/build/test/check:docs), `yarn check:deps` green, and the
`web-xterm` spike refactored to consume the package with its demo behavior unchanged.
