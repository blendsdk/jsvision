# Phase 4 Release Evidence: Native Clipboard

> **Recorded**: 2026-07-28
> **Scope**: Issue #191 acceptance evidence
> **Manual status**: No interactive desktop clipboard environment was available

## Required manual environment matrix

Each operation cell is stated independently. `Unavailable/untested` means the executor could not
perform that operation in the named environment; it is not a pass inferred from automated tests.

| Environment | Copy out | Ordinary `Ctrl+V` in | Bracketed fallback |
|---|---|---|---|
| Ubuntu GNOME Terminal, X11 | **Unavailable/untested** — Linux/X11 display detected, but the executor has no stdin/stdout TTY or GNOME Terminal session | **Unavailable/untested** — no interactive terminal or safe user gesture | **Unavailable/untested** — no GNOME Terminal input path |
| Ubuntu GNOME Terminal, Wayland | **Unavailable/untested** — no Wayland session or GNOME Terminal | **Unavailable/untested** — no Wayland session or interactive terminal | **Unavailable/untested** — no Wayland terminal input path |
| Windows Terminal + `cmd.exe` | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux |
| Classic Windows Console Host + `cmd.exe` | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux |
| macOS Terminal | **Unavailable/untested** — executor is Linux; `pbcopy`/`pbpaste` absent | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux |
| SSH without display forwarding | **Unavailable/untested** — executor is not in an SSH session | **Unavailable/untested** — executor is not in an SSH session | **Unavailable/untested** — executor is not in an SSH session |

No cell read or mutated the developer clipboard. Follow-up ownership belongs to a maintainer with
access to each named interactive environment; unavailable cells do not block acceptance under
RD-03, but they must remain visible in the pull-request handoff.

## Automated evidence

Automated results support the implementation contract but do not replace the manual matrix.

| Evidence | Result |
|---|---|
| UTF-8 bounding specifications and mechanics | 21/21 passed |
| UI empty/native clipboard specifications and mechanics | 56/56 passed |
| CodeEditor empty/bracketed-paste regressions | 2/2 passed |
| `tvedit` adapter and documentation/plugin specifications | 18/18 passed |
| Headless `tvedit` first-frame E2E | 1/1 passed |
| Docs-site typecheck, tests, and VitePress build | Passed; 102/102 docs tests |
| Runtime dependency audit | 0 vulnerabilities across 86 packages |
| Plugin synchronization and integrity | Passed |

The headless E2E returns before importing `clipboardy`. Injected adapter tests cover exact raw
Unicode/line endings, empty reads, serialized write/read order, rejection recovery, payload-free
diagnostics, local fallback, and late lifecycle settlement without touching a real clipboard.
