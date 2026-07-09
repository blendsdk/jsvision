# Execution Plan: `@jsvision/web` Browser Runtime

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-09 20:07
> **Progress**: 3/17 tasks (18%)
> **CodeOps Skills Version**: 3.3.2

## Overview

Extract the behavior-complete `web-xterm` spike into the tested `@jsvision/web` package: a browser
host over the reused pure engine, a browser caps profile, an in-memory virtual `FileSystem`, key-chord
reclaim, a clipboard bridge, the node-builtin stub subpath, and the `mountApp` convenience — then
dogfood it back into the spike. Five phases; each is spec-first and leaves a **verifiable slice**.

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Package scaffold + `browser-stubs` | 3 |
| 2 | Browser host + caps + `mountApp` | 4 |
| 3 | Virtual FileSystem | 3 |
| 4 | Key-chord reclaim + clipboard + security | 3 |
| 5 | Dogfood spike + docs + final verify | 4 |

**Total: 17 tasks across 5 phases.**

> **⚠️ EXECUTION RULE:** the task checkboxes are the single source of truth for progress. Mark `[~]`
> with a timestamp on implementation, promote to `[x]` only after its verify passes, update the
> Progress header after each task. Resume at the first `[~]` then the first `[ ]`. Timestamps via
> `date '+%Y-%m-%d %H:%M'`. Specification-first: spec test → red → implement → green → impl tests →
> verify. **Verify**: `yarn verify` (lint → turbo typecheck/build/test/check:docs, now incl.
> `@jsvision/web`) + `yarn check:deps`. Per-package fast loop: `yarn workspace @jsvision/web test`
> (after a build, since cross-package tests read built `dist`). **Never** put raw git in this doc —
> commit via `/gitcm` / `/gitcmp`.

> **Kitchen-sink gate:** `@jsvision/web` is non-visual runtime infrastructure — **no story required**
> (AR-7). Its live demo is RD-03's live-example system, which runs on it.

> **Shipped-code hygiene:** promoted files land in `packages/web/src` (in `check:docs` scope) — strip
> the spike's CodeOps IDs (`HR-24`/`AR-14`/`PA-9`/`HR-07`) and add an `@example` to every export, or
> `check:docs` fails. Behavior is promoted verbatim; comments are rewritten.

---

## Phase 1: Package scaffold + `browser-stubs`

**Reference**: [03-01](03-01-package-scaffold.md) · [07](07-testing-strategy.md) ST-1, ST-12 · AR-1, AR-2

### Step 1.1: Spec (RED)
- [x] 1.1.1 Write `packages/web/test/packaging.spec.test.ts`: **ST-1** (build emits `dist/index.js` + `dist/index.d.ts` + `dist/browser-stubs.js`) + **ST-12** (the `@jsvision/web/browser-stubs` subpath resolves and each stub **throws** when invoked; the `.` barrel does **not** re-export the stubs; `package.json#version === '0.1.0'`). Verify RED (no package yet). _(the full barrel-symbol presence assertion is completed in Phase 5 as modules land)_ — done 2026-07-09 20:07 (RED confirmed: `@jsvision/web` unresolvable pre-build)

### Step 1.2: Implementation (GREEN)
- [x] 1.2.1 Scaffold `packages/web`: `package.json` (03-01 — private, ESM, exports `.`+`./browser-stubs`, deps core/ui/files, peer+dev `@xterm/xterm`, dev `@xterm/headless`), `tsconfig.json` + `vitest.config.ts` (copy `packages/files/`), `src/browser-stubs.ts` (promote `node-stub.ts`, JSDoc rewritten + `@example`), initial `src/index.ts` (barrel — grows per phase). Run `yarn install` (workspace symlink + new devDeps). — done 2026-07-09 20:07

### Step 1.3: Green + harden
- [x] 1.3.1 `yarn workspace @jsvision/web build` green; ST-1 + ST-12 (stubs/version) pass; `yarn check:deps` green (no native dep); `yarn check:docs` green for `browser-stubs.ts`. — done 2026-07-09 20:07 (build emits all 3 dist artifacts; 4/4 spec tests pass; check:deps + check:docs green)

---

## Phase 2: Browser host + caps + `mountApp`

**Reference**: [03-02](03-02-browser-host.md) · [07](07-testing-strategy.md) ST-2, ST-3, ST-7, ST-10 · AR-3, AR-4

### Step 2.1: Spec (RED)
- [ ] 2.1.1 Write `test/host.spec.test.ts` (**ST-2** bytes-written === `serialize(buffer, null, {caps})` over an `@xterm/headless` term; **ST-3** `\x1b[A` → one `up` key, lone `ESC` flushes only after `ESC_TIMEOUT_MS` via the injected timer), `test/caps.spec.test.ts` (**ST-7** `colorDepth:'16'` downsamples a truecolor style), `test/mount.spec.test.ts` (**ST-10** `mountApp` paints a first frame + routes a key). Verify RED.

### Step 2.2: Implementation (GREEN)
- [ ] 2.2.1 `src/host.ts` — promote `browser-host.ts` **behavior verbatim**, add the injectable `timer` seam (AR-4), rewrite JSDoc + `@example`; re-export from the barrel. Green ST-2, ST-3.
- [ ] 2.2.2 `src/caps.ts` (`buildBrowserCaps`, `colorDepth` overridable) + `src/mount.ts` (`mountApp` distilled from `main.ts`, DOM-light, headless-testable); re-export both. Green ST-7, ST-10.

### Step 2.3: Green + harden
- [ ] 2.3.1 ST-2/3/7/10 pass; add `host.impl.test.ts` edges (multi-byte chunk decode, caret show/hide/position, `render` no-op when the diff is empty); `yarn verify` green; `check:docs` green.

