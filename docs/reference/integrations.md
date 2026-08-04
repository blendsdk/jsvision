# Kanban integrations

> **Last Updated**: 2026-08-04
> **Status**: Foundation integrations implemented; mounted board, dialogs, and saved views pending

## Integration map

| System                       | Direction           | Purpose                                            | Trust boundary                                   |
| ---------------------------- | ------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Application record model     | Into component      | Supply generic cards through an adapter            | Validate descriptors and identifiers             |
| Application data source      | Both                | Open query sessions and publish revisions          | Cancel stale loads; isolate cell failures        |
| Application dispatcher       | Out of component    | Authorize and apply atomic requests                | Capabilities are not authorization               |
| Application saved-view store | Both                | Persist semantic view JSON                         | Validate version and resource bounds             |
| `@jsvision/ui`               | Internal dependency | Layout DSL, views, input, commands, windows        | Public package APIs only                         |
| `@jsvision/forms`            | Internal dependency | Generic editor/configuration fields and validation | Bounded schemas and async validation             |
| `@jsvision/i18n`             | Internal dependency | Catalogs, locale fallback, accelerators            | Ten package locale subpaths                      |
| Docs browser host            | Example-only        | Run deterministic terminal labs                    | No implicit visitor files, network, or clipboard |

## Application data adapter

The adapter maps application records into stable IDs and bounded display descriptors. It may expose
the package's optional standard card fields, but the application record remains opaque to Kanban.
Formatting functions must be deterministic for a published revision and must return sanitized,
display-cell-measurable values.

The package snapshots and validates descriptor output before rendering. Invalid custom output is
replaced by the standard safe fallback, so applications can localize or log a failure category
without exposing the rejected record fields.

## Data source and query session

An eager adapter can wrap an in-memory collection. A windowed adapter may query a server, database,
or other store, but those transports stay outside the package. It exposes cancellation and explicit
knowledge states rather than leaking transport-specific pagination objects.

## Request dispatcher

The dispatcher is the only durable-effect boundary. It receives normalized requests, authorizes them,
and publishes an application result. Rejection messages are localized by category; application detail
must be bounded and safe. Undo/redo integrates through application history tokens rather than a hidden
component history stack.

## Saved-view storage

The application may store views locally or remotely and decide whether they are private, shared, or
read-only. The package supplies semantic codecs and migrations only. Storage credentials, encryption,
sharing authorization, retention, and conflict resolution remain application concerns.

## Testing integrations

The `/testing` subpath supplies deterministic fixtures and contract harnesses, not production mocks.
Host tests must cover cancellation, stale results, failure isolation, authorization rejection,
responsive geometry, keyboard parity, pointer capture, Unicode/color degradation, and disposal.
