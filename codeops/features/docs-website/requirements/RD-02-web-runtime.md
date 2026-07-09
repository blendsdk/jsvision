# RD-02: `@jsvision/web` Browser Runtime

> **Document**: RD-02-web-runtime.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: — (independent foundation RD; consumes already-shipped `@jsvision/core`,
> `@jsvision/ui`, `@jsvision/files`)
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

Extract the proven `packages/examples/web-xterm/` spike into a first-class, tested, reusable
package: **`@jsvision/web`**. It is the runtime that lets any JSVision application run in a browser
tab inside an [xterm.js](https://xtermjs.org) terminal, unchanged, with **no backend**. The engine
is already host-agnostic — `serialize()` emits ANSI, `decode()` consumes ANSI, which is exactly
xterm.js's output/input contract — so this package only replaces the OS boundary and adds the three
browser-specific facilities a real app needs: an **in-memory virtual FileSystem** (so file/directory
dialogs and the editor work), **key-chord reclaim** (so the browser doesn't steal F-keys and
`Ctrl`/`Alt` chords from a focused terminal), and a **clipboard bridge** (so copy/paste works).

This package is what every live example (RD-03), the sample apps (RD-07), and the deferred playground
(RD-08/Phase E) run on. It is a genuine product surface — "JSVision in the browser" — not merely a
docs helper. It is **private until first release** and lockstep-versioned with the other public
packages.

---

## Functional Requirements

### Must Have

- [ ] A new package `packages/web` = `@jsvision/web` (`private: true`, ESM-only, `type: module`,
      `engines.node >= 20`), built with `tsc` to `dist/`, wired into `yarn` workspaces + `turbo.json`
      (`build`/`typecheck`/`test`/`check:deps`/`check:docs`) and `yarn sync-versions`.
- [ ] **`createBrowserHost({ term, caps, onInput })`** — the xterm.js host: `render(buffer)` diffs
      against the previous frame via `serialize()` and `term.write()`s the delta; xterm `onData`
      bytes feed `decode()`; a lone-ESC disambiguation timer mirrors the native host
      (`ESC_TIMEOUT_MS`); `setCaret(cell|null)` shows/positions or hides the caret. (Promotes
      `browser-host.ts` verbatim in behavior.)
- [ ] **`start()` mode setup** — emit the DECSET modes the native host would (SGR mouse `?1006`,
      button/drag tracking `?1000`/`?1002`, bracketed paste `?2004`, focus `?1004`, wrap-off `?7l`,
      cursor policy) so decoder caps and terminal behavior agree; **no alternate screen** (the demo
      owns the whole terminal).
- [ ] **A browser capability profile builder** — a truecolor + UTF-8 `CapabilityProfile` (the
      synthetic `LANG=…UTF-8` that flips `glyphs.boxDrawing`/`halfBlocks` on) so `serialize()` emits
      real box-drawing/blocks, with `colorDepth` overridable to exercise downsampling.
- [ ] **Browser virtual FileSystem** — an in-memory implementation of `@jsvision/files`' injectable
      `FileSystem` interface (path ops mirroring `node:path`; read/`readdir`/`stat` over an in-memory
      tree), seedable from a plain object, so `FileDialog`/`ChDirDialog`/`FileList`/`DirList`/
      `FileInput`/`FileInfoPane` and the editor run unchanged. It NEVER imports `node:fs`.
- [ ] **Key-chord reclaim** — an `attachKeyReclaim(term)` (or host option) that, while the terminal
      is focused, intercepts browser-hijacked chords and calls `preventDefault()` so they reach the
      TUI: at minimum F1–F12, `Ctrl+W`, `Ctrl+N`, `Ctrl+T`, `Ctrl+S`, `Ctrl+P`, `Tab`/`Shift+Tab`,
      `Alt+<letter>`, and `Backspace` (browser back). Chords that **cannot** be reclaimed on a given
      browser (e.g. `Ctrl+W` in some browsers) are enumerated in an exported constant so RD-05/RD-08
      can document the remap.
- [ ] **Clipboard bridge** — outbound OSC 52 (`setClipboard`) writes to the browser Clipboard API
      (gated on a user gesture); inbound paste uses xterm's bracketed-paste path. No automatic
      clipboard reads.
- [ ] **Node-builtin resolution** — a documented Vite alias/stub strategy for the `node:fs`/`node:tty`
      specifiers the `@jsvision/core` barrel statically imports (the native host, never called in the
      browser), so consumers get a clean bundle. Shipped as a small `browser-stubs` entry + guidance.
- [ ] A separate **`@jsvision/web/browser`** (or documented) entry point so consumers never pull
      `node:tty` into their bundle.

### Should Have

- [ ] A `mountApp({ element, app, caps })`-style convenience that wires an `@jsvision/ui`
      `Application`'s loop to a freshly created xterm terminal (frame/caret/clipboard sinks, resize,
      focus) — the browser mirror of `run()` — so a consumer needs a few lines, not the full boot
      dance. (This is the primary API RD-03 builds the Play dialog on.)
