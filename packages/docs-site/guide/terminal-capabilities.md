---
title: Terminal capabilities & portability
description: Detect terminal capability profiles, explain queries and overrides, and design portable fallbacks for real hosts.
---

# Terminal capabilities & portability

## Who is this course for?

This course is for developers who can already build and recover a JSVision application and now
need it to behave honestly on terminals they do not control. Complete
[Theming & colour depth](/guide/theming-and-colour-depth) and
[Crash safety](/guide/crash-safety) first.

By the end you can **build** from an explicit capability profile, **explain** why each fact was
chosen, **diagnose** a mismatch between the profile and the current session, and **verify**
degradation across native terminals, SSH, multiplexers, Windows, and browser hosts.

The beginner boundary is resolving and reading one profile. The intermediate boundary is querying,
overriding, and adapting output without losing keyboard access. Advanced work covers host
ownership, cleanup, evidence scope, and production diagnosis. The motivating problem is an
application that looks correct locally but emits broken glyphs, assumes a missing mouse protocol,
or loses typed bytes while probing a remote terminal.

## What is the capability mental model?

A capability profile is evidence for a rendering and interaction decision:

```text
known host facts
      |
environment -> terminal table -> optional runtime query -> explicit override
      |                                      |
      +------------ resolution --------------+
                         |
                 profile + reasons
                         |
           rendering, input, and fallback policy
```

`CapabilityProfile` contains the facts the application may act on: `colorDepth`, mouse protocols,
Unicode width behavior, OSC support, glyph families, platform, alternate-screen support, paste,
focus, and synchronization features. `CapabilityResolution` pairs that profile with a reason for
every top-level group.

Treat both as immutable evidence. The resolver returns a frozen profile and frozen reasons; never
mutate or assign to the profile to make a later branch convenient. Resolve a new profile or derive a
documented degraded profile instead.

Evidence is layered rather than magical detection. In general, an explicit override wins over a
runtime observation, which wins over environment evidence, a terminal table, and finally a
conservative default. A reason records which layer decided each top-level fact.

## How do I get the first useful profile?

Resolve once near application startup, then pass the result to the host and any policy that needs
it:

```ts
import { resolveCapabilities } from '@jsvision/core';

const resolution = resolveCapabilities();
const caps = resolution.profile;

if (!caps.mouse.sgr) {
  // Keep every required action available through keyboard commands.
}
```

With no options, `resolveCapabilities()` reads the current process environment and platform. That
ambient synchronous result is cached. It is the normal inexpensive starting point for a native
application, not a guarantee that every advertised feature survives the path to the user's
terminal.

## Laboratory: explain a capability resolution

Press Alt+E to compare Unknown, Environment, Runtime query, and Override evidence. Each step shows
the actual immutable profile and its reasons. Click **Explain next** to verify pointer parity. The
query scenario also reports preserved passthrough bytes rather than consuming unrelated input.

<PlayExample id="guides/capability-resolution"
  title="Capability resolution evidence laboratory"
  blurb="Compare conservative, environment, runtime-query, and override profiles and inspect the reason attached to each resolved fact." />

The laboratory uses bounded deterministic fixtures. It performs no live query against the
visitor's terminal and reads no visitor environment.

## What is inside a capability profile?

The important groups answer separate questions:

| Group         | Decision it supports                                    |
| ------------- | ------------------------------------------------------- |
| `colorDepth`  | mono, 16-colour, 256-colour, or truecolor serialization |
| `mouse`       | SGR reporting, drag, and wheel availability             |
| `unicode`     | UTF-8, width mode, and emoji-width evidence             |
| `glyphs`      | box drawing, half blocks, and ambiguous-width policy    |
| `osc`         | title, hyperlink, clipboard, and notification sequences |
| `altScreen`   | alternate-screen versus inline presentation             |
| `platform`    | host baseline and platform-specific policy              |
| `multiplexer` | whether an intermediary such as tmux was observed       |

`CapabilityResolution.reasons` is grouped at the same top-level decision boundary. A nested mouse
or Unicode member does not receive an independent reason: `reasons.mouse`, `reasons.unicode`, and
`reasons.glyphs` explain their whole nested group.

Use `dumpCaps()` when a human needs a compact one-line account:

```ts
import { dumpCaps, resolveCapabilities } from '@jsvision/core';

const resolution = resolveCapabilities();
const summary = dumpCaps(resolution);
// colorDepth=truecolor (env) mouse=sgr,drag,wheel (table) ...
```

The dump is deliberately secret-free: it describes normalized capabilities and reason layers, not
raw input, environment values, paths, or credentials. It is safe diagnostic structure, but your
surrounding log record must still redact user data and sensitive host metadata.

## How does synchronous detection work?

