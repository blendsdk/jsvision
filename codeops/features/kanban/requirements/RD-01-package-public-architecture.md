# RD-01: Package and Public Architecture

> **Document**: RD-01-package-public-architecture.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

This document defines the publishable boundary of `@jsvision/kanban`: package metadata, dependencies,
exports, naming, ownership, component topology, identity rules, and extension discipline. Every later
feature depends on these invariants. The package is an SDK component, not a data store or Kanban
application.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Publish a standalone ESM TypeScript workspace package named `@jsvision/kanban` for Node 22+.
- [ ] Export `KanbanBoard<TCard>` as the primary component and `KanbanViewport<TCard>` as an advanced
  composable viewport surface.
- [ ] Keep authoritative cards, columns, swimlanes, saved views, permissions, persistence, history,
  and mutations application-owned.
- [ ] Provide one public mutation-intent path: all component, command, dialog, and programmatic changes
  to application-owned data dispatch a typed request and wait for application resolution/publication.
- [ ] Classify state as ephemeral interaction state, durable local semantic view state, or shared
  application-owned state; local view transitions remain pure and only application-store operations
  such as saved-view save/rename/delete cross the dispatcher boundary.
- [ ] Support generic application card records without requiring `StandardCard`.
- [ ] Provide the foundational standard models, renderers, and in-memory reference helpers needed by
  the read-only board. Editor, configuration-dialog, saved-view, command, and event APIs are added by
  their owning RDs while preserving this package topology and application-authority boundary.
- [ ] Use unambiguous public terminology: `column` means vertical workflow stage; `swimlane` means
  horizontal group; no exported semantic entity uses bare `lane`.
- [ ] Expose public source, request, state, renderer, capability, and testing contracts with complete
  JSDoc and practical examples. Later editor, saved-view, command, and event contracts follow the same
  public naming, extension, documentation, and compatibility rules when their owning RDs introduce them.

### Should Have — Complexity M

- [ ] Keep pure model/codecs independently testable and free of mounted UI state even though they are
  exported from the canonical package entry.
- [ ] Permit namespaced application request, field, renderer, editor, summary, and saved-view
  extensions without reserving unnamespaced future package identifiers.
- [ ] Match current JSVision package metadata, scripts, licensing, README, changelog, and dependency
  checking conventions.

### Won't Have (Out of Scope)

- Authentication, authorization storage, persistence, networking, backup, encryption services, or
  application business rules — these remain application/host responsibilities.
- A second `@jsvision/kanban-model` package — no separate release/version boundary is justified.
- Initial `/model` or `/dialogs` subpaths — the repository-standard main barrel is the canonical API.
- Direct component-side mutation of consumer records — it would violate authoritative ownership.

---

## Technical Requirements

### Package and dependency boundary — Complexity M

1. `package.json` shall declare `type: "module"`, `engines.node: ">=22"`, `sideEffects: false`, public
   publish metadata, and only the smallest runtime dependencies actually imported from
   `@jsvision/core`, `@jsvision/ui`, and `@jsvision/i18n`. Runtime schema validation, the `zod: ^4`
   peer/development dependency, and `@jsvision/forms` are introduced together by RD-10 when its
   standard editor/schema APIs consume them. The Phase A generic and `StandardCard` TypeScript
   contracts expose neither Zod nor Forms.
2. The export map shall provide:
   - `@jsvision/kanban` for production public APIs;
   - `@jsvision/kanban/testing` for deterministic public harnesses/fixtures; and
   - `@jsvision/kanban/locales/en`, `/nl`, `/de`, `/fr`, `/es`, `/it`, `/pt-PT`, `/pl`, `/ro`, `/sv`.
3. Internal files shall import leaf modules, never the package barrel, preventing circular initialization
   and duplicate type identity.
4. Production entry points shall not import test fixtures. Locale subpaths shall not eagerly register
   global state.
5. Package-local scripts shall include build, typecheck, unit test, applicable E2E, dependency check,
   and public-JSDoc check commands consistent with sibling specialist packages.

### Public component topology — Complexity L

1. `KanbanBoard<TCard>` shall be a normal JSVision `Group` whose ordinary content is composed with the
   public layout DSL.
2. `KanbanViewport<TCard>` shall be one measured custom leaf responsible only for bounded projection,
   exact-cell scrolling/sticky geometry, hit testing, damage calculation, and transient drag layers.
3. Logical focus and selection shall be stored by identity outside the lifecycle of a rendered card
   descriptor so virtualization cannot erase interaction state.
4. The package shall not mount one `View` per logical card. Any future visible-view recycler must be
   bounded by viewport/overscan, clear recycled state, and preserve the descriptor contract.
5. Public custom renderers shall receive bounded state/density/geometry inputs and return a validated
   descriptor; they shall not receive arbitrary board internals or host-resource handles.
6. Export `KanbanViewportOptions<TCard>` with the read-projection inputs required for independent
   construction: source, reactive query, card adapter, optional reactive i18n/density/theme/capability/
   identity inputs, limits, overscan, and observation sink. `KanbanBoardOptions<TCard>` extends that
   shape only with board-owned application-authority inputs such as the dispatcher.
7. Each viewport owns exactly one read coordinator/session lifecycle. A board composes and delegates to
   one viewport and shall not create a second coordinator; standalone and board-owned disposal are
   idempotent.

### Identity and registry rules — Complexity M

| Identity | Public representation | Invariant |
|---|---|---|
| Card | `CardKey = string | number` | Stable for the record lifetime; `1` and `'1'` remain distinct |
| Column/swimlane/field/view/checklist | bounded `string` | Stable; never derived from a translated display label |
| Renderer/editor/action/extension | bounded namespaced `string` | Collisions reject; package namespace is reserved |
| Operation | unique bounded `string` | Correlates request, projection, events, and result |
| Placement token | opaque branded bounded `string` | Valid only for its source/query revision; never saved |
| Revision | typed opaque scalar supplied by source/application | Equality only unless an adapter documents ordering |