---

## Phase 3: Virtual FileSystem

**Reference**: [03-03](03-03-virtual-filesystem.md) · [07](07-testing-strategy.md) ST-4, ST-9 (path), ST-11 · AR-6

### Step 3.1: Spec (RED)
- [ ] 3.1.1 Write `test/virtual-fs.spec.test.ts`: **ST-4** (a real `@jsvision/files` `FileList`/`FileDialog` over a virtual FS seeded `{ '/home/demo': { 'a.txt':'…', 'sub': { 'b.txt':'…' } } }` lists `a.txt`+`sub`, entering `sub` lists `b.txt`; `web/src` imports no `node:fs`/`node:tty`, and a stubbed build emits no `node:fs` specifier) + **ST-11** (the full `FileSystem` interface — 14 methods + the `sep` property — per 03-03) + the **ST-9 path half** (`resolve('/home/demo','../x')` → `/home/x` lexically). Verify RED.

### Step 3.2: Implementation (GREEN)
- [ ] 3.2.1 `src/virtual-fs.ts` — `createBrowserFileSystem({ tree, home, mtime })`: in-memory node tree, `seed(FileTree)`, all `FileSystem` members — 14 methods + `sep` (03-03 map), deterministic mtime, pure-POSIX path ops, `@jsvision/files`-compatible error shapes; re-export from the barrel.

### Step 3.3: Green + harden
- [ ] 3.3.1 ST-4, ST-11, ST-9(path) pass; add `virtual-fs.impl.test.ts` edges (hidden dotfiles, missing-path error shape matches `node-fs`, nested-seed depth, `writeFile`→`readFile` round-trip, `rename`/`unlink` mutate); `yarn verify` green; `check:docs` green.

---

## Phase 4: Key-chord reclaim + clipboard + security

**Reference**: [03-04](03-04-browser-integration.md) · [07](07-testing-strategy.md) ST-5, ST-6, ST-9 · AR-4

### Step 4.1: Spec (RED)
- [ ] 4.1.1 Write `test/key-reclaim.spec.test.ts` (**ST-5** focused `F1` keydown → `defaultPrevented`, decoded `f1` reaches `onInput`, `UNRECLAIMABLE_CHORDS` non-empty), `test/clipboard.spec.test.ts` (**ST-6** `setClipboard('copied',…)` → exactly one `writeText`, `readText` never called), `test/security.spec.test.ts` (**ST-9** untrusted `ESC` content stripped by `sanitize()` before the terminal write; virtual-FS open/save makes no network request). Verify RED.

### Step 4.2: Implementation (GREEN)
- [ ] 4.2.1 `src/key-reclaim.ts` (`attachKeyReclaim` capture-phase, focus-gated `preventDefault`; curated `UNRECLAIMABLE_CHORDS`) + `src/clipboard.ts` (`setClipboard` outbound-only, injectable clipboard, no reads); re-export both. Green ST-5, ST-6.

### Step 4.3: Green + harden
- [ ] 4.3.1 ST-5/6/9 pass; add impl edges (`Alt+<letter>` + `Shift+Tab` matching, unsubscribe stops reclaiming, `also:['*']` broad mode, gesture-gated write rejects gracefully); `yarn verify` green; `check:docs` green.

---

## Phase 5: Dogfood spike + docs + final verify

**Reference**: [03-04](03-04-browser-integration.md) (dogfood) · [07](07-testing-strategy.md) ST-8, ST-12 (full) · AR-5

### Step 5.1: Spec (RED)
- [ ] 5.1.1 Complete `packaging.spec.test.ts` **ST-12 (full)**: `import('@jsvision/web')` exposes every planned barrel symbol (`createBrowserHost`/`buildBrowserCaps`/`mountApp`/`createBrowserFileSystem`/`attachKeyReclaim`/`UNRECLAIMABLE_CHORDS`/`setClipboard` + types). Verify RED for any not yet exported. (**ST-8** is `check:docs`, run in verify.)

### Step 5.2: Implementation (GREEN)
- [ ] 5.2.1 **Dogfood (AR-5)**: refactor `packages/examples/web-xterm/` to consume `@jsvision/web` — delete `browser-host.ts` + `node-stub.ts` locals, import `createBrowserHost` + `browser-stubs`; point `vite.config.ts` alias at `@jsvision/web/browser-stubs`; extract `WEB_CAPS`→`buildBrowserCaps()`; optionally shrink `main.ts` onto `mountApp`. Demo behavior identical.
- [ ] 5.2.2 `packages/web/README.md` (consumer Vite-alias recipe, `.`+`./browser-stubs` entry points, `mountApp` quick-start, `UNRECLAIMABLE_CHORDS` note) + `LICENSE`.

### Step 5.3: Green + harden
- [ ] 5.3.1 Full **ST-1…ST-12 green**; **ST-8** `yarn check:docs` green (no CodeOps/TV refs, every export has `@example`); `yarn verify` green; `yarn check:deps` green; the **dogfood proof** — `yarn workspace @jsvision/examples demo:web` still boots with identical behavior (the `web-xterm` spike is outside verify's typecheck scope, so this manual boot is its regression check). Final full verify.

---

## Definition of Done

All 17 tasks `[x]`; ST-1…ST-12 green; `yarn verify` + `yarn check:deps` green; the `web-xterm` spike
runs on `@jsvision/web` with identical behavior. Then: roadmap RD-02 → `Done`; offer `preflight`
before `exec_plan` (as RD-01 did), and re-analyze the project CLAUDE.md (new package).
