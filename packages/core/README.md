# @jsvision/core

The foundation engine of the `jsvision` SDK for building classic
terminal (TUI) applications in TypeScript: capability detection & auto-config, a
pure byte→event input decoder, a width-correct rendering engine with a pure
damage-diff serializer, depth-aware colour encoding, a native tty host with
guaranteed restore on every exit path, and a safety layer (essentials gate,
sanitize boundary, typed errors).

ESM-only, zero runtime dependencies, Node ≥ 22.

```bash
npm install @jsvision/core
```

```ts
import { resolveCapabilities, ScreenBuffer, serialize } from '@jsvision/core';
```

See the [jsvision repository](https://github.com/blendsdk/jsvision) and the
[documentation site](https://blendsdk.github.io/jsvision/) for the full
reference, versioning policy, and ADRs.
