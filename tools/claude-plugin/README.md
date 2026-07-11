# jsvision plugin

A Claude Code plugin that makes Claude an expert **jsvision** terminal-UI (TUI) application
developer — it can scaffold, compose, run, verify, and extend jsvision apps.

## What's inside

- **`jsvision` skill** — the knowledge base. Claude loads it automatically when you ask to build or
  extend a jsvision app. It carries the mental model, the non-negotiables, a component catalog, the
  common gotchas, the run/verify loop, theming, widget authoring, and runnable recipes.
- **`/jsvision-new-app <name>` skill** — scaffolds a complete, runnable app package under
  `packages/<name>/` (you invoke this one manually).

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

## Validate the plugin

```bash
claude plugin validate ./tools/claude-plugin
```
