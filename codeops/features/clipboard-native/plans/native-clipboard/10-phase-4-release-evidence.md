# Phase 4 Release Evidence: Native Clipboard

> **Recorded**: 2026-07-28
> **Scope**: Issue #191 acceptance evidence
> **Manual status**: Stock Ubuntu native copy, ordinary paste, and bracketed paste confirmed by the
> user; other environments remain unavailable

## Required manual environment matrix

Each operation cell is stated independently. `Unavailable/untested` means the executor could not
perform that operation in the named environment; it is not a pass inferred from automated tests.

| Environment | Copy out | Ordinary `Ctrl+V` in | Bracketed fallback |
|---|---|---|---|
| Ubuntu GNOME Terminal, X11 | **Passed** — user confirmed native copy out in the interactive application | **Passed** — user confirmed ordinary `Ctrl+V` reads the desktop clipboard | **Passed** — user confirmed terminal bracketed paste remains working |
| Ubuntu GNOME Terminal, Wayland | **Unavailable/untested** — no Wayland session or GNOME Terminal | **Unavailable/untested** — no Wayland session or interactive terminal | **Unavailable/untested** — no Wayland terminal input path |
| Windows Terminal + `cmd.exe` | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux |
| Classic Windows Console Host + `cmd.exe` | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux |
| macOS Terminal | **Unavailable/untested** — executor is Linux; `pbcopy`/`pbpaste` absent | **Unavailable/untested** — executor is Linux | **Unavailable/untested** — executor is Linux |
| SSH without display forwarding | **Unavailable/untested** — executor is not in an SSH session | **Unavailable/untested** — executor is not in an SSH session | **Unavailable/untested** — executor is not in an SSH session |

Automated execution did not read or mutate the developer clipboard. The Ubuntu cells record the
user's explicit interactive confirmation. Follow-up ownership for remaining cells belongs to a
maintainer with access to each named environment; unavailable cells do not block acceptance under
RD-03, but they must remain visible in the pull-request handoff.

## Automated evidence

Automated results support the implementation contract but do not replace the manual matrix.

| Evidence | Result |
|---|---|
| UTF-8 bounding specifications and mechanics | 21/21 passed |
| UI empty/native/default-on clipboard specifications and mechanics | 62 focused tests passed; full UI 2003/2003 passed |
| CodeEditor empty/bracketed-paste regressions | 2/2 passed |
| Automatic adapter and documentation/plugin specifications | Passed |
| Headless `tvedit` first-frame E2E | 1/1 passed |
| Docs-site typecheck, tests, and VitePress build | Passed; 102/102 docs tests |
| Runtime dependency audit | 0 vulnerabilities across 86 packages |
| Plugin synchronization and integrity | Passed |
| Authoritative `yarn verify` after the default-on amendment | Passed; 38/38 package tasks, all performance gates, and plugin integrity |
| Phase 5 independent quality loop | Passed after lifecycle fixes; no unresolved critical or major findings |

The adapter loads `clipboardy` only after the first system clipboard operation. Injected and mocked
adapter tests cover default-on behavior, explicit opt-out, custom callback precedence, exact raw
Unicode/line endings, empty reads, serialized write/read order, rejection recovery, payload-free
diagnostics, local fallback, and late lifecycle settlement without touching a real clipboard.
The VitePress production build proves the lazy optional dependency remains compatible with browser
composition.
