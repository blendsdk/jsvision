# Phase 3 Dependency Review: `clipboardy`

> **Reviewed**: 2026-07-28
> **Decision**: Proceed with the planned `clipboardy: ^5.3.2` private examples dependency
> **Plan impact**: None

## Current release

| Property | Verified value |
|---|---|
| Latest release | `5.3.2` |
| Node engine | `>=20` |
| License | MIT |
| Module/API | ESM default export with async `read(): Promise<string>` and `write(text): Promise<void>` |
| Repository baseline | Node `>=22`; compatible |

Evidence was collected with:

```sh
npm view clipboardy version engines license dependencies optionalDependencies repository dist-tags --json
```

The [official package documentation](https://www.npmjs.com/package/clipboardy) confirms macOS,
Windows, Linux X11/Wayland, BSD, WSLg, and Termux support. On Wayland it uses `wl-clipboard` when
available and falls back to X11 tools. Linux requires a display server; headless environments do not
have a system clipboard. The adapter must therefore preserve the planned payload-free failure and
canonical app-local fallback behavior.

## Pre-install dependency surface

All six direct runtime dependencies are new to the current lockfile:

- `clipboard-image@^0.1.0`
- `execa@^9.6.1`
- `is-wayland@^0.1.0`
- `is-wsl@^3.1.0`
- `is64bit@^2.0.0`
- `powershell-utils@^0.2.0`

The `execa` branch introduces several new utility packages while sharing the repository's existing
`cross-spawn` resolution. Platform-specific branches add `run-jxa`, `is-inside-container`, and
`system-architecture`. The exact Yarn resolution set and integrity entries will be reviewed after
the manifest edit. No package requires an engine newer than the repository baseline, and the
reviewed packages report MIT licenses.

## Implementation constraints retained

- Add the dependency only to private `@jsvision/examples`.
- Import and inject only the asynchronous text methods; never invoke synchronous or image APIs.
- Preserve raw strings exactly, including empty values, Unicode, and line endings.
- Do not install platform helpers, retry, poll, log clipboard payloads, or make remote clipboard
  claims.
- Preserve the pre-existing `@lezer/common@^1.5.2` lockfile selector while reconciling the planned
  dependency edit.