The synchronous resolver combines environment, platform, tables, and an optional override:

```ts
import { resolveCapabilities } from '@jsvision/core';

const fixture = resolveCapabilities({
  env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  platform: 'linux',
});
```

Inject `env`, `platform`, and `override` to make a test or fixture hermetic and deterministic.
Injected inputs bypass the ambient cache. The no-options call is cached because the process
environment normally does not change during a running application.

An unknown Linux environment deliberately starts conservatively: 16 colours and no SGR mouse.
Unknown means “evidence is incomplete.” It is a conservative fallback, not unsupported evidence;
use a bounded measurement instead of claiming certainty.

Colour precedence has one deliberate exception to the general layering. An explicit override is
highest; forced `NO_COLOR` or `FORCE_COLOR` environment policy outranks a runtime query; runtime
evidence outranks soft `COLORTERM` or `TERM` evidence and the terminal table. The presence of
`NO_COLOR`, even with an empty value, forces monochrome.

## When should I run live terminal queries?

Use the asynchronous resolver only when a runtime answer changes a meaningful policy and the host
can provide a query transport:

```ts
import { resolveCapabilitiesAsync } from '@jsvision/core';

const resolution = await resolveCapabilitiesAsync({
  query,
  timeoutMs: 200,
});
```

`resolveCapabilitiesAsync()` starts from environment evidence and adds a fresh runtime probe; live
query evidence is not cached. A silent terminal, malformed garbage, an oversized response, or a
timeout falls back to the environment-derived result. The operation is bounded to 1024 response
bytes and never rejects merely because detection failed.

The query decoder separates recognized replies from unrelated bytes. `resolution.passthrough`
contains typed keystrokes or input bytes that arrived during the probe. Feed those bytes to the
normal input decoder first and in order; dropping them makes startup eat user input.

For a native stream, the caller must first put input in raw, flowing mode.
`createTerminalQuery()` owns the query's data listener and buffered bytes:

```ts
import { createTerminalQuery, resolveCapabilitiesAsync } from '@jsvision/core';

const query = createTerminalQuery({
  input: process.stdin,
  output: process.stdout,
});
try {
  const resolution = await resolveCapabilitiesAsync({ query });
  useCapabilities(resolution);
} finally {
  query.close();
}
```

Close the query on success, failure, cancellation, and shutdown so its listener is detached. Restore
the raw and flowing modes in the surrounding host scope that acquired them. Pair acquisition and
cleanup in the same scope. Timers and other host listeners need the same discipline.

## When is an explicit override honest?

An override is honest when the host already knows a fact more reliably than generic detection.
A controlled screenshot test is one valid, honest use of an override, as is a documented embedded
terminal or a known host adapter:

```ts
import { resolveCapabilities } from '@jsvision/core';

const resolution = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: '256',
    mouse: { sgr: true },
  },
});
```

Overrides deep-merge nested groups, win at the highest precedence, and record `override` as the
reason for the affected group. They are useful for deterministic tests and explicit host contracts.

Never force an override merely because richer output is desirable. An override cannot add or
change terminal or host support; it only changes what the application believes. Forcing an
unsupported OSC feature, mouse mode, colour depth, or glyph family creates corrupt output rather
than capability.

## How do essential failures differ from degradations?

An interactive TTY is the hard requirement for the native interactive application path.
`evaluateEssentials()` separates that startup decision from independent degradations:

```ts
import { evaluateEssentials, resolveCapabilities } from '@jsvision/core';

const { profile } = resolveCapabilities();
const report = evaluateEssentials(profile, { isTTY: process.stdout.isTTY === true });

if (!report.met) throw new Error(report.missing.join(', '));
for (const degradation of report.degradations) {
  recordMode(degradation.mode);
}
```

| Missing capability  | Honest mode   |
| ------------------- | ------------- |
| mouse unavailable   | keyboard-only |
| mono or no colour   | monochrome    |
| no alternate screen | inline        |

A degradation or fallback does not mean failed startup. Keyboard-only, monochrome, and inline
modes remain working application modes. Keep each decision independent: no mouse does not imply no
Unicode, and monochrome does not imply ASCII.

## Laboratory: adapt through portable fallbacks

Press Alt+P to cycle Rich, Monochrome, No mouse, ASCII, SSH, tmux, Windows, Browser, and Narrow
profiles. Observe that border and block glyphs are rendered from the current profile, while a
keyboard action remains available in every state.

<PlayExample id="guides/portable-fallbacks"
  title="Portable fallback rendering laboratory"
  blurb="Inspect rendered evidence across SSH, tmux, Windows, browser, monochrome, no-mouse, ASCII, and narrow profiles while keyboard access and glyph fallbacks remain intact." />

