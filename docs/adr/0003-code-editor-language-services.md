# ADR 0003: Use public language adapters and the Language Server Protocol

- Status: Accepted
- Date: 2026-07-24

## Decision

Use public adapters for local JavaScript, TypeScript, PostgreSQL, and plain-language behavior.
Use the standard Language Server Protocol behind a transport-neutral session interface for remote
intelligence.

## Consequences

The terminal editor has no compiler, database, language-server process, or network requirement.
Hosts choose in-process, process, or other transports while protocol validation stays shared.
