---
title: Install & packages
description: Configure a Node 22+ ESM project and choose the smallest supported JSVision packages for your application.
---

# Install & packages

JSVision is published as a family of ESM packages. This course helps you make two decisions before
you write application code:

1. which packages belong in your project; and
2. which Node and TypeScript settings let their public exports resolve correctly.

Installation and module resolution happen outside the embedded documentation terminal, so this is
an orientation course without a live lab. Instead, you will use real manifest facts, compiler
output, export-map evidence, and a bounded doctor transcript.

## Who this is for

This course is for a beginner starting a first JSVision project or adding JSVision to an existing
TypeScript application. Complete the [Introduction](/guide/) first so the terms application, host
runtime, and terminal frame are already familiar.

By the end, you should be able to:

- choose direct dependencies for a terminal app and each optional feature family;
- explain why the browser host is not currently a consumer install target;
- configure a strict Node 22+ ESM project with NodeNext resolution;
- import only supported public entry points; and
- diagnose engine, ESM, export-map, peer-dependency, and version failures with evidence.

## Requirements

| Requirement       | Supported value | Why it matters                                                |
| ----------------- | --------------- | ------------------------------------------------------------- |
| Node.js           | 22 or newer     | Every published package declares an `engines.node` of `>=22`. |
| Module format     | ESM             | JSVision does not publish CommonJS entry points.              |
| TypeScript module | `NodeNext`      | It understands package export maps and Node ESM rules.        |
| Terminal runtime  | Interactive TTY | A Node-hosted full-screen application needs terminal input.   |

The packages are JavaScript and TypeScript output; there are no native addons in the core runtime.
That does not mean every package has no runtime dependencies. For example, `@jsvision/ui` depends
on `@jsvision/core` and `@jsvision/i18n`, and the code editor owns additional language tooling.

## Choose packages by goal

Declare every package your source imports as a direct dependency. Although feature packages bring
their framework dependencies transitively, listing your own imports makes upgrades, audits, and
module resolution predictable.

| Goal                  | Direct runtime packages                  | Decision                                                   |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Terminal application  | `@jsvision/ui`                           | Normal starting point: app shell, views, layout, and state |
| Forms and validation  | `@jsvision/ui`, `@jsvision/forms`, `zod` | Zod 4 is an explicit peer dependency                       |
| File workflows        | `@jsvision/ui`, `@jsvision/files`        | Adds dialogs and the injectable `FileSystem` seam          |
| Data Grid             | `@jsvision/ui`, `@jsvision/datagrid`     | Adds the specialist editable grid                          |
| Code Editor           | `@jsvision/ui`, `@jsvision/code-editor`  | Adds documents, languages, and editor services             |
| Rendering engine only | `@jsvision/core`                         | Use the engine or rendering layer without the widgets      |
| Direct i18n services  | `@jsvision/i18n`                         | Only when application code imports the i18n service itself |
| Browser deployment    | No supported package set yet             | The browser host is internal; see the boundary below       |

Use the command matching your goal:

::: code-group

```sh [Terminal app]
npm install @jsvision/ui
```

```sh [Forms]
npm install @jsvision/ui @jsvision/forms zod
```

```sh [Files]
npm install @jsvision/ui @jsvision/files
```

```sh [Data Grid]
npm install @jsvision/ui @jsvision/datagrid
```

```sh [Code Editor]
npm install @jsvision/ui @jsvision/code-editor
```

:::

The published family contains `@jsvision/core`, `@jsvision/ui`, `@jsvision/i18n`,
`@jsvision/forms`, `@jsvision/files`, `@jsvision/datagrid`, and `@jsvision/code-editor`. Install
packages from the same release so their exact internal `@jsvision/*` versions remain aligned.

### Browser boundary

The documentation examples run through `@jsvision/web`, but that package is private and internal to
this repository. It is not published, cannot be installed from npm, and browser deployment is
currently unsupported for consumer projects. Do not copy a docs-site browser-host import into an
application. The [Running in the browser](/guide/running-in-the-browser) course explains the
architecture and will become the setup owner when a browser host is published.

## Create a Node 22+ ESM project

Start in an empty directory:

