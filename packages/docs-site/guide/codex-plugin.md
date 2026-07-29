---
title: Codex plugin
description: Install the JSVision Codex plugin, invoke its skills, verify generated guidance, and diagnose host integration failures.
---

# Codex plugin

The JSVision Codex plugin gives Codex version-matched framework guidance, project scaffolding,
static diagnostics, and deterministic headless rendering. It works in a consumer project that
installs JSVision from npm; you do not need a JSVision monorepo checkout.

This integration course is for developers who have completed
[Install & packages](/guide/install-and-packages) and want Codex to follow JSVision's supported
APIs and quality workflow. By the end, you will be able to:

- install the tagged JSVision marketplace and plugin;
- select or explicitly invoke the right bundled skill;
- distinguish the canonical skill sources from the assembled plugin distribution; and
- verify installation, recover from stale guidance, and diagnose helper failures.

Plugin installation and skill discovery happen in the Codex host, outside the browser
documentation runtime. This course therefore uses a verified installation transcript and
repository integrity evidence instead of an embedded live lab.

## Install from the marketplace

Add the marketplace at the tag matching the stable JSVision packages in your project, then install
the plugin:

```sh
codex plugin marketplace add blendsdk/jsvision --ref v1.3.0
codex plugin add jsvision-plugin@jsvision-marketplace
```

Start a new Codex thread after installation so its bundled skills are discovered. The plugin
version stays in lockstep with the stable `@jsvision/*` package version. Pinning the marketplace tag
makes the guidance reproducible for that release instead of silently following a moving branch.

You can confirm the configured source and installed plugin without changing them:

```sh
codex plugin marketplace list
codex plugin list
```

