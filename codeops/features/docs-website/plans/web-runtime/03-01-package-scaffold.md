# 03-01 · Package Scaffold & Tooling

> **Document**: 03-01-package-scaffold.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-02 Must-Have #1, #8 (packaging half) · ST-1, ST-8, ST-12 · AR-1, AR-2, AR-8

## Goal

Create `packages/web` = `@jsvision/web` and wire it into the monorepo so `yarn verify` and
`yarn check:deps` cover it, exactly as they cover `@jsvision/files`.

## `packages/web/package.json`

Mirror `packages/files/package.json` (02-current-state), changing name/description and adding the
`browser-stubs` subpath export and the xterm dev/peer declarations:

```jsonc
{
  "name": "@jsvision/web",
  "private": true,
  "version": "0.1.0",              // static; sync-versions skips private (AR-2)
  "description": "Run any JSVision app in a browser xterm.js terminal — a browser host over the reused pure engine, a virtual FileSystem, key-chord reclaim, and a clipboard bridge. Private until first release.",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20" },
  "sideEffects": false,
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./browser-stubs": { "types": "./dist/browser-stubs.d.ts", "import": "./dist/browser-stubs.js" }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --project unit",
    "test:e2e": "vitest run --project e2e --passWithNoTests",
    "check:deps": "node ../../scripts/check-no-native-deps.mjs .",
    "check:docs": "node ../../scripts/check-jsdoc.mjs ."
  },
  "dependencies": {
    "@jsvision/core": "*",
    "@jsvision/ui": "*",
    "@jsvision/files": "*"
  },
  "peerDependencies": {
    "@xterm/xterm": "^5.5.0"
  },
  "peerDependenciesMeta": {
    "@xterm/xterm": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@xterm/headless": "^5.5.0",
    "@xterm/xterm": "^5.5.0",
    "vitest": "^4.1.9"
  }
}
```

- **`@jsvision/files`** is a real dependency (the virtual FS implements its `FileSystem` type).
- **`@xterm/xterm`** is a **peer + optional** dependency (types for `Terminal`; the consumer pins the
  real runtime version) and a devDep so the package typechecks in isolation. `@xterm/headless` is a
  devDep for the AC-2/AC-3 golden host/decode tests. Neither is a native dep, so **`check:deps` stays
  green** (it flags native runtime deps only; both are pure JS and are dev/peer, not bundled).

## `packages/web/tsconfig.json` + `vitest.config.ts`

Copy `packages/files/tsconfig.json` and `packages/files/vitest.config.ts` verbatim (shared
`tsconfig.base.json`, `outDir: dist`, the `unit`/`e2e` vitest projects). No DOM `lib` is needed —
the DOM APIs the reclaim/clipboard code touches are referenced through narrow local interfaces + the
hand-mocked test globals (AR-4), keeping the type surface minimal and explicit.

## `packages/web/src/index.ts` (public barrel)

Single `.` entry, EXPLICIT named re-exports (the repo idiom for non-reactive subsystems):

```ts
export { createBrowserHost, type BrowserHost, type BrowserHostOptions, type CaretCell } from './host.js';
export { buildBrowserCaps, type BrowserCapsOptions } from './caps.js';
export { mountApp, type MountAppOptions, type MountedApp } from './mount.js';
export { createBrowserFileSystem, type BrowserFileSystemOptions, type FileTree } from './virtual-fs.js';
export { attachKeyReclaim, UNRECLAIMABLE_CHORDS, type KeyReclaimOptions } from './key-reclaim.js';
export { setClipboard, type ClipboardBridge } from './clipboard.js';
```

`browser-stubs.ts` is **not** re-exported from the barrel — it is a standalone alias target only,
reachable via the `./browser-stubs` subpath, so importing `@jsvision/web` never pulls the throwing
stubs into a consumer's graph.

## Turbo / verify / workspace wiring

- **No `turbo.json` change** — `tasks` already fan over every `packages/*` workspace; the new package
  is picked up automatically for `build`/`typecheck`/`test`/`check:deps`/`check:docs`.
- **No `sync-versions.mjs` change** (AR-2) — the script skips `private:true`; `@jsvision/web` holds
  `0.1.0` and will be auto-adopted when `private` is dropped at first release.
- Root `workspaces:["packages/*"]` needs no edit. Run `yarn install` once so the workspace symlink is
  created.

## Verify (this component)

`yarn workspace @jsvision/web build` emits `dist/index.js` + `dist/index.d.ts` + `dist/browser-stubs.js`;
`yarn check:deps` green; `yarn verify` green (ST-1, ST-12).
