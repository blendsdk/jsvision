# 03-04 · Key-Chord Reclaim, Clipboard Bridge, Node-Builtin Stubs & Dogfood

> **Document**: 03-04-browser-integration.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-02 Must-Have #6, #7, #8 · ST-5, ST-6, ST-9 · AR-1, AR-4, AR-5

## `src/key-reclaim.ts` — key-chord reclaim (Must-Have #6)

`attachKeyReclaim(term, options?)` adds a **capture-phase** `keydown` listener that, **only while the
terminal is focused**, calls `preventDefault()` on browser-hijacked chords so they reach the TUI
instead of the browser. Returns an unsubscribe.

```ts
export interface KeyReclaimOptions {
  /** Extra chords to reclaim beyond the defaults, or ['*'] to attempt every non-plain-text chord. */
  readonly also?: readonly string[];
  /**
   * Predicate for "is the terminal focused". Defaults to a DOM focus check on a real terminal's
   * textarea; a headless terminal has none, so headless runs and tests inject this predicate.
   */
  readonly isFocused?: () => boolean;
}
// `term` is the same local `TerminalLike` the host uses (03-02) — no `@xterm/xterm` import; the
// capture-phase keydown listener is added on the document, so a minimal terminal handle is enough.
export function attachKeyReclaim(term: TerminalLike, options?: KeyReclaimOptions): () => void;
```

**Default reclaim set** (RD minimum): F1–F12, `Ctrl+W`, `Ctrl+N`, `Ctrl+T`, `Ctrl+S`, `Ctrl+P`,
`Tab`, `Shift+Tab`, `Alt+<letter>`, `Backspace` (browser back). Matching is on `KeyboardEvent`
`key`/`code` + modifier flags, through a narrow local `ReclaimKeyEvent` interface (no DOM lib).

```ts
/** Chords a browser will not release to the page even with preventDefault (reserved by the OS/browser). */
export const UNRECLAIMABLE_CHORDS: readonly string[] = ['Ctrl+W', 'Ctrl+N', 'Ctrl+T', /* … curated */];
```

`UNRECLAIMABLE_CHORDS` is a **curated static constant** (some browsers reserve `Ctrl+W/N/T`
regardless), exported so RD-05/RD-08 can document the remap. We do not probe the live browser — the
list is the documented best-effort truth.

**ST-5 / AC-5**: with reclaim attached and the terminal "focused" (mocked `isFocused`), dispatch a
fake `F1` keydown → `defaultPrevented === true`, and the corresponding xterm bytes decoded through the
host yield `{ type:'key', key:'f1', … }` on `onInput`; assert `UNRECLAIMABLE_CHORDS` is a non-empty
exported array.

## `src/clipboard.ts` — clipboard bridge (Must-Have #7)

`setClipboard(text, caps)` — the **outbound** path: writes `text` to the browser Clipboard API
(`navigator.clipboard.writeText`), **gated on a user gesture** (browser policy). No automatic reads.
Inbound paste is xterm's existing bracketed-paste path (`?2004`, already enabled by `start()`), so no
inbound code is needed here.

```ts
export interface ClipboardBridge {
  /** Write text outbound to the browser clipboard (requires a user gesture). Returns the write promise. */
  writeText(text: string): Promise<void>;
}
/** Write `text` to the browser clipboard. `caps` is accepted for API symmetry with the OSC-52 path. */
export function setClipboard(text: string, caps: CapabilityProfile, clipboard?: ClipboardBridge): Promise<void>;
```

The optional `clipboard` param defaults to `navigator.clipboard` (via a narrow local interface) and is
injected in tests (AR-4) — the runtime **never** calls `readText()`.

**ST-6 / AC-6**: `setClipboard('copied', caps, mockClipboard)` triggers **exactly one**
`writeText('copied')` on the mock; assert the mock's `readText` was **never** called (no clipboard
read is ever issued).

