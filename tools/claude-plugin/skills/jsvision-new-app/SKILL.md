---
name: jsvision-new-app
description: Scaffold a new runnable jsvision TUI app package under packages/<name>. Manual command — invoke when the user asks to start or create a new jsvision app.
disable-model-invocation: true
argument-hint: '[app-name]'
allowed-tools: 'Bash Read'
---

# Scaffold a new jsvision app

Create a complete, runnable jsvision application package from the app name in `$ARGUMENTS`.

## What to do

1. Run the generator with the user's app name:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/jsvision-new-app/scripts/new-jsvision-app.mjs" "$ARGUMENTS"
   ```

   It creates `packages/<slug>/` with a `package.json`, `tsconfig.json`, `vitest.config.ts`, a
   starter `src/main.ts` (a desktop with one window), and a headless `test/<slug>.smoke.test.ts`.
   The name is slugified (e.g. `My App` → `my-app`); unsafe names (path separators, `..`, absolute
   paths, empty) are rejected without writing anything.

2. Report the files it created and the exact slug it chose.

3. Tell the user the next steps the script printed:

   ```bash
   yarn install                              # register the new workspace package
   yarn workspace @jsvision/<slug> start     # run it on an interactive terminal
   yarn verify                               # typecheck + tests, including the app's smoke test
   ```

4. Offer to build out the app. The `jsvision` skill carries the mental model, the component
   catalog, the gotchas, and runnable recipes — load it to compose real UI in `src/main.ts`.

## Notes

- The app lives **inside this monorepo**, where `@jsvision/ui` resolves via yarn workspaces. This is
  the supported target today (`@jsvision/ui` is unpublished).
- The starter `main.ts` exports `buildApp()` (so tests mount it headlessly) and only connects to a
  terminal when run directly. Keep that shape when you extend it.
- If `packages/<slug>/` already exists, the script refuses rather than overwrite — pick another name.