- [ ] A **File System Access API** bridge for the virtual FS: optional open/save to real local files
      via the browser picker (download blob + upload input fallback), used by tvedit (RD-07).
- [ ] WebGL renderer helper (load `@xterm/addon-webgl`, fall back to DOM) so chrome glyphs are crisp.

### Won't Have (Out of Scope)

- Native `tty`/signals/suspend-resume/`process.exit` — no browser meaning (as the spike notes).
- Any docs-site UI (Play button, dialog chrome) — RD-03.
- Bundling/serving — the consumer (docs-site) owns Vite config; `@jsvision/web` ships library code.

---

## Technical Requirements

### The host boundary (reused engine)

| Concern | Native (`@jsvision/core` `createHost`) | `@jsvision/web` |
|---------|----------------------------------------|-----------------|
| output | `serialize()` → `stdout.write(ansi)` | `serialize()` → `term.write(ansi)` |
| input | `stdin.on('data')` → `decode()` | `term.onData()` → `decode()` |
| resize | `SIGWINCH` → `{cols,rows}` | `term.onResize()` → `{cols,rows}` |
| caps | `resolveCapabilities(process.env)` | fixed truecolor+UTF-8 profile |
| caret | terminal cursor | `cursor.show()`/`hide()`/`to()` |

`serialize`/`decode`/`flush`/`cursor`/`ESC_TIMEOUT_MS` are imported from `@jsvision/core` and used
**verbatim** — no fork, no shim. This is the invariant the tests must lock down.

### Virtual FileSystem contract

- Implements the exact `FileSystem` interface from `@jsvision/files` (`packages/files/src/fs/types.ts`).
- Backed by an in-memory tree; `seed(tree)` builds it from `{ [path]: string | Directory }`.
- Path methods are pure string ops (POSIX semantics); reads return seeded contents; writes (for
  tvedit) mutate the in-memory tree only.
- Throws the same error shapes `@jsvision/files` expects on missing/denied paths, so dialog error
  flows render identically to native.

### Package shape

- Zero **native** runtime dependencies (`check:deps` passes). `@xterm/xterm` (+ optional addons) is a
  peer/optional dependency of consumers, not bundled into `dist`.
- Public surface exported from `src/index.ts` with full JSDoc + `@example` (the repo's
  `check:docs`/`check-jsdoc.mjs` rules apply: no CodeOps/TV-C++ references in shipped code).

---

## Integration Points

### With `@jsvision/core`
- Consumes `serialize`/`decode`/`flush`/`createDecoderState`/`cursor`/`ESC_TIMEOUT_MS`/
  `resolveCapabilities` + types. Requires the `node:fs`/`node:tty` static-import stub strategy.

### With `@jsvision/files`
- Implements its injectable `FileSystem`; a regression test mounts a real `FileDialog` against the
  virtual FS headlessly.

### With RD-03 (live-example system)
- RD-03's Play dialog calls the `mountApp` convenience; the DemoShell theme switcher drives the caps
  profile's `colorDepth` to demo downsampling.

