---
title: Codex plugin
description: Install and use the JSVision Codex plugin in any TypeScript project.
---

# Codex plugin

The JSVision Codex plugin gives Codex version-matched framework guidance, generated public API
references, standalone project scaffolding, static diagnostics, and headless screen rendering. It
works in consumer projects that install JSVision from npm; a JSVision monorepo checkout is not
required.

## Install from the marketplace

Add the marketplace at the tag matching the latest stable JSVision release, then install the plugin:

```sh
codex plugin marketplace add blendsdk/jsvision --ref v1.1.0
codex plugin add jsvision-plugin@jsvision-marketplace
```

Start a new Codex thread after installation so its skills are discovered. The plugin version stays
in lockstep with the stable `@jsvision/*` package version.

## Use the plugin

Ask Codex to build, extend, debug, test, or review a JSVision application. The main `jsvision` skill
can trigger automatically, or you can invoke it explicitly:

```text
Use $jsvision to build a keyboard-first inventory application.
```

The plugin includes four skills:

| Skill               | Purpose                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `$jsvision`         | Architecture, public APIs, components, layout, reactivity, forms, grids, files, themes, and production quality |
| `$jsvision-new-app` | Create a standalone Node 22+, ESM TypeScript project using published JSVision packages                         |
| `$jsvision-doctor`  | Detect common layout, lifecycle, focus, modal, and NodeNext mistakes                                           |
| `$jsvision-render`  | Render an application or view as a deterministic headless text screenshot                                      |

## Create a standalone application

Ask Codex to create an app and describe the desired starting point. The generator supports basic,
form, grid, and dashboard starters. It:

1. Detects npm, Yarn, pnpm, or Bun from project metadata and lockfiles.
2. Asks when package-manager detection is ambiguous and otherwise falls back to npm.
3. Creates a new subdirectory by default.
4. Requires explicit confirmation before writing into the current directory.
5. Installs dependencies automatically with the selected package manager.
6. Refuses path traversal and conflicting files.

Generated applications export `buildApp()` for tests and headless rendering while keeping terminal
startup behind a direct-execution guard.

## Diagnose and render

The doctor uses the consumer project's TypeScript compiler. When TypeScript is absent, Codex asks
before adding it as a development dependency.

The renderer accepts modules exporting `buildApp`, `build`, or a default factory. If an application
uses another entry shape, add a small adapter export rather than executing its uncontrolled startup
path. Render at normal and constrained terminal sizes and use driven key sequences to inspect
interaction states.

## Version-sensitive guidance

The plugin targets the latest stable JSVision release. It inspects the consumer project's installed
package versions and public declarations before relying on version-sensitive details. Upgrade the
packages and plugin together when they differ.

## Update

Refresh the tagged marketplace snapshot, reinstall the plugin, and start a new thread:

```sh
codex plugin marketplace upgrade jsvision-marketplace
codex plugin add jsvision-plugin@jsvision-marketplace
```

To move to a newer stable release, re-add the marketplace with that release tag before reinstalling.

## Troubleshooting

- **Plugin not listed:** run `codex plugin marketplace list` and confirm `jsvision-marketplace` is
  configured at the intended stable tag.
- **Skill changes are not visible:** reinstall the plugin and start a new Codex thread.
- **Doctor cannot find TypeScript:** install TypeScript in the consumer project after approving the
  package-manager command.
- **Renderer cannot resolve JSVision:** install the stable `@jsvision/ui` package in the project
  containing the module being rendered.
- **Renderer cannot find an entry:** export `buildApp`, `build`, or a default factory that constructs
  the app without connecting to the terminal.
