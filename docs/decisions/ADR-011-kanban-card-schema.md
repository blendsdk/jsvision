# ADR-011: Combine generic cards with package-owned schema dialogs

> **Date**: 2026-08-03
> **Status**: Accepted
> **Source**: Kanban RD-04 and RD-10

## Context

Every application has different card records, yet developers expect useful defaults such as title,
status, fields, badges, progress, and checklist previews. Editing must support mainstream patterns
without forcing a universal storage schema or cluttering compact cards with inline controls.

## Options considered

### Require one fixed card record

- **Pros**: Simple rendering and editing.
- **Cons**: Excludes many real application domains and couples UI to storage.

### Require consumers to render and edit everything

- **Pros**: Maximum freedom.
- **Cons**: No consistent accessibility, theming, i18n, validation, or mainstream default experience.

### Provide adapters, descriptors, schemas, and optional standard defaults

- **Pros**: Generic records with bounded presentation and package-quality dialogs.
- **Cons**: More contracts and validation paths to maintain.

## Decision

Map arbitrary `TCard` records through bounded presentation adapters, provide an optional
`StandardCard` adapter, and generate package-owned editor dialogs from customizable field schemas.

**Chosen option**: Generic adapters plus standard defaults, because it balances immediate usefulness
with application-owned data shapes.

## Consequences

### Positive

- Status-driven title/background roles and checklist previews remain reactive.
- Applications can select which bounded summaries appear at each density.
- Dialogs provide consistent localization, validation, stale-conflict handling, and responsive layout.

### Negative

- Schema extensions must define measurement, formatting, validation, and serialization boundaries.
- Long card/checklist content must be clipped or ellipsized predictably.

### Risks

- Extension output could become unbounded or unsafe; descriptor validation and centralized limits are
  enforced before layout or rendering.
