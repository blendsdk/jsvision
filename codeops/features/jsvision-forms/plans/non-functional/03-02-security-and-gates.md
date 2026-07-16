# Security, Audit & Gates: Non-Functional (RD-04)

> **Document**: 03-02-security-and-gates.md
> **Parent**: [Index](00-index.md)

## Overview

The three non-story deliverables of RD-04: the render-path **security test** (FR-4.3), the
RD-01/02/03 **spec-coverage audit** (FR-4.5), and the barrel **surface lock** (FR-4.2) — plus the
final green **verify/lint gate** (FR-4.8). Each is small; together they close every remaining RD-04
acceptance criterion.

## Render-path security *(FR-4.3, AR-P2, AR-22)*

### Current Architecture
`security.impl.test.ts` pins the store as a transparent holder: a control-byte value round-trips
byte-for-byte through `field.value` / `rawValues()` / `values()`. Its doc-comment is explicit —
"the store never renders" — so nothing yet proves the render side of AR-22's promise (the engine
never bypasses the widgets' control-byte sanitization).

### Proposed test
Add `packages/forms/test/security.spec.test.ts` — a **spec oracle** derived from FR-4.3's acceptance
criterion (a control-byte value cannot escape sanitization on render). It binds a text field to a
real `Input`, sets a control-byte-laden value, mounts through a `RenderRoot`, and asserts every
painted cell is a printable glyph.

```ts
import { test, expect } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot, createRenderRoot, Input } from '@jsvision/ui';
import { createForm } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

test('a control-byte field value is sanitized when rendered through a bound Input', () => {
  const schema = z.object({ text: z.string() });
  const nasty = 'a\x00b\x1b[31mc\x07\r\n\x9b';
  const form = createForm({ schema, initial: { text: '' } });
  form.field('text').value.set(nasty);

  createRoot((dispose) => {
    const input = new Input({ value: form.field('text').value });
    input.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 1 } };
    const rr = createRenderRoot({ width: 40, height: 1 }, { caps });
    rr.mount(input);
    for (const row of rr.buffer().rows())
      for (const cell of row) {
        const cp = cell.char.charCodeAt(0);
        // No C0 (< 0x20), DEL (0x7f), or C1 (0x80–0x9f) may reach the buffer. The C1 clause is
        // load-bearing: a raw 0x9b (single-byte CSI) is >= 0x20 and would slip a naive >= 0x20 check.
        expect(cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f), `control byte painted: ${cp}`).toBe(false);
      }
    dispose();
  });
});
```

### Design notes
- **Harness parity:** `caps` / `createRenderRoot` / `rr.buffer().rows()` / `cell.char` are exactly
  the shapes `kitchen-sink.smoke.spec.test.ts` already uses — no new render API is invented. The
  absolute-layout setter `view.layout = { position:'absolute', rect }` is confirmed present on the
  shipped widgets. If a bare `Input` paints nothing, wrap it in a `Group` before mounting (the smoke
  harness always mounts a `Group`).
- **Assertion:** the store keeps the bytes opaque (already pinned by `security.impl.test.ts`); on
  render, `sanitize()` drops ESC/C0/C1 and `ScreenBuffer.set` replaces any surviving C0/DEL with a
  space, so the buffer must contain no C0 (`< 0x20`), DEL (`0x7f`), or **C1 (`0x80–0x9f`)** code
  point. The C1 clause is load-bearing: a raw `0x9b` (single-byte CSI) is `>= 0x20`, so a
  `>= 0x20`-only check would not catch it. This is an **integration/security oracle** — store → bind
  → `Input` → buffer end-to-end.
- **Expected phase:** since the sanitization already ships in `@jsvision/ui`, this oracle is expected
  to pass on first run; its value is pinning the contract against regression. Spec-first ordering is
  still honored (write the oracle, observe it, then it stays green).

### Error Handling
| Case | Expected | AR Ref |
| ---- | -------- | ------ |
| Value contains NUL/ESC/BEL/CR/LF/CSI bytes | No rendered cell is a control byte — no code point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f` (the CSI `0x9b` case) | AR-P2, AR-22 |

## Coverage audit *(FR-4.5, AR-P3)*

Map every RD-01/02/03 acceptance criterion to a spec test in `07-testing-strategy.md §Coverage
audit matrix`. Procedure:

1. Read each shipped `*.spec.test.ts` (`store`, `validation`, `adapters`, `bind-field`).
2. For each RD-01 AC (8), RD-02 AC (7), RD-03 AC (5), record the covering spec test (file +
   `should…` name) in the matrix.
3. Any AC with **no** covering spec test is a genuine gap → add a spec case to the appropriate
   existing `*.spec.test.ts` (spec-first: write the case, watch it red if truly new behavior — but
   here the behavior ships, so it validates existing code — then green).
4. Do **not** edit an existing spec oracle's expectations to fit code (immutable-oracle rule); only
   *add* cases.

Grounding note: the shipped suites (`store.spec`, `validation.spec`, `adapters.spec`,
`bind-field.spec`) already correspond to the RD-01/02/03 functional areas; the audit's likely output
is "fully covered, zero gaps," but the matrix must prove it cell by cell rather than assume it.

## Surface lock *(FR-4.2, AR-P6)*

Add `packages/forms/test/surface.impl.test.ts` asserting the built barrel's **runtime** exports are
exactly the value exports:

```ts
import * as forms from '../src/index.js';
test('the barrel exports exactly the specified runtime surface', () => {
  expect(Object.keys(forms).sort()).toEqual(
    ['FormFieldError', 'bindCheck', 'bindField', 'bindRadio', 'createForm'].sort(),
  );
});
```

- Types (`Form`, `Field`, `CreateFormOptions`) are compile-time only — they are not runtime keys, so
  they are intentionally absent from this assertion. FR-4.2's type surface is guaranteed by
  `typecheck`, not this test.
- The test fails the instant an internal helper is accidentally re-exported — the regression guard
  FR-4.2's AC ("importing anything not in the list fails") asks for.

## Green build & lint gate *(FR-4.8, AR-P7)*

- Every phase's Verify line is `yarn verify` (root: `yarn lint` then `turbo run typecheck build test
  check:docs`).
- Before the PR-opening/updating push, run `yarn lint:fix` and commit whatever it changes (project
  Prime directive) so CI is never the first place a fixable lint/format error surfaces. The new
  examples/story code and the new forms tests are all in `yarn lint`'s scope.

## Testing Requirements
- `security.spec.test.ts` passes (render-path oracle).
- `surface.impl.test.ts` passes (exact runtime keys).
- Coverage matrix in `07` is complete; any gap-filling spec cases pass.
- `yarn verify` green; `yarn lint:fix` leaves the tree clean.