Resize, maximize, and restore the window. The reduced surface reflows evidence instead of clipping
the command. This browser lab uses simulated profiles as bounded evidence; it is not proof of the
visitor's native terminal.

## How do SSH and multiplexers change the evidence?

Under SSH, the application runs on the remote server. It sees the remote process's `TERM`,
`COLORTERM`, and locale environment, not a trustworthy identity for the local terminal. SSH does
not identify the local emulator and cannot guarantee that every feature survives the network and
server path.

A live query travels through the actual path of the current remote session, so it can refine a
specific fact when that probe is supported. It still proves only the queried behavior, not a broad
terminal brand or universal support.

`tmux` and `screen` are multiplexers. A `TMUX` variable or matching `TERM` can set the multiplexer
flag to true and select conservative policy. That flag does not prove OSC passthrough, colour,
keyboard, or other feature support:

```ts
import { resolveCapabilities } from '@jsvision/core';

const insideTmux = resolveCapabilities({
  env: { TERM: 'tmux-256color', TMUX: '/tmp/session' },
  platform: 'linux',
});
```

When a distinction matters, probe through the SSH or tmux session's actual path, or let a
host-specific adapter supply an explicit fact.

## What is different on Windows and in a browser?

With no stronger evidence, `win32` uses a modern-console baseline: truecolor, Unicode, SGR mouse,
and alternate-screen support. Windows has a default reason for this rich baseline; it is platform
policy, not a runtime observation.

Browser hosts have different evidence ownership. `buildBrowserCaps()` creates a profile from
injected, known xterm-style host facts:

```ts
import { buildBrowserCaps } from '@jsvision/web';

const caps = buildBrowserCaps({
  colorDepth: 'truecolor',
});
```

`buildBrowserCaps()` injects the known xterm-style host facts for truecolor, UTF-8, and mouse
support; callers can lower only the advertised colour depth. The browser does not expose native
`process.env`, a TTY signal, or a native terminal query equivalent. Its host runtime owns and
supplies the capability profile. A documentation terminal or browser lab can simulate a fixture and
inspect rendered output, but that bounded evidence does not prove another browser, emulator, or
native session.

## How do colour, mouse, Unicode, and glyph fallbacks compose?

Treat these axes independently:

```ts
import { fallbackGlyph } from '@jsvision/core';

const border = fallbackGlyph('│', caps);
const fill = fallbackGlyph('█', caps);
const arrow = fallbackGlyph('►', caps);
```

`colorDepth` selects truecolor, 256, 16, or mono serialization; the renderer can downsample colours
without disabling interaction. `mouse.sgr` controls pointer reporting, but keyboard commands must
always remain as the fallback for required actions.

`unicode.utf8`, `unicode.widthMode`, and the emoji-width fact control encoding and cell-width
judgment. “Unknown” emoji width is evidence to avoid fragile wide glyphs or measure in a supported
host, not permission to guess.

`fallbackGlyph()` maps supported box, block, and fallback-prone chrome glyphs such as `►` to an
ASCII-safe alternative when the profile does not support them. It does not rewrite arbitrary
Unicode characters. For a fully conservative presentation, derive rather than mutate:

```ts
import { degradeCapsFully, fallbackGlyph } from '@jsvision/core';

const ascii = degradeCapsFully(caps);
const border = fallbackGlyph('│', ascii); // |
const block = fallbackGlyph('█', ascii); // #
const arrow = fallbackGlyph('►', ascii); // >
```

`degradeCapsFully()` disables box drawing and half blocks, uses ASCII-safe width behavior, and
marks ambiguous-width glyphs conservatively. It does not rewrite the original frozen profile.

For rendered frame evidence, apply the profile or fallback, then assert the final buffer or cells.
Verify that the profile-derived fallback glyph actually appears and that semantic labels remain
visible.

## How do I preserve behavior at reduced geometry?

Capability adaptation and layout adaptation meet at the viewport. At reduced or narrow geometry,
prioritize the task: keep the current state, required keyboard command, outcome, and recovery
instruction; reflow or wrap supporting evidence; move optional detail behind help or scrolling.
Never solve narrow layout by clipping the only action.

```ts
import { col, row } from '@jsvision/ui';

function contentFor(width: number) {
  return width < 40 ? col(status, primaryAction) : col(details, row(status, primaryAction));
}
```

The keyboard command must remain reachable and available with no mouse and in a narrow viewport.
Test resize, maximize, restore, and the smallest supported geometry with the same task assertions.

## How do I compose capabilities with hosts and rendering?

Resolve capabilities at the host boundary, then pass the selected profile into rendering,
serialization, input setup, and application policy. Do not let unrelated widgets re-read ambient
environment variables and disagree with the host.

