# RD-02: `tvedit` Native Clipboard Adapter

> **Document**: RD-02-tvedit-native-adapter.md
> **Status**: Approved
> **Created**: 2026-07-28
> **Project**: JSVision Native Clipboard
> **Depends On**: RD-01
> **Complexity**: S
> **CodeOps Artifact Schema**: 1

## Feature overview

Make the private native `tvedit` demonstration the concrete desktop host for RD-01. It owns
`clipboardy`, injects only asynchronous plain-text callbacks, and leaves headless automation and SDK
packages independent of the real machine clipboard. *(AR-10, AR-11, AR-15)*

## Functional requirements

### Must have

- **R2.1 — Dependency ownership.** `clipboardy` shall be a runtime dependency of private
  `@jsvision/examples`; no published JSVision package shall depend on it directly or transitively.
  The execution session shall re-check the current release, license, Node engine, and API before
  changing `package.json`/`yarn.lock`. *(AR-10, AR-11)*
- **R2.2 — Async text methods only.** Interactive `tvedit` shall inject writer and reader callbacks
  that call `clipboardy.write(text)` and `clipboardy.read()`. It shall not call `writeSync`,
  `readSync`, image methods, or helper executables directly. *(AR-10)*
- **R2.3 — Raw-text boundary.** The adapter shall pass exact strings and shall not encode OSC,
  normalize line endings, inspect content, or expose `clipboardy` types through UI APIs. *(AR-03,
  AR-11)*
- **R2.4 — Headless isolation.** The existing non-TTY first-frame smoke path shall not call the real
  clipboard. Automated tests shall inject a fake adapter and never read or mutate the developer/CI
  clipboard. *(AR-15)*
- **R2.5 — Failure degradation.** Missing displays, missing/restricted platform helpers, denied
  PowerShell operations, containers, and SSH without display forwarding shall flow through RD-01's
  local fallback without terminating `tvedit`. Framework code shall not prompt or install packages.
  *(AR-05, AR-14, AR-17)*
- **R2.6 — Shell independence.** Windows behavior shall depend on the adapter's hidden
  non-interactive host mechanism, not the interactive parent shell. Launch from `cmd.exe` remains a
  required manual cell. *(AR-10, AR-15)*

### Should have

- **R2.7 — Testable composition.** Keep the two callback functions small and injectable so a
  composition test can prove exact delegation without launching a platform clipboard process.
  *(AR-15)*

### Won't have

- Wrapper logic that duplicates `clipboardy` platform selection or fallback binaries.
- Packaging `tvedit` as a Node single executable; bundled-helper availability in SEA/bundled output
  is outside this issue.
- Automated manual-matrix execution on environments unavailable to the implementer. *(AR-14,
  AR-15)*

## Technical requirements

### Selected dependency

| Property | Planning value | Execution rule |
|---|---|---|
| Package | `clipboardy` | Revalidate before install |
| Version | `^5.3.2` | Update AR-10 if current evidence invalidates it |
| Module | ESM default export | Use Node conditional export |
| Node engine | `>=20` | Compatible with examples `>=22` |
| License | MIT | Retain dependency metadata through normal lockfile |
| Methods | `read()`, `write(text)` | Async text only |

### Platform responsibility

JSVision does not promise or reimplement a particular helper. Acceptance follows the selected
`clipboardy` release's supported local desktop environments: macOS clipboard tools, Windows hidden
PowerShell/native fallback, Linux X11/Wayland helpers and fallbacks, and WSL bridging. A platform
failure is an adapter failure, not an application crash. *(AR-10, AR-17)*

## Integration points

| File/area | Requirement |
|---|---|
| `packages/examples/package.json` | Own the runtime dependency. |
| `packages/examples/tvedit-demo/` | Compose injectable async reader/writer and pass them to `createApplication`. |
| `packages/examples/test/` | Verify delegation and headless isolation with fakes. |
| `yarn.lock` | Include only the dependency resolution produced by Yarn 1. |

## Scope decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Dependency owner | UI / core / private example | Private example | Keeps published SDK host-neutral | AR-11 |
| API mode | Sync / async | Async | Platform helpers may have startup latency | AR-10 |
| Test boundary | Real clipboard / injected fake | Injected fake | Deterministic and non-destructive | AR-15 |

## Security considerations

- `tvedit` forwards clipboard strings but never logs them or adapter errors.
- Framework code constructs no shell command and accepts no executable path from clipboard text.
- Dependency installation occurs only during authorized execution; no runtime package installation
  exists.
- The adapter inherits local desktop permission and process isolation from `clipboardy`; JSVision
  adds no elevated privileges, credentials, network access, or persistence.

## Acceptance criteria

1. [ ] Interactive `tvedit` injects exactly one async writer and one async reader backed by
   `clipboardy.write`/`read`.
2. [ ] Copy and paste adapter tests observe exact Unicode/multiline strings without touching the
   real clipboard.
3. [ ] The headless first-frame test exits 0 without invoking either adapter.
4. [ ] A fake no-display/rejected adapter leaves the process alive and exercises RD-01 fallback.
5. [ ] No `clipboardy` import, type, or dependency appears in published SDK packages.
6. [ ] The examples package typecheck, unit tests, and E2E smoke pass on the supported CI OS matrix.