### With RD-07 (sample apps)
- tvedit uses the File System Access bridge; the file/data browser uses the seeded virtual tree.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Host placement | First-class package / inside docs-site | `@jsvision/web` package | Tested, reusable, a real product surface | AR-6 |
| Browser fs | Virtual in-memory / backend / skip | In-memory virtual `FileSystem` | `@jsvision/files` already injects it; no backend | AR-2 |
| Package name/visibility | `@jsvision/web`, private / other | `@jsvision/web`, private until first release | Lockstep-versioned; clear "web" surface | AR-25 |
| Uploads | Client-only virtual FS / transmit | Stay in the browser, never transmitted | Static site, privacy, security | AR-26 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: uploaded/edited files (tvedit, file browser) may be the user's own content;
  they **stay entirely in the browser** (virtual FS / File System Access API) and are **never
  transmitted** anywhere — there is no backend to transmit to (AR-26).
- **Input validation**: all terminal input flows through the engine's existing byte `decode()` path;
  all text rendered to the buffer flows through `@jsvision/core`'s `sanitize()` injection boundary, so
  untrusted file contents or pasted text cannot inject escape sequences.
- **Authentication & authorization**: N/A (no accounts, no server).
- **Injection risks**: escape-sequence injection is the relevant vector and is closed by `sanitize()`
  (already the canonical boundary in core); the virtual FS performs no shell/`eval`/path execution —
  paths are pure string operations with `..` normalized, never resolved against a real filesystem.
- **Clipboard**: outbound writes require a user gesture (browser policy); the runtime never performs
  an automatic/silent clipboard read.
- **Encryption**: N/A at rest (in-memory only); site served over HTTPS.
- **Infrastructure**: zero native deps (`check:deps`); xterm is a peer/optional dep, pinned by the
  consumer; no secrets.

---

## Acceptance Criteria

1. [ ] `yarn workspace @jsvision/web build` emits `dist/index.js` + `dist/index.d.ts`; `yarn check:deps`
       for `@jsvision/web` passes (no native runtime dependency).
2. [ ] A headless test constructs `createBrowserHost` over a `@xterm/headless` `Terminal`, renders a
       known `ScreenBuffer`, and asserts the bytes written to the terminal **exactly equal**
       `serialize(buffer, null, { caps })` — proving the engine is reused verbatim, not reimplemented.
3. [ ] Feeding the host xterm-encoded input bytes for `ArrowUp` (`\x1b[A`) produces exactly one
       decoded `{ type: 'key', key: 'up', ctrl:false, alt:false, shift:false }` on `onInput`; a lone
       trailing `ESC` is emitted as an Escape key only after `ESC_TIMEOUT_MS`, not before.
4. [ ] A `FileList` (or `FileDialog`) from `@jsvision/files` mounted against the browser virtual
       FileSystem seeded with `{ '/home/demo': { 'a.txt':'…', 'sub': { 'b.txt':'…' } } }` lists
       `a.txt` and `sub`, and entering `sub` lists `b.txt` — with no `node:fs` import present in the
       bundle (verified by an import-graph assertion / build with the stubs).
5. [ ] With key-chord reclaim attached and the terminal focused, an `F1` keydown has
       `defaultPrevented === true` and the decoded `f1` key reaches `onInput`; the exported
       "unreclaimable chords" constant lists any chord the current browser cannot intercept.
6. [ ] `setClipboard('copied', caps)` triggers exactly one browser Clipboard API write of the string
       `copied` (mocked in test); no clipboard **read** is ever issued by the runtime.
7. [ ] Setting the caps profile `colorDepth` to `'16'` causes `serialize()` output for a truecolor
       style to downsample (a known truecolor bg encodes to a 16-color SGR), proving the profile
       drives the existing downsample chain.
8. [ ] Every public export of `@jsvision/web` has JSDoc with an `@example`; `yarn check:docs` for the
       package passes (no CodeOps/TV-C++ references).
9. [ ] Security requirements verified: rendered untrusted file content containing a raw `ESC` byte is
       stripped by `sanitize()` (no escape reaches the terminal write); virtual-FS path handling
       normalizes `..` and never touches a real path; uploaded content never leaves the browser
       (no network request is made on open/save in the virtual-FS path).
