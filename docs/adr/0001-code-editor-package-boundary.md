# ADR 0001: Isolate Code Editor as a public package

- Status: Accepted
- Date: 2026-07-24

## Decision

Ship source editing as `@jsvision/code-editor`, with a browser-neutral root, optional language
subpaths, and a Node-only transport subpath.

## Consequences

Consumers get a focused editor surface without turning `@jsvision/ui` into an IDE framework.
Optional parsers and Node process APIs remain outside unrelated application bundles.
