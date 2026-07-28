# RD-02: Automatic Native Application Clipboard

> **Document**: RD-02-tvedit-native-adapter.md
> **Status**: Approved
> **Created**: 2026-07-28
> **Project**: JSVision Native Clipboard
> **Depends On**: RD-01
> **Complexity**: S
> **CodeOps Artifact Schema**: 1

## Feature overview

Make every native application started through `Application.run()` use RD-01 automatically.
`@jsvision/ui` owns a lazy optional `clipboardy` dependency, while applications retain an explicit
opt-out and custom host callbacks retain precedence. Headless automation must remain independent of
the real machine clipboard. This supersedes the original `tvedit`-only ownership decision after
interactive kitchen-sink validation exposed that application-specific wiring did not meet the
desired system-wide default. *(AR-10, AR-11, AR-15)*

## Functional requirements

### Must have

- **R2.1 — Dependency ownership.** `clipboardy` shall be an optional runtime dependency of
  published `@jsvision/ui`. Normal installs receive it automatically; an unavailable optional
  dependency must degrade through RD-01 rather than making JSVision unusable. *(AR-10, AR-11)*
- **R2.2 — Default-on behavior.** `Application.run()` shall install one native reader/writer pair
  automatically when neither callback was supplied. It shall call only asynchronous
  `clipboardy.write(text)` and `clipboardy.read()` methods. *(AR-10)*
- **R2.3 — Raw-text boundary.** The adapter shall pass exact strings and shall not encode OSC,
  normalize line endings, inspect content, or expose `clipboardy` types through UI APIs. *(AR-03,
  AR-11)*
- **R2.4 — Lazy headless isolation.** Import and platform helper execution shall wait until the first
  system clipboard operation. Composition, browser mounting, and non-interactive first-frame tests
  shall not call the real clipboard. Automated tests shall inject or mock the external dependency
  and never read or mutate the developer/CI clipboard. *(AR-15)*
- **R2.5 — Failure degradation.** Missing displays, missing/restricted platform helpers, denied
  PowerShell operations, containers, and SSH without display forwarding shall flow through RD-01's
  local fallback without terminating the application. Framework code shall not prompt or install packages.
  *(AR-05, AR-14, AR-17)*
- **R2.6 — Shell independence.** Windows behavior shall depend on the adapter's hidden
  non-interactive host mechanism, not the interactive parent shell. Launch from `cmd.exe` remains a
  required manual cell. *(AR-10, AR-15)*
- **R2.7 — Explicit opt-out.** `createApplication({ systemClipboard: false })` shall suppress the
  automatic native pair while retaining app-local, bracketed-paste, and OSC 52 behavior.
- **R2.8 — Custom precedence.** Any explicitly configured clipboard callback shall suppress the
  automatic pair so an application never mixes two host clipboard owners implicitly.

### Should have

- **R2.9 — Testable composition.** Keep loading and the two callback functions small and injectable so a
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
| Node engine | `>=20` | Compatible with UI `>=22` |
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
| `packages/ui/package.json` | Own the optional runtime dependency. |
| `packages/ui/src/app/` | Lazily compose and install the ordered async reader/writer pair. |
| `packages/ui/test/` | Verify default-on, opt-out, custom precedence, ordering, and headless isolation. |
| `yarn.lock` | Include only the dependency resolution produced by Yarn 1. |

## Scope decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Dependency owner | UI / core / private example | UI optional dependency | Makes native `Application.run()` zero-configuration while preserving graceful install/runtime degradation | User amendment |
| API mode | Sync / async | Async | Platform helpers may have startup latency | AR-10 |
| Test boundary | Real clipboard / injected fake | Injected fake | Deterministic and non-destructive | AR-15 |

## Security considerations

- The application runtime forwards clipboard strings but never logs them or adapter errors.
- Framework code constructs no shell command and accepts no executable path from clipboard text.
- Dependency installation occurs only during authorized execution; no runtime package installation
  exists.
- The adapter inherits local desktop permission and process isolation from `clipboardy`; JSVision
  adds no elevated privileges, credentials, network access, or persistence.

## Acceptance criteria

1. [ ] Native `Application.run()` installs exactly one async writer and reader automatically.
2. [ ] Copy and paste adapter tests observe exact Unicode/multiline strings without touching the
   real clipboard.
3. [ ] Headless composition and browser builds complete without invoking either adapter.
4. [ ] A fake no-display/rejected adapter leaves the process alive and exercises RD-01 fallback.
5. [ ] `systemClipboard: false` preserves app-local, bracketed-paste, and OSC 52 behavior.
6. [ ] Explicit callbacks override the automatic pair.
7. [ ] UI/examples typechecks, unit tests, headless smoke, browser production build, and full
   verification pass on the supported CI OS matrix.