```ts
import { ScreenBuffer, serialize } from '@jsvision/core';

const buffer = new ScreenBuffer(40, 4, style);
renderApplication(buffer, resolution.profile);
const output = serialize(buffer, previous, { caps: resolution.profile });
```

Theme authoring, palette selection, contrast, and semantic roles belong to
[Theming & colour depth](/guide/theming-and-colour-depth). Keyboard completeness, visible focus,
and non-color cues belong to [Accessibility & resilient interaction](/guide/accessibility).
Capability policy supplies facts to those systems; it does not replace their design work.

<!-- Course ownership routes: theme authoring ]/guide/theming-and-colour-depth) and keyboard
completeness ]/guide/accessibility). The visible links above are the learner-facing navigation. -->

## What belongs in advanced capability handling?

Advanced handling is justified when a fact materially changes behavior and the evidence can be
bounded:

- Add a live query only for a decision the environment and host cannot answer.
- Preserve passthrough before normal input decoding starts.
- Keep host adapters responsible for browser or embedded-terminal facts.
- Record the reason layer with a diagnostic, not just the resolved value.
- Re-evaluate only when the host session genuinely changes; avoid probing on every render.
- Validate compatibility and performance in each supported path rather than promoting a local
  observation into a guarantee.

An observed or measured result is scoped to its fixture, environment, host, and path. It is not a
universal guarantee. Publish the scope beside compatibility or benchmark evidence.

## How do I diagnose capability failures?

Start with the symptom, compare the resolved value and reason, then verify the actual host path:

| Symptom          | Likely cause                            | Correction                                      | Distinguishing evidence                |
| ---------------- | --------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| wrong colour     | forced env or stale host policy         | remove the force or supply the known host fact  | `colorDepth` and its reason            |
| missing mouse    | conservative default or no SGR path     | retain keyboard-only mode; probe only if useful | `mouse` group reason and input trace   |
| garbled glyph    | UTF-8 or width mismatch                 | use `fallbackGlyph()` or an ASCII profile       | rendered cells under the same profile  |
| clipping         | geometry policy, not terminal detection | reflow and preserve primary actions             | frame at the minimum supported size    |
| lost input       | query passthrough discarded             | decode passthrough first and in order           | captured input around startup          |
| raw mode remains | query or host cleanup omitted           | close or dispose in `finally`                   | listener and mode state after shutdown |

Use `dumpCaps(resolution)` to report normalized evidence. For security, redact raw environment
values, paths, query bytes, user text, and secrets from diagnostics. The safe `dumpCaps()` summary
does not authorize logging arbitrary surrounding data.

Similar symptoms can have different causes. Missing mouse events may be capability policy, a host
authorization boundary, or an input-decoder issue. A reason says where the profile fact came from;
an input trace says whether bytes arrived.

## What are the best practices?

- Resolve once at the host boundary. Otherwise widgets can make contradictory decisions from
  different evidence.
- Keep the profile and reasons together. A value without provenance is difficult to diagnose.
- Prefer conservative working modes over optimistic escape sequences. Unsupported output can
  corrupt the screen or consume input.
- Keep keyboard commands independent of mouse support. Pointer capability must never gate a
  required workflow.
- Derive a degraded profile instead of mutating one. Frozen evidence remains auditable and reusable.
- Query only when the answer changes a real decision. Every query adds timeout, input, and cleanup
  obligations.
- Preserve passthrough and close the transport. Otherwise detection can lose keystrokes or leak raw
  mode and listeners.
- Verify rendered output at reduced geometry and degraded profiles. Branch coverage alone does not
  prove usable cells.
- Scope every host, compatibility, and performance claim. A fixture or measured session is bounded
  evidence, not a universal promise.

## What should I practice next?

Try these exercises:

1. Resolve an unknown Linux fixture, a `NO_COLOR` fixture, and a `tmux` fixture. Explain every
   changed value from its reason.
2. Add a deterministic query response with one unrelated typed byte. Verify the runtime fact and
   passthrough order.
3. Render the same status surface with rich, no-mouse, and ASCII profiles. Assert glyph and command
   evidence in the final cells.
4. Compare Windows and browser profiles. Identify which facts are defaults and which are supplied
   by the host.
5. Resize a no-mouse workflow to its narrow limit and prove its primary keyboard action remains
   reachable.

Continue with [In production](/guide/in-production) for deployment policy and evidence practices.
Use the generated references for
[`resolveCapabilities()`](/api/core/functions/resolveCapabilities),
[`resolveCapabilitiesAsync()`](/api/core/functions/resolveCapabilitiesAsync), and
`buildBrowserCaps()` from the private `@jsvision/web` docs runtime when maintaining browser-host
integration; that package is intentionally outside the generated public API reference.