All structural, registry, action, and operation IDs reject empty values, control characters, terminal
escape sequences, duplicate values in one namespace, and values over 256 UTF-8 bytes. Placement and
undo tokens use the separate 2 KiB opaque-token bound in RD-14. Changing a published bound after stable
release is a compatibility decision.

### Application authority and request boundary — Complexity L

- Component projections shall never modify application objects or claim persistence.
- A successful dispatcher result means the request was accepted for application handling; visual
  commitment occurs only when authoritative source data publishes the corresponding placement/value.
- Application data wins over pending projection on every conflict.
- UI capability checks improve discoverability but are not authorization. Applications must enforce
  authorization again in the dispatcher.
- When the owning RDs introduce standard dialogs, they return typed drafts/request builders and may
  route them through the same dispatcher; a dialog result alone is never a committed model mutation.

### Versioning and compatibility — Complexity M

- Public APIs follow package semantic versioning.
- Public discriminated unions must include a documented extension strategy; consumers must not need
  unsafe casts to exhaustively handle package-owned variants.
- Serialized artifacts carry their own schema version and discriminator independently of package
  semver (RD-09).
- Deprecations require JSDoc migration guidance, docs updates, tests for the compatibility window, and
  release notes; removal requires a semver-major release.

---

## Integration Points

- **RD-02** implements the public source/query identities and revisions defined here.
- **RD-03** implements the `KanbanBoard`/`KanbanViewport` DSL boundary.
- **RD-08** defines the request/result lifecycle that enforces application authority.
- **RD-09 through RD-12** introduce saved-view, editor, configuration-dialog, command, and event APIs
  under the package and compatibility rules established here.
- **RD-13** defines locale and theme public surfaces.
- **RD-15** owns package docs, generated API, plugin impact, and distribution evidence.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Packaging | UI module / standalone package | Standalone package | Specialist component and docs/release surface | AR #1, #2 |
| Authority | Component / app / dual | Application | Avoid hidden persistence and policy | AR #3, #27 |
| Component shape | Monolithic / view-per-card / board+viewport | Board+viewport | Responsive DSL plus bounded exact cells | AR #41, #42 |
| Card model | Fixed / generic / generic+standard | Generic+standard | Flexible storage with strong defaults | AR #4, #35 |
| Exports | One / many subpaths / hybrid | Main + locales + testing | Repository consistency and bounded compatibility | AR #42 |
| Identity bound | Deferred / unbounded / centralized | 256-byte IDs | Concrete validation and safe registries | AR #43 |

---

## Security Considerations

- **Data sensitivity**: Card data may contain PII or confidential work content; core diagnostics and
  events must use IDs/counts/error codes, not entire records.
- **Input validation**: Validate all IDs, discriminators, extensions, callbacks, descriptor bounds, and
  serialized input before use. Consumer servers remain responsible for server-side validation.
- **Authentication & authorization**: Not implemented. The dispatcher is the application enforcement
  point; capability UI must never be described as security.
- **Injection risks**: All displayed text passes through JSVision's sanitized/bounded terminal text
  boundary. The package performs no SQL, HTML, shell, path, or `eval` execution.
- **Encryption/rate limiting/infrastructure**: N/A to this local library. Applications secure storage,
  transport, endpoints, secrets, and deployment. Component request concurrency is bounded in RD-14.

---

## Acceptance Criteria

1. [ ] Importing `KanbanBoard` and pure helpers from `@jsvision/kanban` and testing helpers from
   `@jsvision/kanban/testing` typechecks under NodeNext without private-path imports.
2. [ ] The package export map exposes exactly the main entry, testing entry, and ten required locale
   entries; an undeclared internal path fails Node export resolution.
3. [ ] A generic card type with no `StandardCard` inheritance constructs a typed board without unsafe
   casts.
4. [ ] Rendering a fixture with 100,000 logical cards mounts a bounded viewport structure rather than
   100,000 card `View` instances.
5. [ ] A dispatched accepted request does not change the authoritative source object before a source
   revision publishes the change.
6. [ ] Publishing contradictory application data removes the pending projection and renders the
   application value.
7. [ ] Runtime identity maps and published reconciliation observations distinguish card key `1` from
   card key `'1'`. RD-06 and RD-12 preserve the same distinction when they add focus, selection, and
   event behavior.
8. [ ] Empty, duplicate, over-bound, control-character, and escape-containing structural IDs are
   rejected with sanitized errors and do not mount partial board state.
9. [ ] Public production entry modules have no import path into `@jsvision/kanban/testing` fixtures.
10. [ ] Package dependency verification scans production source imports against declared dependencies,
    separately rejects native runtime dependencies, and a packed-consumer smoke fixture proves runtime,
    type, and export-map behavior without monorepo-only resolution.
11. [ ] Public exported entities pass the repository JSDoc checker and include examples where practical.
12. [ ] No exported type or member uses bare `lane` to mean either workflow columns or swimlanes.
13. [ ] A capability denial cannot prevent a caller from constructing a raw request, but the application
   dispatcher still receives and can reject it, proving capabilities are not authorization.
14. [ ] Malicious card text containing ANSI escapes is rendered as safe display text and is absent from
   diagnostics except for its stable card key.
15. [ ] Security boundaries above are covered by specification tests; storage encryption, network TLS,
   endpoint rate limiting, and host hardening are explicitly reported N/A rather than falsely tested.
