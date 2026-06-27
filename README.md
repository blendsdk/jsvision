# @blendsdk/tui

An SDK for building **Turbo Vision-style terminal applications** in TypeScript.

This package is the **foundation** of the SDK (RD-01): a clean, typed,
tree-shakeable **ESM-only** library with **zero runtime dependencies**. The
renderer, input, host, and capability subsystems are added by later milestones
and re-exported from this package's single public entry point.

> **Status:** `0.1.0` — pre-1.0. The public API is still being built out and may
> change between minor versions.

## Install

```bash
npm install @blendsdk/tui
```

**Requirements:** Node.js **>= 18** (active LTS: 18, 20, 22).

## Usage

`@blendsdk/tui` is **ESM-only**. Import it from an ES module:

```ts
import { VERSION } from '@blendsdk/tui';

console.log(VERSION); // "0.1.0"
```

Type declarations (`.d.ts`) and source maps ship with the package, so editors get
full type information out of the box.

### Capability detection (RD-02)

`resolveCapabilities()` detects the running terminal and returns an immutable
`CapabilityProfile` plus a per-field **reason trace** showing which layer set each
field. Detection is layered with safe fallback — **(1)** explicit override,
**(2)** live runtime query, **(3)** environment, **(4)** known-terminal table,
**(5)** conservative defaults — so every later subsystem auto-configures with zero
setup.

```ts
import { resolveCapabilities } from '@blendsdk/tui';

// Zero-config: detect from env + known-terminal table + safe defaults.
const { profile, reasons } = resolveCapabilities();
profile.colorDepth; // 'truecolor' | '256' | '16' | 'mono'
reasons.colorDepth; // 'override' | 'runtime' | 'env' | 'table' | 'default'

// Force fields (deep partial, merged over detection).
resolveCapabilities({ override: { mouse: { sgr: false } } }).profile.mouse.sgr; // false

// Re-resolve after a detected terminal change (otherwise cached per process).
resolveCapabilities({ refresh: true });
```

`NO_COLOR` (any value) forces `mono`; `FORCE_COLOR=0|1|2|3` selects
`mono|16|256|truecolor`. The result is deep-frozen, and no environment value is
ever logged.

The live runtime query (layer 2) is asynchronous and bounded. RD-02 ships the
injectable `TerminalQuery` seam and the response parser; the real input stream is
wired in by a later milestone (RD-06). Supply a query via the async resolver:

```ts
import { resolveCapabilitiesAsync } from '@blendsdk/tui';

// `query` implements TerminalQuery; resolution is bounded by `timeoutMs`
// (default 200 ms) and never hangs on a silent terminal.
const { profile } = await resolveCapabilitiesAsync({ query, timeoutMs: 200 });
```

### ESM-only — `require()` is not supported

The package declares no CommonJS `require` condition. Importing it from CommonJS
fails with a clear ESM error:

```js
// ❌ throws ERR_REQUIRE_ESM
const { VERSION } = require('@blendsdk/tui');
```

Use `import` (or a dynamic `await import('@blendsdk/tui')`) instead.

## Contributing

The toolchain is plain Node tooling — no test framework, just `node:test` run
through `tsx`.

| Command              | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `npm run verify`     | `typecheck` + `test` + `build` — must exit 0               |
| `npm run lint`       | ESLint + Prettier (check only)                             |
| `npm run lint:fix`   | ESLint `--fix` + Prettier `--write`                        |
| `npm run check:deps` | Fail if any runtime dependency requires native build steps |
| `npm pack --dry-run` | Inspect the published file set (`dist/` + metadata only)   |

Tests follow a strict split:

- `*.spec.test.ts` — specification tests; an immutable oracle derived from the
  requirements/acceptance criteria.
- `*.impl.test.ts` — implementation/edge-case tests.

Both run via `npm test`. The heavier pack-and-install end-to-end test lives in
`test/install.e2e.test.ts` and is run explicitly:

```bash
npx tsx --test test/install.e2e.test.ts
```

## License

[MIT](LICENSE)
