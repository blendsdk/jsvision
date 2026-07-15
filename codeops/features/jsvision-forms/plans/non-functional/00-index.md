# Non-Functional (RD-04) Implementation Plan

> **Feature**: Cross-cutting non-functional slice for `@jsvision/forms` — the mandatory kitchen-sink
> story, a render-path security test, a spec-coverage audit, a barrel-surface lock, and the green
> verify/lint gate that make the package a shippable member of the monorepo.
> **Status**: Planning Complete
> **Created**: 2026-07-15
> **Implements**: jsvision-forms/RD-04
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-04 is the reconciliation slice that turns `@jsvision/forms` from "three functional RDs shipped"
into "a correct, demonstrable, gated package." Most of its surface was already satisfied
incrementally while RD-01/02/03 shipped: the package builds, `check:deps` is green (zod is a pure-JS
peer, core/ui stay zero-dep), `check:docs` is green (every export has an `@example`, no banned
refs), and the barrel already exports exactly the specified surface.

What remains is narrow and concrete. First, the **NON-NEGOTIABLE kitchen-sink `forms/*` story** — a
live multi-field form that exercises every binding path (direct text, coerced number, `Switch`,
`bindRadio`, `bindCheck`), touched-gated error reveal, a `valid · dirty` echo, and a submit-gated
button — registered in the showcase and passing the headless smoke test. Second, a **render-path
security test**: FR-4.3's acceptance criterion asserts a control-byte value cannot escape
sanitization *on render*, and the shipped store round-trip test explicitly does not render, so this
plan adds a spec test that binds a field to a real `Input`, renders it, and proves the buffer is
sanitized. Third, a **spec-coverage audit** mapping every RD-01/02/03 acceptance criterion to a
passing spec test (filling only genuine gaps), a **barrel-surface lock** test, and the final
**`yarn verify` + `yarn lint:fix`** gate so CI lands green.

## Document Index

| #   | Document                                                | Description                                          |
| --- | ------------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)          | Zero-Ambiguity Gate decisions (audit trail)          |
| 00  | [Index](00-index.md)                                    | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                      | Scope delta over RD-04                                |
| 02  | [Current State](02-current-state.md)                    | What already ships vs. what is net-new               |
| 03-01 | [Kitchen-Sink Story](03-01-kitchen-sink-story.md)     | The `forms/*` showcase story spec                    |
| 03-02 | [Security, Audit & Gates](03-02-security-and-gates.md)| Render-path test, coverage audit, surface lock, gates|
| 07  | [Testing Strategy](07-testing-strategy.md)              | Spec test cases (ST-*) and verification              |
| 99  | [Execution Plan](99-execution-plan.md)                  | Phases and task checklist                             |

## Quick Reference

### Usage Example (the story's core wiring)

```ts
import { z } from 'zod';
import { createForm, bindField, bindRadio, bindCheck } from '@jsvision/forms';
import { Input, Switch, RadioGroup, CheckGroup, Button } from '@jsvision/ui';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  port: z.coerce.number().int().gte(1, 'Port ≥ 1').lte(65535, 'Port ≤ 65535'),
  tls: z.boolean(),
  mode: z.enum(['Dev', 'Staging', 'Prod']),
  features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
});
const form = createForm({ schema, initial: { name: '', port: '', tls: false, mode: 'Dev', features: [] as Array<'Logs' | 'Metrics' | 'Tracing'> } });

const nameInput = new Input({ value: form.field('name').value });
bindField(form.field('name'), nameInput);           // touched-on-first-blur
const modeRadio = new RadioGroup({ labels: ['Dev', 'Staging', 'Prod'], value: bindRadio(form.field('mode'), ['Dev', 'Staging', 'Prod']) });
// … submit gate: form.submit((v) => submitted.set(JSON.stringify(v)))
```

### Key Decisions

| Decision                         | Outcome                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| Render-path security proof       | Add `security.spec.test.ts` render-path oracle (AR-P2)             |
| RD-01/02/03 coverage audit depth | Map every AC → spec test; fill only genuine gaps (AR-P3)           |
| Story submit UX                  | Echo submitted values; invalid submit reveals errors (AR-P4)      |
| Story design                     | Server-connection form, all five binding paths (AR-P5)            |
| Barrel-surface AC                | Runtime keys-exactly test (AR-P6)                                 |

## Related Files

**Created:**
- `packages/examples/kitchen-sink/stories/forms.story.ts`
- `packages/forms/test/security.spec.test.ts`
- `packages/forms/test/surface.impl.test.ts`

**Modified:**
- `packages/examples/kitchen-sink/stories/index.ts` (register the story)
- `packages/examples/package.json` (add `zod` + `@jsvision/forms`)
- `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (per-story ST for `forms/form`)
- `packages/forms/test/*.spec.test.ts` (only if the audit finds an uncovered AC)
