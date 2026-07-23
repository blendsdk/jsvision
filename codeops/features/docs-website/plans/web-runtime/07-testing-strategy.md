# 07 · Testing Strategy — `@jsvision/web` Browser Runtime

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

Tests live in `packages/web/test/` (never colocated), split `*.spec.test.ts` (immutable spec oracle,
derived from RD-02's ACs) / `*.impl.test.ts` (internals/edges), run by the repo's vitest `unit`
project. Host + decode golden tests drive an `@xterm/headless` `Terminal` (devDep); the reclaim +
clipboard tests use **hand-mocked globals** (AR-4). Specification-first: write the `*.spec.test.ts`
for a phase's STs **first** (red — no source yet), then implement to green.

## Specification Test Cases

| ST | Assertion | Input → Expected | Source | Auto? |
|----|-----------|------------------|--------|-------|
| ST-1 | Build + no dep leak | `yarn workspace @jsvision/web build` emits `dist/index.js` + `dist/index.d.ts` + `dist/browser-stubs.js`; `yarn check:deps` for `@jsvision/web` exits 0 (no native runtime dep) | AC-1 · AR-2 | ✅ |
| ST-2 | Engine reused verbatim | `createBrowserHost` over an `@xterm/headless` term, `render(buffer)` with no previous frame → the bytes written to the term **exactly equal** `serialize(buffer, null, { caps })` | AC-2 | ✅ |
| ST-3 | Decode + lone-ESC timing | Feeding `\x1b[A` yields exactly one `{ type:'key', key:'up', ctrl:false, alt:false, shift:false }` on `onInput`; a lone trailing `ESC` emits an Escape key **only after** `ESC_TIMEOUT_MS` (driven via the injected timer), not before | AC-3 | ✅ |
| ST-4 | Virtual FS drives real dialogs | A `FileList`/`FileDialog` from `@jsvision/files` over a virtual FS seeded `{ '/home/demo': { 'a.txt':'…', 'sub': { 'b.txt':'…' } } }` lists `a.txt` + `sub`; entering `sub` lists `b.txt`; **`web/src` imports no `node:fs`/`node:tty`**, and a **stubbed build** emits no `node:fs` specifier (core's three `node:fs` sites resolve to `browser-stubs`) | AC-4 | ✅ |
| ST-5 | Key-chord reclaim | With reclaim attached + terminal "focused" (mock), a fake `F1` keydown has `defaultPrevented === true` and the decoded `f1` reaches `onInput`; `UNRECLAIMABLE_CHORDS` is a non-empty exported array | AC-5 | ✅ |
| ST-6 | Clipboard: write-only | `setClipboard('copied', caps, mock)` triggers **exactly one** `writeText('copied')`; the mock's `readText` is **never** called | AC-6 | ✅ |
| ST-7 | colorDepth drives downsample | `buildBrowserCaps({ colorDepth:'16' })` fed a truecolor style through `serialize()` → a 16-colour SGR (a known truecolor bg downsamples), proving the profile drives the existing chain | AC-7 | ✅ |
| ST-8 | Docs governance | Every public export of `@jsvision/web` has JSDoc with `@example`; `yarn check:docs` for the package exits 0 (no CodeOps/TV-C++ references) | AC-8 | ✅ |
| ST-9 | Security: sanitize + no exfiltration | Untrusted file content with a raw `ESC` rendered through a view → **no raw ESC** in the terminal write (stripped by `sanitize()`); `resolve('/home/demo','../x')` → `/home/x` lexically (no real path touched); virtual-FS open/save issues **no** network request | AC-9 | ✅ |
| ST-10 | `mountApp` boots end-to-end | `mountApp` over an `@xterm/headless` term + a trivial `@jsvision/ui` app paints a non-empty first frame and a dispatched key reaches the app | Should-Have · AR-3 | ✅ |
| ST-11 | Virtual FS contract | The full `FileSystem` interface (14 methods + the `sep` property) behaves per 03-03: `readDir` lists + sorts, `stat`/`lstat` equal, `readFile`/`writeFile` round-trip, `rename`/`unlink` mutate, missing path throws the dialog-compatible error, path ops are pure POSIX | AC-4, AC-9 | ✅ |
| ST-12 | Packaging surface | `import('@jsvision/web')` exposes the barrel symbols; `import('@jsvision/web/browser-stubs')` resolves and each stub **throws** when invoked; the barrel does **not** re-export the stubs; `package.json` version === root `0.1.0` (static, AR-2) | AC-1 · AR-1, AR-2 | ✅ |

## AC → ST coverage

AC-1 → ST-1, ST-12 · AC-2 → ST-2 · AC-3 → ST-3 · AC-4 → ST-4, ST-11 · AC-5 → ST-5 · AC-6 → ST-6 ·
AC-7 → ST-7 · AC-8 → ST-8 · AC-9 → ST-9, ST-11. All nine ACs covered; ST-10/11/12 add convenience,
contract, and packaging depth.

## Notes

- **The load-down invariant is ST-2**: exact byte equality with `serialize()` is the single assertion
  that proves "the engine is reused, not reimplemented" — the whole thesis of the package.
- Security tests (ST-9) are mandatory per the repo standards: injection boundary (`sanitize`), path
  normalization (no `..` escape, no real fs), and no exfiltration (no network on file ops).
- No e2e (`test:e2e`) tier is required here — the spike's live `demo:web` (refactored to consume the
  package, AR-5) is the manual live proof; RD-03's live-example smoke tests exercise the runtime in a
  real page later.
