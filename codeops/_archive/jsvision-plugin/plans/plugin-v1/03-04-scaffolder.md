# Scaffolder: jsvision-new-app

> **Document**: 03-04-scaffolder.md
> **Parent**: [Index](00-index.md)

## Overview

A manual skill, `jsvision-new-app`, that creates a complete, runnable jsvision app package under
`packages/<slug>/`, backed by a deterministic Node generator script so it is spec-testable and
byte-identical every run. Owns FR-5, FR-9, SEC-1.

## Architecture

### Two parts (AR-8)

1. **`scripts/new-jsvision-app.mjs`** (bundled at `tools/claude-plugin/skills/jsvision-new-app/scripts/`)
   — a pure Node ESM script, zero deps. Its core is a **pure function** `buildAppFiles(name)`
   returning a `Map<relativePath, contents>` (no fs) so it is trivially unit-testable; a thin fs
   wrapper writes the map under `packages/<slug>/` and refuses to overwrite an existing package.
2. **`SKILL.md`** (`disable-model-invocation: true`, manual only, AR-14) — a thin wrapper that
   runs the script with the user's argument and then reports the generated files + the "cd &&
   run" next step. `argument-hint: "[app-name]"`.

### Name handling (SEC-1 / AR-17)

`slugify(name)`: lowercase, spaces/underscores → `-`, strip anything outside `[a-z0-9-]`, collapse
repeats, trim leading/trailing `-`. Reject (throw) if the result is empty, or if the raw input
contains `/`, `\`, `..`, or is an absolute path. The script writes **only** under
`packages/<slug>/` and never outside it.

## Implementation Details

### Generated package (the app skeleton — FR-5)

`buildAppFiles('expense-tracker')` produces:

```
packages/expense-tracker/
├── package.json      # name "@jsvision/expense-tracker", private, type module, scripts
├── tsconfig.json     # extends ../../tsconfig.base.json
├── vitest.config.ts  # the repo's unit+e2e project shape (mirrors an existing package)
├── src/main.ts       # TTY guard + createApplication + starter Window + await run()
└── test/expense-tracker.smoke.test.ts   # headless mount → paintedCells > 0
```

`src/main.ts` (shape — the emitted starter, publish-agnostic imports):

```ts
import { createApplication, Window, statusLine, statusItem, Commands } from '@jsvision/ui';

function main(): Promise<number> | number {
  if (process.stdout.isTTY !== true) {
    process.stdout.write('This app needs an interactive terminal (TTY).\n');
    return 0;
  }
  const app = createApplication({
    statusLine: statusLine([statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X')]),
  });
  const win = new Window('expense-tracker');
  win.layout.rect = { x: 2, y: 2, width: 40, height: 12 };
  app.desktop.addWindow(win);
  return app.run();
}

void Promise.resolve(main()).then((code) => process.exit(code));
```

The emitted smoke test mirrors `kitchen-sink.smoke` (mount the app's root view headless via
`createRenderRoot`, assert `paintedCells > 0`) so a freshly scaffolded app is green on creation.

### Publish-agnostic dependency seam (FR-9 / AR-15)

The generated `package.json`'s `@jsvision/ui` dependency line is produced by a single helper —
`uiDependency()` — returning the workspace form today (`"@jsvision/ui": "*"`, resolved by yarn
workspaces). A future publish flips this one helper to a version range; nothing else changes.

### `SKILL.md` frontmatter (sketch)

```yaml
---
name: jsvision-new-app
description: Scaffold a new runnable jsvision TUI app package under packages/<name>.
disable-model-invocation: true
argument-hint: "[app-name]"
allowed-tools: "Bash Read"
---
```

Body: run `node ${CLAUDE_PLUGIN_ROOT}/skills/jsvision-new-app/scripts/new-jsvision-app.mjs "$ARGUMENTS"`,
then summarize the created files and print the `yarn workspace @jsvision/<slug> <script>` next steps.

## Integration Points

- Emits into `packages/<slug>/`, auto-joined to the workspace by the `packages/*` glob — `yarn
  verify` then covers it via turbo.
- The `jsvision` skill's `running-and-testing` reference (03-02) links here as the "start a new
  app" entry point.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Name with `/`, `..`, absolute, or empty-after-slug | Throw before any write; nothing created | AR-17 |
| `packages/<slug>/` already exists | Refuse (no overwrite); instruct to pick another name | AR-8 |
| Name needs normalization (`"My App"`) | Slugify to `my-app`, report the chosen slug | AR-17 |

> **Traceability:** Strategies reference the register entries that resolved them.

## Testing Requirements
- Unit-test the pure `buildAppFiles`/`slugify`/`uiDependency` (deterministic map + name rules) —
  ST-1…ST-4, ST-6.
- Integration-test the fs write into a throwaway package dir → typecheck + smoke pass, then clean
  up — ST-5.
