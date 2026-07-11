# Plugin Package: jsvision-plugin

> **Document**: 03-01-plugin-package.md
> **Parent**: [Index](00-index.md)

## Overview

The plugin shell: the on-disk layout under `tools/claude-plugin/`, the `plugin.json` manifest, the
repo-root `marketplace.json`, the install/usage README, and the integrity gate `check-plugin.mjs`
that guards the whole plugin. Owns FR-1, FR-8, FR-10.

## Architecture

### Proposed Layout

```
tools/claude-plugin/
├── .claude-plugin/
│   └── plugin.json                 # manifest (name, description, version)
├── README.md                       # install + usage + in-repo app-target model (FR-10)
├── skills/
│   ├── jsvision/                   # the knowledge skill (03-02)
│   │   ├── SKILL.md
│   │   └── references/…
│   └── jsvision-new-app/           # the scaffolder skill (03-04)
│       ├── SKILL.md
│       └── scripts/new-jsvision-app.mjs
└── templates/
    └── app-skeleton/…              # the files the generator emits (03-04)

.claude-plugin/marketplace.json      # repo root — the marketplace catalog (name/owner/plugins)
scripts/check-plugin.mjs            # repo root — the integrity gate (invoked by yarn verify)
```

Only `plugin.json` lives inside `.claude-plugin/`; `skills/`, `templates/` sit at the plugin root
per the plugin convention.

## Implementation Details

### `plugin.json` (minimal, schema-first)

Keep it minimal — rely on default directory conventions (`skills/` auto-discovered). Versioned
independently of the SDK, starting at `0.1.0`.

```json
{
  "name": "jsvision-plugin",
  "description": "Build jsvision terminal-UI applications at an expert level: scaffold, compose, run, verify, and extend TUI apps.",
  "version": "0.1.0",
  "author": { "name": "jsvision" }
}
```

> The exact field set is validated against the live plugin schema during execution (Phase 1
> deliverable). If `claude plugin validate` accepts only a subset, `check-plugin.mjs` mirrors that
> subset. Design choice per AR-1/AR-13.

### `.claude-plugin/marketplace.json` (repo root)

Lives at the **repo root** in `.claude-plugin/`. The marketplace root is the directory containing
`.claude-plugin/`, so the plugin `source` `./tools/claude-plugin` resolves to `<repo>/tools/claude-plugin`
(no `../` — allowed). Required root fields: `name`, `owner`, `plugins`; each entry needs `name` + `source`.

```json
{
  "name": "jsvision-marketplace",
  "owner": { "name": "jsvision" },
  "plugins": [
    {
      "name": "jsvision-plugin",
      "source": "./tools/claude-plugin",
      "description": "Expert jsvision TUI app development."
    }
  ]
}
```

A local `source` is a plain **string** relative path (PF-001); a future published `source` is
`{"source":"github","repo":"owner/repo"}` — a one-line change. **Primary dev/use path is
`claude --plugin-dir tools/claude-plugin`**, which runs the plugin in place so the `packages/examples`
recipe modules + the drift check are reachable during `verify`/CI. A marketplace install instead
copies only the plugin dir to `~/.claude/plugins/cache`, carrying the embedded recipe snippets but
not the live modules (PF-006 — consistent with the in-repo decision, AR-2).

### `check-plugin.mjs` (integrity gate — FR-8)

Pure Node (zero deps), invoked **directly** by the root `verify` script (AR-10), exits non-zero on
any failure. Checks:

1. **Manifest schema** — `plugin.json` parses and carries the required fields; `marketplace.json`
   parses and references the plugin.
2. **Link-graph integrity** — every relative path referenced from a `SKILL.md` or a reference file
   (`references/…`, `recipes/…`, `scripts/…`, `templates/…`) exists on disk. No dead links.
3. **Recipe snippet-drift** — for each `recipes/<name>.md`, the quoted region equals the current
   text of the source module region it cites (mirrors the docs-site drift check). Owner of the
   expected behavior: ST-15.
4. **Scaffolder-output validity** (light) — the `templates/app-skeleton/` files parse / are
   well-formed placeholders; deep validation is the scaffolder's own spec tests (03-04).
5. **Barrel-coverage** (Tier 0 drift gate, AR-18) — scoped to the `@jsvision/ui` **class value
   exports** (symbols whose declaration is a `ClassDeclaration`, resolved via the TS checker by
   extending the docs-site `barrelExports()` machinery to filter by symbol kind — PF-003). That set
   is ≈ exactly the widget set (plus the `View`/`Group` base classes, held in a tiny maintained
   denylist). Every such class must appear in `component-catalog.md`, and every widget the catalog
   names must still be a barrel class export. This deterministically excludes types, functions,
   constants, and re-exported `@jsvision/core` values — so the gate stays low-noise while still
   tripping on a newly-added widget. It is the one gate that makes *additive* SDK growth loud;
   breaking changes are already caught by the recipes' + scaffolder-output's typecheck/smoke.

Structured like `scripts/gate.mjs` — the repo's plain-node governance script that runs *outside*
turbo (`check-jsdoc.mjs`, by contrast, runs *inside* turbo as each package's `check:docs`; PF-007) —
a `main()` that prints PASS/FAIL per check,
`process.exitCode = 1` on failure). Its own correctness is spec-tested with good/bad fixtures
(ST-12…ST-15).

### Root `verify` wiring (AR-10, AR-11)

```jsonc
// root package.json — the ONE modified line
"verify": "yarn lint && turbo run typecheck build test check:docs && node scripts/check-plugin.mjs"
```

Running the script directly (not via a turbo task) sidesteps the known turbo-cache staleness where
a cached package task false-passes when a repo-root input changes.

## Integration Points

- `check-plugin.mjs` reads the `jsvision`/`jsvision-new-app` skill trees (03-02, 03-04) and the
  recipe `.md` ↔ `packages/examples/recipes` modules (03-03) for the drift check.
- The README documents the `--plugin-dir` dev path and the `packages/<app>/` app-target model
  (AR-2), and points at `/jsvision-new-app` (03-04).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Manifest missing a required field | `check-plugin.mjs` fails with the field name | AR-10 |
| Dead reference link in a skill/reference | `check-plugin.mjs` fails naming the file + broken target | AR-10 |
| Recipe doc drifted from its source module | `check-plugin.mjs` fails naming the recipe + region | AR-10 |
| `marketplace.json` doesn't reference the plugin | `check-plugin.mjs` fails | AR-10 |

> **Traceability:** Every strategy references the register entry that resolved it.

## Testing Requirements
- Spec tests for `check-plugin.mjs` using good + seeded-broken fixtures (ST-12…ST-15).
- Manifest validity confirmed by `claude plugin validate` (if available) and the schema check.
