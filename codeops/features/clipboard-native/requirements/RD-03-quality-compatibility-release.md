# RD-03: Quality, Compatibility, and Release Governance

> **Document**: RD-03-quality-compatibility-release.md
> **Status**: Approved
> **Created**: 2026-07-28
> **Project**: JSVision Native Clipboard
> **Depends On**: RD-01, RD-02
> **Complexity**: M
> **CodeOps Artifact Schema**: 1

## Feature overview

Define the non-functional contract and evidence required to ship native clipboard integration
without weakening existing clipboard routes, privacy, responsiveness, SDK portability, or generated
Codex guidance. *(AR-12–AR-17)*

## Functional requirements

### Must have

- **R3.1 — Specification-first evidence.** New immutable `*.spec.test.ts` tests shall be written and
  observed failing before production changes. Separate `*.impl.test.ts` tests shall cover internal
  generations, queue cleanup, helper validation, and error paths after implementation. *(AR-15)*
- **R3.2 — Existing-route regression.** No-reader synchronous local paste, writer OSC 52 fallback,
  browser outbound copy, default/classic clipboard aliases, user keymap precedence, terminal
  bracketed paste, and current widget clipboard suites shall remain green. *(AR-04, AR-12)*
- **R3.3 — Widget acceptance.** Native results shall be exercised through real loop/application
  objects for `Input`, `Editor`/`Memo`, and `CodeEditorView`; only the host adapter is faked.
  CodeEditor bracketed-paste behavior shall be verified but not reimplemented under this feature.
  *(AR-12, AR-15)*
- **R3.4 — Security evidence.** Tests shall prove that clipboard text, content previews, thrown
  host values, helper stderr, and derived text never appear in logs for sync/async read and write
  failures, invalid targets, truncation, or teardown. *(AR-13, AR-20)*
- **R3.5 — Documentation.** Consumer docs shall explain automatic native application behavior,
  `systemClipboard: false`, custom callbacks, explicit-read timing, raw-text and 1 MiB bounds,
  ordered focus safety, successful empty reads, fallback, terminal bracketed paste, and
  headless/SSH limitations. Public exports shall carry complete JSDoc and examples. *(AR-16)*
- **R3.6 — Plugin governance.** After mapped SDK changes, execution shall inspect every reference
  reported by source-impact checking, update canonical `tools/jsvision-skill/` content where
  semantically required, run `yarn plugin:update`, include generated
  `plugins/jsvision-plugin/skills/jsvision/` changes, and pass `yarn plugin:check`. *(AR-16)*
- **R3.7 — Automated gates.** Focused core, UI, CodeEditor, examples, and docs checks shall pass,
  followed by authoritative `yarn verify`. No implementation is complete while any gate fails.
  *(AR-15, AR-16)*
- **R3.8 — Manual matrix.** The pull-request handoff shall record copy-out, ordinary `Ctrl+V`
  paste-in, and bracketed fallback for every environment in the matrix below. Unavailable cells are
  marked untested, never inferred. *(AR-15)*

### Should have

- **R3.9 — Changelog/release note.** Consumer-visible release notes shall distinguish native
  application adapters from browser Clipboard API and OSC 52 behavior. *(AR-16)*

### Won't have

- A claim that automated CI proves a real desktop clipboard path.
- A release blocker requiring access to every manual OS/terminal cell; unavailable cells require
  honest reporting and follow-up ownership rather than fabricated evidence. *(AR-15)*

## Non-functional requirements

### Performance and resource bounds

- Dispatch of a paste command returns before a pending host read settles.
- At most one native read callback is active per event loop.
- Direct host text allocates at most `PASTE_CAP_BYTES` for the bounded encoding buffer and does not
  first encode the entire over-cap payload.
- No polling, retry loop, background clipboard monitor, or per-frame clipboard work exists.
- Queued requests retain destination metadata, not clipboard payloads. *(AR-07, AR-09, AR-17)*

### Availability and recovery

- Native integration is best-effort and request-driven.
- A reader failure recovers locally once; a writer failure leaves local state committed.
- A hung reader may hold the native request queue but does not block keyboard input, rendering,
  bracketed paste events, quit, or teardown.
