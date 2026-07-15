# jsvision plugin

A Claude Code plugin that makes Claude an expert **jsvision** terminal-UI (TUI) application
developer — it can scaffold, compose, run, verify, and extend jsvision apps.

## What's inside

- **`jsvision` skill** — the knowledge base. Claude loads it automatically when you ask to build or
  extend a jsvision app. It carries the mental model, the non-negotiables, a component catalog, a
  generated API reference, the common gotchas, the run/verify loop, theming, widget authoring, and
  runnable recipes.
- **`/jsvision-new-app <name>` skill** — scaffolds a complete, runnable app package under
  `packages/<name>/` (you invoke this one manually).
- **`/jsvision-doctor [path]` skill** — statically lints an app for the documented footguns (missing
  `measure()`, bind-in-constructor, content laid out with absolute rects, missing `.js` imports, and
  more). Run it before calling an app done (`yarn doctor <path>`).
- **`/jsvision-render <module>` skill** — prints a headless ASCII screenshot of an app or view at any
  size (optionally after driving keys), so you can see the layout without a terminal
  (`yarn render:app <module>`).

## Install

### Local development (primary path)

Run Claude Code with the plugin loaded from this repo:

```bash
claude --plugin-dir tools/claude-plugin
```

This runs the plugin in place, so the verified recipe modules under `packages/examples/` and the
`check-plugin.mjs` integrity gate stay reachable during `yarn verify`.

### From the marketplace

This repository is also a plugin marketplace (`.claude-plugin/marketplace.json`). Add it, then
install:

```bash
/plugin marketplace add .
/plugin install jsvision-plugin@jsvision-marketplace
```

A marketplace install copies the plugin directory into Claude Code's plugin cache.

## Building apps

jsvision apps are built **inside this monorepo** as new `packages/<app>/` packages, where
`@jsvision/ui` resolves via yarn workspaces. Start one with:

```bash
/jsvision-new-app my-app
```

then run and verify it:

```bash
yarn workspace @jsvision/my-app start   # on a real interactive terminal
yarn verify                             # typecheck + tests, including the app's smoke test
```

## Keeping the plugin in sync with the SDK

The `check-plugin.mjs` integrity gate (part of `yarn verify`) goes red when the taught content drifts
from `@jsvision/ui` — a new widget class with no catalog entry, or a recipe snippet that no longer
matches its source module. Two paths bring it back in line; both leave changes **unstaged for you to
review**, and neither ever commits.

- **`/jsvision-plugin-sync` skill** (local, no API key) — a maintainer command. It detects the drift,
  re-syncs drifted snippets deterministically, and drafts a catalog bullet for each undocumented
  widget in-session (grounded in the widget's own JSDoc + `@example`), then runs `yarn verify` for
  you to review.
- **`yarn plugin:sync`** — the scriptable path:
  - `yarn plugin:sync --fix` re-syncs drifted recipe snippets deterministically (no AI, no key).
  - `yarn plugin:sync --detect` prints the drift as JSON.
  - `yarn plugin:sync` (no flag) also drafts catalog entries for undocumented widgets via the
    Anthropic API — it needs `ANTHROPIC_API_KEY` in the environment.

### Enabling automated sync

`.github/workflows/plugin-self-sync.yml` is scaffolded but **disabled** (`workflow_dispatch`-only,
hard-gated `if: ${{ false }}`, references no secret). To arm it later:

1. Add an `ANTHROPIC_API_KEY` repository secret (Settings → Secrets and variables → Actions).
2. In the workflow, uncomment the "Draft catalog entries (AI)", "Verify", and "Open a review PR"
   steps, and pass the key through, e.g. `env: { ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }} }`.
3. Remove the `if: ${{ false }}` gate and choose a real trigger (e.g. a manual dispatch you run after
   an SDK change), keeping the human-approved PR as the only way content lands.

The model only ever drafts the one-sentence catalog bullet; the detector and the snippet fix never
call a model, and `yarn verify` gates every result.

## Validate the plugin

```bash
claude plugin validate ./tools/claude-plugin
```