```sh
mkdir my-jsvision-app
cd my-jsvision-app
npm init -y
npm install @jsvision/ui
npm install --save-dev typescript tsx @types/node
mkdir src
```

Use this minimal `package.json` shape:

```json
{
  "name": "my-jsvision-app",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "check": "tsc --noEmit",
    "start": "tsx src/main.ts"
  },
  "dependencies": {
    "@jsvision/ui": "^1.5.3"
  },
  "devDependencies": {
    "@types/node": "^22",
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

The version above illustrates the manifest shape. Let your package manager select the current
compatible release, keep all direct `@jsvision/*` dependencies on that same release, and commit the
resulting lockfile.

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

`module` and `moduleResolution` work as a pair. `NodeNext` reads the package `exports` map and also
enforces Node's ESM rules. In a relative import, write the runtime `.js` extension even when the
source file is TypeScript:

```ts
import { helper } from './helper.js';
```

Package imports use the public package name:

```ts
import { createApplication } from '@jsvision/ui';
```

Do not add `.js` to a package specifier and do not import a package's `src/` or `dist/` files.

## Public entry points

An exports map is an allowlist. The package root (`"."`) and any named subpaths in `exports` are
public, supported entry points; an internal file that happens to exist is not public API.

These root imports are valid:

```ts
import { createApplication } from '@jsvision/ui';
import { createI18n } from '@jsvision/i18n';
import { createForm } from '@jsvision/forms';
import { FileDialog } from '@jsvision/files';
import { EditableDataGrid } from '@jsvision/datagrid';
import { CodeEditor } from '@jsvision/code-editor';
```

Packages may expose deliberate subpaths. For example, the code editor exports its TypeScript
language entry point:

```ts
import { typescriptLanguageId } from '@jsvision/code-editor/languages/typescript';
```

Never guess a subpath. Confirm it in the package's generated
[API reference](/api/) or installed `package.json`.

## Peer dependencies and aligned versions

`@jsvision/forms` declares a peer dependency on **Zod 4**:

```json
{
  "peerDependencies": {
    "zod": "^4"
  }
}
```

Install it beside the forms package:

```sh
npm install @jsvision/ui @jsvision/forms zod
```

The published JSVision packages are released with matching versions, and their internal JSVision
dependencies use exact versions. Check the resolved tree after adding or upgrading packages:

```sh
npm ls @jsvision/core @jsvision/ui @jsvision/i18n @jsvision/forms @jsvision/files @jsvision/datagrid @jsvision/code-editor
```

One version per package family is the healthy result. If the tree is mixed, update all direct
`@jsvision/*` ranges together and regenerate the lockfile with your chosen package manager.

## Authentic setup evidence

Use this evidence instead of trying to simulate package installation in a live embedded example.
The verification works without a live lab because it checks the real build-time boundaries.

### 1. Compiler evidence

Run:

```sh
npx tsc --noEmit
```

A valid setup exits 0 with no errors and normally no output. This proves that TypeScript accepted
your NodeNext configuration and every imported public symbol.

For a module-resolution failure, capture a bounded trace:

```sh
npx tsc --noEmit --traceResolution > resolution.log
```

Search `resolution.log` for the failing specifier. A healthy package-root import resolves through
the matching `exports["."].types` target rather than a source or guessed `dist/` path.

### 2. Export-map evidence

A published package root has a manifest shape like this:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

The `types` target serves TypeScript and the `import` target serves the ESM runtime. If the requested
subpath is absent from `exports`, choose a documented public entry point instead of reaching around
the map.

### 3. Doctor evidence

The repository-tested JSVision doctor catches NodeNext relative imports that omit `.js`. Codex users
run it through the supported [Codex plugin](/guide/codex-plugin); the transcript is evidence, not a
claim that the npm packages install a global doctor command.

A correct file reports:

```text
jsvision-doctor: no issues found ✓
```

A broken `import { helper } from './helper'` reports the rule:

```text
jsvision-doctor: 1 error(s), 0 warning(s), 0 info
  ✗ src/main.ts:1  [missing-js-extension] relative import './helper' needs a '.js' extension (NodeNext ESM)
```

The compiler remains authoritative for symbols and module resolution; the doctor gives a faster,
focused explanation for documented project-shape mistakes.

## Diagnose setup failures

| Symptom                                                         | Cause                                                                                                                              | Correction                                                                        | Evidence                                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Engine mismatch or `EBADENGINE`                                 | Node is older than 22                                                                                                              | Install Node 22 or newer and repeat the install                                   | `node --version` satisfies every package's `engines.node`; strict engine policies may reject instead of warn |
| `Cannot find module '@jsvision/ui'`                             | Resolver is not `NodeNext`, or dependency is absent                                                                                | Set both module options to `NodeNext`; confirm the direct dependency              | `npm ls @jsvision/ui` succeeds and `npx tsc --noEmit` exits 0                                                |
| `ERR_PACKAGE_PATH_NOT_EXPORTED`: `No "exports" main defined`    | CommonJS `require()` cannot select the package root because its export map offers an `import` condition but no `require` condition | Use `"type": "module"` and static `import`                                        | The root export resolves when the application starts as ESM                                                  |
| `ERR_PACKAGE_PATH_NOT_EXPORTED`: package subpath is not defined | An internal or guessed subpath is absent from the exports map                                                                      | Import a documented public entry point or exported subpath                        | The installed exports map contains the exact requested key                                                   |
| Missing peer dependency: `zod` or wrong `4`                     | Forms needs the Zod `^4` peer dependency                                                                                           | Install `zod@^4` beside `@jsvision/forms`                                         | `npm ls zod @jsvision/forms` reports one compatible tree                                                     |
| Mixed or stale `@jsvision/*` versions                           | Packages were upgraded separately or the lockfile stayed old                                                                       | Align direct JSVision versions, reinstall once, and commit the refreshed lockfile | `npm ls @jsvision/core @jsvision/ui` shows one aligned release per package                                   |
| Relative import fails under NodeNext                            | A local ESM specifier omitted its runtime `.js` extension                                                                          | Change `./helper` to `./helper.js`                                                | Doctor is clean and `npx tsc --noEmit` exits 0                                                               |

Do not respond to resolution errors by importing `@jsvision/*/src/...`, editing `node_modules`, or
turning off strictness. Those workarounds bypass the supported boundary and make the next upgrade
less predictable.

## Best practices

- **Declare what you import.** Direct dependencies reveal ownership and prevent a transitive
  dependency change from breaking application resolution.
- **Keep the package family aligned.** Exact internal versions assume packages from the same
  release; mixed versions can duplicate stateful framework services or disagree on types.
- **Treat `exports` as the API boundary.** Internal paths are not compatibility promises.
- **Commit one lockfile.** Reproducible installs make a local success explainable in CI.
- **Keep compiler and runtime ESM settings together.** Fixing only TypeScript or only Node moves the
  same failure to a later stage.
- **Use evidence before reinstalling.** `node --version`, `npm ls`, compiler output, and the export
  map identify the failing layer without destructive trial and error.

## Practice

1. Choose the exact install command for a terminal app that adds forms and file dialogs. Explain why
   `@jsvision/ui`, `@jsvision/forms`, `zod`, and `@jsvision/files` are direct dependencies.
2. Add `src/helper.ts` and import it from `src/main.ts` using `./helper.js`. Run
   `npx tsc --noEmit`, then remove the extension and compare the compiler or doctor evidence.
3. Inspect the installed `@jsvision/ui/package.json`. Identify the public root export and explain why
   a guessed `@jsvision/ui/src/...` import is unsupported.
4. Run `npm ls` for your installed JSVision packages and Zod. Record the evidence that versions and
   peers are aligned.

## Where to next

- [Layout](/guide/layout) teaches terminal-cell geometry and responsive composition.
- [Reactive state](/guide/reactive-state) connects signals and derived values to your views.
- [Running in the browser](/guide/running-in-the-browser) explains the host boundary and current
  publication limit.
- [Data Grid course](/components/data-grid/) owns typed grid setup and advanced workflows.
- [Code Editor course](/components/code-editor/) owns documents, languages, services, and recovery.
- [API reference](/api/) lists every supported public symbol and exported subpath.