Codex also exposes `/plugins` in an interactive CLI session. The browser lets you inspect
marketplace entries and enable or disable an installed plugin. See the official
[Codex plugin documentation](https://learn.chatgpt.com/docs/plugins) for host and surface
availability.

## Invoke the plugin

Describe the desired outcome normally and let the main `jsvision` skill activate, or name it
explicitly when you want to make the workflow unambiguous:

```text
Use $jsvision to build a keyboard-first inventory application.
```

The installed plugin ships four skills:

| Skill               | Use it when you need                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `$jsvision`         | Architecture, public APIs, layout, reactivity, components, localization, testing, or production review       |
| `$jsvision-new-app` | A standalone Node 22+, ESM TypeScript starter using published JSVision packages                              |
| `$jsvision-doctor`  | TypeScript-backed diagnosis of layout, lifecycle, focus, modal, rendering, or NodeNext mistakes and footguns |
| `$jsvision-render`  | A deterministic headless text screenshot at normal or constrained sizes, optionally after driven key input   |

The main skill inspects the consumer project's installed versions and public declarations before
making version-sensitive claims. It should use public package entry points; it should not copy
internal monorepo imports into consumer code.

## Scaffold a standalone application

Ask Codex to use `$jsvision-new-app`, describe the application, and choose a starter. The generator
offers basic, form, grid, and dashboard starters. It detects npm, Yarn, pnpm, or Bun from project
metadata and lockfiles, asks when detection is ambiguous, and otherwise falls back to npm.

The skill resolves its installed directory and runs this command shape:

```sh
node <skill-directory>/new-jsvision-app.mjs <name> --package-manager <manager>
```

Add `--template form|grid|dashboard` for a specialized starter, or `--list` to inspect the
available templates. The default destination is a new subdirectory. The generator requires
explicit confirmation before writing into the current directory with `--current-dir`, refuses path
traversal and conflicting files, and installs dependencies with the selected package manager.

Generated applications export `buildApp()` for tests and headless rendering while keeping terminal
startup behind a direct-execution guard.

## Diagnose a project

The `$jsvision-doctor` uses the consumer project's TypeScript compiler, scans a file or directory,
and reports concrete errors, warnings, and informational findings:

```sh
node <skill-directory>/jsvision-doctor.mjs [path]
```

If TypeScript is missing, Codex must ask for approval before installing it as a development
dependency. Fix or explain each finding, then rerun the doctor until the output is understood. A
clean result is:

```text
jsvision-doctor: no issues found ✓
```

The doctor is static evidence. Follow it with headless rendering and interaction tests when the
problem is visual or behavioral.

## Render and interact headlessly

`$jsvision-render` accepts a module exporting `buildApp`, `build`, or a default factory. The skill
runs the renderer through the consumer project's `tsx` so TypeScript modules load in the
consumer-project environment:

```sh
<package-manager> exec tsx <skill-directory>/render-app.mjs <module> \
  [--export name] [--pick property] [--size 80x24] [--keys "tab enter"]
```

Render at normal and constrained terminal sizes. Use `--keys` to capture important focus,
navigation, and mutation states. If the module has another entry shape, add a small adapter export
instead of executing an uncontrolled terminal startup path. The renderer resolves JSVision from the
consumer project and never connects to a real terminal.

## Canonical source and generated distribution

The repository separates human-reviewed guidance from the installable copy:

| Path or command                                     | Ownership and purpose                                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tools/jsvision-skill/`                             | Canonical, agent-neutral skill source and the source of truth for semantic guidance                                  |
| `plugins/jsvision-plugin/skills/jsvision/`          | Assembled distribution copy; generated by synchronization and never edited directly                                  |
| `plugins/jsvision-plugin/.codex-plugin/plugin.json` | Installable plugin identity, version, capabilities, and skill root                                                   |
| `.agents/plugins/marketplace.json`                  | Marketplace name, local source, installation policy, and category used to package and test the repository plugin     |
| `yarn plugin:update`                                | Regenerates API pages and recipe snippets, records source-impact evidence, then assembles the canonical skill copy   |
| `yarn plugin:check`                                 | Verifies manifests, links, canonical/distributed equality, generated snippets and API pages, templates, and coverage |

When framework work affects a mapped plugin surface, review the references reported by the impact
tool, edit the canonical source where necessary, run `yarn plugin:update`, and include the
regenerated distribution in the same change. Editing
`plugins/jsvision-plugin/skills/jsvision/` directly only creates drift; the next update replaces
that edit.

Consumer projects do not run these maintainer commands. They install a tagged marketplace snapshot
and use the bundled skills. The commands are documented here so maintainers and contributors know
which side of the source boundary they own.

## How the integration is verified

There is no honest browser live example for Codex installation or host-side skill discovery. The
authentic substitute checks the actual repository artifacts:

1. `plugin.json` and `marketplace.json` parse, agree on `jsvision-plugin`, and resolve the plugin
   source.
2. The plugin version matches the stable JSVision package version.
3. Every canonical skill link, generated API page, synchronized recipe, and template passes its
   focused integrity rule.
4. The canonical and distributed skill trees match byte for byte, so stale or hand-edited generated
   guidance is detected.

Run the same evidence gate from a JSVision checkout:

```sh
yarn plugin:check
```

The verified success transcript is:

```text
check-plugin: PASS — all integrity checks green
```

This proves the checked-in package is internally consistent. A consumer should separately confirm
that `codex plugin marketplace list` points at the intended tag, `codex plugin list` reports the
plugin, and a new thread can discover the requested skill.

## Update

Refresh the tagged marketplace snapshot, reinstall the plugin, and start a new Codex thread:

```sh
codex plugin marketplace upgrade jsvision-marketplace
codex plugin add jsvision-plugin@jsvision-marketplace
```

To move to a newer stable release, add the marketplace again with that release tag before
reinstalling. Upgrade the `@jsvision/*` packages and plugin together; otherwise the installed
declarations and the plugin's release-matched guidance can differ.

## Troubleshooting

Diagnose host integration as a chain: marketplace source, installed plugin, newly discovered skill,
consumer dependencies, then helper entry point.

| Symptom                                        | Likely cause                                                                                        | Correction                                                                                                           | Evidence to verify                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Plugin not listed**                          | The marketplace is absent, unavailable under workspace policy, or configured at the wrong tag.      | Run `codex plugin marketplace list`, then add the approved tagged source if it is missing.                           | The list names `jsvision-marketplace` and resolves the intended snapshot.                          |
| **Skill changes are not visible**              | The marketplace snapshot or installed plugin is stale, or the current thread predates installation. | Upgrade the marketplace, run `codex plugin add jsvision-plugin@jsvision-marketplace`, then start a new Codex thread. | `codex plugin list` reports the installed plugin and the new thread discovers its skills.          |
| **Package and plugin versions differ**         | JSVision packages or the marketplace tag were upgraded independently.                               | Align every `@jsvision/*` dependency with the matching tagged plugin release.                                        | Compare installed package versions with the plugin version reported by `codex plugin list --json`. |
| **Doctor cannot find TypeScript**              | The consumer project does not provide the compiler the doctor resolves.                             | Approve installing TypeScript as a development dependency with the project's package manager.                        | Rerun the doctor and retain its bounded findings or clean transcript.                              |
| **Renderer cannot resolve JSVision**           | The rendered module's consumer project does not install `@jsvision/ui`.                             | Install the matching stable `@jsvision/ui` package in that project.                                                  | Rerun from the consumer root and confirm the module reaches headless construction.                 |
| **Renderer cannot find an entry**              | The module exports neither `buildApp`, `build`, nor a default factory.                              | Add a small construction-only adapter export; do not invoke uncontrolled terminal startup.                           | Rerun and confirm a framed screen at both normal and constrained sizes.                            |
| **Integrity check reports distribution drift** | A generated copy was edited directly or the canonical source changed without synchronization.       | Edit `tools/jsvision-skill/`, run `yarn plugin:update`, review the generated diff, then rerun `yarn plugin:check`.   | The gate prints `check-plugin: PASS — all integrity checks green`.                                 |

## Practice and next steps

1. Install the plugin at the stable tag matching a small JSVision project. In a new thread, ask
   `$jsvision-doctor` to inspect the project and explain every finding before changing code.
2. Ask `$jsvision-render` to capture the same screen at `80x24` and at a constrained size. Drive one
   important keyboard sequence and compare the frames.
3. In a JSVision checkout, identify which files are canonical and which are generated. Run
   `yarn plugin:check` and explain what each integrity category protects.

Continue with [Layout](/guide/layout) to build responsive terminal-cell interfaces. Use
[Testing headlessly](/guide/testing-headlessly) when you want to turn renderer output and driven
input into deterministic tests. The [Guide map](/guide/) shows the complete learning path.