- Stop/dispose is final for queued/in-flight clipboard continuations. *(AR-05, AR-08, AR-17)*

### Compatibility

- Public additions are source-compatible; automatic native behavior is default-on only when
  `Application.run()` owns the native terminal host.
- Direct event loops and `systemClipboard: false` retain the previous no-reader behavior.
- Browser hosting remains outbound-only unless separately specified in a future feature.
- The selected Node dependency is optional in published UI and loaded only on demand.
- Clipboard strings preserve raw content in canonical state; individual widgets retain their
  established insertion normalization. *(AR-03, AR-04, AR-11, AR-12)*

### Security and privacy

| Concern | Required treatment |
|---|---|
| Sensitive clipboard data | In memory only; never logs, snapshots, previews, fixtures from a real clipboard, or persistent evidence |
| Host-controlled exceptions/stderr | Discard details; stable payload-free warning only |
| Command/shell injection | No UI shell construction; adapter receives raw strings through its typed API |
| Terminal-sequence injection | Native read text is a `PasteEvent` payload, never terminal output |
| Path/SQL/HTML injection | Not applicable; no such interpreter is added |
| Authentication/rate limiting | Local explicit gesture is the authorization/admission boundary; one active read provides backpressure |
| Secrets/encryption | No credentials, storage, or transport introduced |
| Supply chain | Revalidate package/version/license/engine and review lockfile changes |

## Manual validation matrix

| Environment | Copy out | Ordinary `Ctrl+V` in | Bracketed fallback |
|---|---:|---:|---:|
| Ubuntu GNOME Terminal, X11 | Required | Required | Required |
| Ubuntu GNOME Terminal, Wayland | Required | Required | Required |
| Windows Terminal + `cmd.exe` | Required | Required | Required |
| Classic Windows Console Host + `cmd.exe` | Required | Required | Required |
| macOS Terminal | Required | Required | Required |
| SSH without display forwarding | Native may fail | App-local fallback required | Required |

## Commonly forgotten requirements

| Concern | Disposition |
|---|---|
| Audit trail / data export / deletion / retention | N/A: no persisted clipboard data |
| API versioning | Optional additive callbacks; existing package versioning applies |
| Error and empty states | Payload-free warnings and successful-empty semantics specified |
| Loading state | No new UI; input/rendering stays responsive |
| Accessibility / i18n / timezones | No new visible control or translatable runtime text |
| Backup / disaster recovery | N/A: volatile local value; app-local fallback is runtime degradation |
| Monitoring / alerting | Request-scoped logger warnings only; no telemetry |
| Configuration | Optional callbacks; no environment variable or feature flag |
| Input validation / injection | Host type and UTF-8 cap validated; no interpreter receives text |
| Auth / rate limiting | Explicit local command and one active read |
| Secrets / encryption / infrastructure | No credentials, storage, network, container, or server surface |
| Security testing | Log redaction, over-cap input, failure, race, and teardown tests mandatory |

## Scope decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Automated native validation | Real clipboard / injected adapter | Injected adapter | Deterministic and non-destructive | AR-15 |
| Manual evidence | Claim full support / record observed cells | Record observed cells | Honest environmental evidence | AR-15 |
| Distribution updates | Docs only / canonical + generated plugin | Canonical + generated | Project-supported SDK surface | AR-16 |

## Acceptance criteria

1. [ ] Specification tests are committed only after their intended pre-implementation failures are
   recorded; implementation tests remain separate.
2. [ ] Core helper, UI lifecycle/ordering, widget parity, examples integration, and docs/plugin
   checks each have focused passing evidence.
3. [ ] No-adapter, OSC 52, browser write, bracketed paste, aliases, keymap precedence, and existing
   clipboard behavior remain green.
4. [ ] Security tests find no clipboard payload or host-controlled details in any diagnostic.
5. [ ] Documentation and generated API/plugin references describe the same callback and fallback
   contract.
6. [ ] `yarn plugin:update`, `yarn plugin:check`, and authoritative `yarn verify` pass on the final
   source state.
7. [ ] The manual matrix is included in the handoff with each cell marked passed, failed, or
   unavailable/untested.
