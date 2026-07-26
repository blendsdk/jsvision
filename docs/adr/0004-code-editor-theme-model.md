# ADR 0004: Use a hybrid semantic theme model

- Status: Accepted
- Date: 2026-07-24

## Decision

Resolve stable semantic editor roles from application-derived colors, editor overrides, or
independent palettes. Terminal capability resolution applies monochrome and ASCII fallbacks.

## Consequences

Theme changes affect projected cells only. Document, history, selection, parser, fold, and
language-service state remain unchanged, and required states never depend on color alone.