## `src/browser-stubs.ts` — node-builtin stubs (Must-Have #8, AR-1)

Promote the spike's `node-stub.ts`: throwing placeholders for the `node:fs`
(`writeSync`/`openSync`/`closeSync`) + `node:tty` (`ReadStream`/`WriteStream`) named imports the
`@jsvision/core` barrel statically pulls in. **Three** sites import these: `host/streams.ts` +
`host/platform.ts` (the native TTY host, never called in the browser) and `safety/logger.ts` — a
barrel-reachable `import * as nodeFs from 'node:fs'` used lazily as the screen-safe logger's default
filesystem. Each stub export throws a loud, clear error if ever invoked (it would mean the app reached
into a native facility). The logger site stays safe: it is off by default (writes zero bytes), the
namespace is only dereferenced if a consumer enables the file sink without injecting an `fs`, and its
first call (`openSync`) hits the stub and throws — so the boundary still fails loud, not silently.

Exported via the **`@jsvision/web/browser-stubs` subpath only** — never from the `.` barrel — so
importing `@jsvision/web` doesn't drag the stubs into a consumer's graph. Consumers alias the two
specifiers to this module in their bundler config. **Documented recipe** in the package README:

```ts
// vite.config.ts (consumer, e.g. docs-site)
import { fileURLToPath } from 'node:url';
const stub = fileURLToPath(new URL('@jsvision/web/browser-stubs', import.meta.url));
export default defineConfig({ resolve: { alias: { 'node:fs': stub, 'node:tty': stub } } });
```

**Import-graph boundary (ST-4 companion to ST-1):** because `@jsvision/core` legitimately imports
`node:fs` (the three sites above), the boundary is NOT "no `node:fs` in the transitive graph" — it
holds only once the consumer's alias replaces the specifier. So the AC-4 test asserts the two
**satisfiable** facts: (1) `@jsvision/web`'s **own source** imports no `node:fs`/`node:tty`, and (2) a
**stubbed build** of the demo emits no `node:fs` specifier (core's sites resolve to `browser-stubs`).
Together these prove the boundary holds for a real consumer.

## Security seam — `sanitize()` (ST-9 / AC-9)

No new code: all terminal input flows through the engine's byte `decode()`; all text rendered to the
buffer flows through `@jsvision/core`'s `sanitize()` injection boundary. **ST-9**: render untrusted
file content containing a raw `ESC` (`0x1b`) through a view onto the buffer, then `serialize()`; assert
**no raw ESC** reaches the terminal write (it is stripped by `sanitize()`). Plus: the virtual-FS
open/save path issues **no network request** (asserted by a mocked/absent `fetch` — nothing to call).

## Dogfood — refactor the spike (AR-5)

Rewire `packages/examples/web-xterm/` to consume `@jsvision/web`:

- Delete `browser-host.ts` + `node-stub.ts` locals; import `createBrowserHost` + `browser-stubs` from
  `@jsvision/web`. Point `vite.config.ts`'s alias at `@jsvision/web/browser-stubs`.
- Extract `WEB_CAPS` from `app.ts` to `buildBrowserCaps()`; optionally shrink `main.ts` onto
  `mountApp` (keeping the demo clock).
- The demo must render **identically** (its `demo:web` still boots the same desktop). This is the live
  proof the extraction is verbatim.

> The spike is an example, not a shipped package, so its `@jsvision/ui` "Turbo Vision" phrasing and
> any lingering IDs are out of `check:docs` scope — but the **promoted** `packages/web/src` files are
> in scope and must be clean.

## Verify (this component)

`yarn verify` green; ST-5, ST-6, ST-9 pass; `check:docs` green. Note the refactored `web-xterm` spike
is **not** in verify's typecheck scope — the examples `tsconfig.json` `include` omits it, as it does
every browser demo — so the dogfood's correctness against the built `@jsvision/web` is proven by the
live `demo:web` boot (above), not by `yarn verify`.
