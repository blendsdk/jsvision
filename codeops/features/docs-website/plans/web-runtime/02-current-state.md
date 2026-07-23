# 02 · Current State — `@jsvision/web` Browser Runtime

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

What exists today, verified by reading the repo. The extraction has a strong head start: the browser
host is behavior-complete in a spike, and every seam it needs is already shipped.

## The spike — `packages/examples/web-xterm/` (behavior-complete)

| File | What it proves | Fate |
|------|----------------|------|
| `browser-host.ts` | `createBrowserHost` — `render()` diffs via `serialize()` → `term.write()`; `onData` → `decode()`; lone-ESC timer (`ESC_TIMEOUT_MS`); `setCaret()`. **This is the host, done.** | Promote to `packages/web/src/host.ts` — behavior verbatim, JSDoc rewritten (see below). |
| `app.ts` (`WEB_CAPS`) | The browser caps profile: `resolveCapabilities({ env:{ COLORTERM:'truecolor', TERM:'xterm-256color', LANG:'en_US.UTF-8' }, platform:'linux', override:{ colorDepth:'truecolor' } }).profile`. | Extract the profile builder to `packages/web/src/caps.ts`; the rest of `app.ts` stays a demo. |
| `node-stub.ts` | Throwing stubs for `node:fs` (`writeSync`/`openSync`/`closeSync`) + `node:tty` (`ReadStream`/`WriteStream`), the only Node built-ins in the `@jsvision/core` graph. | Promote to `packages/web/src/browser-stubs.ts`, exported as the `./browser-stubs` subpath. |
| `vite.config.ts` | The consumer adaptation: `resolve.alias` maps `node:fs`/`node:tty` → the stub; `define` fixes `process.env.NODE_ENV`. | Document as the canonical consumer alias recipe; the demo keeps its own, now pointing at the package stub. |
| `main.ts` | The full boot dance (mirror of `run()`): loop sinks → host, `onData` → `dispatch`, resize, clock, focus. | Distill the reusable core into `mountApp`; the demo's `main.ts` shrinks to a few lines. |

> **Shipped-code hygiene (hard constraint).** The spike JSDoc references CodeOps IDs (`HR-24`,
> `AR-14`, `PA-9`, `HR-07`) and "Turbo Vision application". `check-jsdoc.mjs` (in `check:docs`, in
> `yarn verify`) **rejects** those in `packages/*/src`. Promotion rewrites every doc comment to the
> user-facing standard + adds an `@example` to each export.

## The reused engine surface (`@jsvision/core`, verbatim)

`createBrowserHost` imports and uses, unchanged, from the package barrel:
`serialize`, `decode`, `flush`, `createDecoderState`, `cursor`, `ESC_TIMEOUT_MS`, `resolveCapabilities`
+ types `CapabilityProfile`, `ScreenBuffer`, `InputEvent`. The invariant the tests lock down (AC-2):
the bytes the host writes **equal** `serialize(buffer, null, { caps })` — the engine is reused, not
reimplemented. `sanitize()` (also core) is the injection boundary that makes untrusted file/paste
content safe to render (AC-9).

The only Node built-ins the core graph statically imports are `node:fs` + `node:tty`. `node:tty` and
two `node:fs` sites live in the native `host/` subsystem (`streams.ts`, `platform.ts`); a third
`node:fs` site is `safety/logger.ts` — a barrel-reachable `import * as nodeFs from 'node:fs'` used
only as the screen-safe logger's default filesystem (load-safe: the namespace is dereferenced lazily
and the logger is off by default). The browser calls none of them — hence the stub.

## The `FileSystem` seam (`@jsvision/files`)

`packages/files/src/fs/types.ts` defines the injectable `FileSystem` — **14 synchronous methods + the
`sep` property** (15 members):
`readDir`, `stat`, `lstat`, `resolve`, `isAbsolute`, `join`, `dirname`, `basename`, `sep` (property),
`homedir`, `roots`, `readFile`, `writeFile`, `rename`, `unlink` (+ the `DirEntry`/`FileStat` shapes).
`nodeFileSystem` (`fs/node-fs.ts`) is the default Node implementation; the whole dialog family
(`FileDialog`/`ChDirDialog`/`FileList`/`DirList`/`FileInput`/`FileInfoPane`) + the editor already
accept an injected `FileSystem`, so the virtual FS drops in with no widget change. The virtual FS
must throw the **same error shapes** on missing/denied paths so dialog error boxes render identically.

## Package + tooling conventions (mirror `@jsvision/files`)

`packages/files/package.json` is the template: `private:true`, `type:module`, `engines.node>=20`,
`sideEffects:false`, `types`/`exports` → `dist`, `files:[dist,README,LICENSE]`, scripts
`build`/`typecheck`/`test`/`test:e2e`/`check:deps`/`check:docs`, deps `@jsvision/core`+`@jsvision/ui`,
devDeps `@types/node`+`vitest`. `turbo.json` already fans every task over `packages/*` (no per-package
entry needed). `scripts/sync-versions.mjs:6` **skips `private:true`** — so `@jsvision/web` stays at
`0.1.0` statically (AR-2), exactly like `@jsvision/files`. Root `workspaces:["packages/*"]` picks up
the new folder automatically.

Tests live in `packages/web/test/` (never colocated), split `*.spec.test.ts` (immutable spec oracle)
/ `*.impl.test.ts` (internals), per the repo's vitest `unit`/`e2e` projects.

## What's genuinely new (the work)

Not the host (promoted) — the **first-class, tested** virtual FileSystem, key-chord reclaim, and
clipboard bridge; the `mountApp` convenience; the `browser-stubs` subpath + entry-point packaging;
and the golden test that pins "bytes === `serialize()`".
