---
title: Displaying untrusted text safely
description: Handle untrusted input and terminal injection with accurate sanitization and redaction boundaries for terminal output and logs.
---

# Displaying untrusted text safely

## Who is this course for?

This course is for developers who display text they did not author: pasted values, filenames,
network responses, child-process output, terminal responses, errors, and diagnostics. Complete
[Text, Unicode & terminal cells](/guide/text-unicode-and-cells) first so cell width and clipping are
familiar, and [Debugging](/guide/debugging) so bounded evidence and screen-safe logging already have
meaning.

By the end you can **build** a deliberate text-safety pipeline, **explain** where terminal
sanitization and diagnostic redaction differ, **diagnose** a misplaced boundary, and **verify** that
rendered cells and retained logs contain neither executable controls nor sensitive payloads.

The beginner boundary is safe display through ordinary JSVision widgets. The intermediate boundary
is explicit sanitization, bounding, multiline layout, and redacted diagnostics. Advanced work covers
raw host streams, destination-specific encoding, lifecycle ownership, and security review. The
motivating problem is a file browser whose remote filename contains a title-changing escape sequence
and whose error contains an access token: the filename must remain readable, the terminal must not
obey it, and the token must never reach a log.

## What is the untrusted-text mental model?

Treat safety as a data-flow decision owned at each sink:

```text
source -> validate and bound -> display boundary -> sanitized cells
                         \----> diagnostic boundary -> redacted metadata
```

A **source** supplies raw text. Validation decides whether that value is allowed in its business
domain. Bounding limits how much the application stores, renders, or logs. The display boundary
uses built-in drawing sanitization or explicit `sanitize()`. The diagnostic boundary removes
sensitive content through redaction or an allowlist before it reaches a sink.

These operations are not interchangeable:

| Operation | Question answered                                        | Does not prove                         |
| --------- | -------------------------------------------------------- | -------------------------------------- |
| Validate  | Is this URL, path, identifier, or action allowed?        | Terminal safety                        |
| Bound     | How much data may this owner retain or display?          | Validity or secrecy                    |
| Sanitize  | Can these characters act as terminal controls?           | Authorization or secret removal        |
| Redact    | Which content may a diagnostic retain?                   | Domain validity or terminal-cell width |
| Encode    | How is a value represented for one destination/protocol? | Safety for a different destination     |

Apply each transformation once at the boundary that owns it. Sanitizing every layer obscures which
sink is protected and makes failures difficult to diagnose; skipping the owning layer leaves a raw
path open.

## How do I get the first safe result?

Ordinary JSVision text reaches a sanitizing draw boundary. For an application-owned transformation,
call the public pure function before publication:

```ts
import { sanitize } from '@jsvision/core';
import { Text } from '@jsvision/ui';

const remoteName = 'report\x1b]0;owned\x07.txt';
const safeName = sanitize(remoteName);
const label = new Text(() => safeName);
```

`sanitize()` returns a new string with terminal-control bytes removed. The original remains
unchanged. Bound an untrusted value before retaining it when possible, then sanitize at display:

```ts
import { sanitize } from '@jsvision/core';

function boundedStatus(raw: string): string {
  const bounded = Array.from(raw).slice(0, 120).join('');
  return sanitize(bounded);
}
```

This produces a meaningful safe label, but it does not decide whether a filename is authorized or
whether its printable text contains a secret.

## Laboratory: inspect the text boundary

The laboratory keeps a small deterministic set of OSC, CSI, control-byte, multiline Unicode, and
sensitive-paste fixtures. It never replays raw hostile text. The unsafe side is escaped notation;
the safe side is the sanitized result. Use Alt+N to change samples, Alt+S to run the explicit display
boundary, and Alt+R to retain only redacted diagnostic structure. The buttons expose the same
actions to mouse users.

<PlayExample id="guides/untrusted-text-boundary"
  title="Untrusted text boundary laboratory"
  blurb="Compare unsafe escaped input, sanitized output, and redacted diagnostics; switch fixtures and verify that rendered controls and leaked payloads stay at zero." />

The labels `UNSAFE`, `SAFE`, `PASS`, control counts, and leak counts carry the meaning without
depending on colour. Resize, maximize, and restore the dialog to verify the one-cell inset and
instructions remain visible.

## Where does raw text enter an application?

An application has more raw-text sources than text fields:

| Source            | Example                                  | Boundary decision                                                      |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Paste             | User pastes a token or control sequence  | Bound input; never log content; sanitize when displayed                |
| Filename          | Remote or virtual filesystem entry       | Validate path separately; sanitize its label                           |
| Network           | API message, peer name, remote error     | Validate shape; bound; sanitize display; allowlist diagnostic fields   |
| Process           | Child stdout/stderr or exception message | Treat as untrusted; parse deliberately; never copy raw output to UI fd |
| Terminal response | Capability or cursor-position reply      | Parse exact bounded grammar; do not display or log raw bytes           |

Clipboard content, environment values, localization catalogs, database fields, and plugin data
deserve the same treatment. “Local” does not mean trusted: filenames and process output can be
controlled by another account, archive, repository, or remote server.

Map the owner before coding:

```ts
type TextBoundary = {
  readonly maximum: number;
  readonly display: (value: string) => string;
  readonly diagnostic: (value: string) => Readonly<Record<string, unknown>>;
};
```

Keep the raw value inside the narrowest owner. A display model receives sanitized, bounded content;
a diagnostic model receives structural metadata rather than the payload. Raw input or an event
payload must cross a distinct diagnostic boundary before it reaches a log.

## What does terminal injection look like?

Terminals interpret control bytes. `ESC` (`\x1b`) can begin CSI or OSC control sequences. `BEL`
(`\x07`) and String Terminator can end an OSC command; other C0 and C1 controls have terminal
semantics. An injected sequence may change a title, create a hyperlink, write a clipboard, switch
the alternate screen, move the cursor, or erase visible content.

For example, the bytes in this string attempt an OSC title change:

```ts
const hostile = 'report\x1b]0;owned\x07.txt';
```

After sanitization, the ESC and BEL controls are gone. The printable sequence tail, such as literal
bracket 31 m parameters or `]0;owned`, may remain visible and harmless. Sanitization neutralizes
the command; it does not consume every printable character that followed its introducer.

Inspect raw material only as inert escaped notation, code points, or byte names:

```ts
function byteName(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

const evidence = Array.from(hostile, (char) => byteName(char.codePointAt(0) ?? 0));
```

Never replay or write hostile raw bytes to the terminal or stdout just to demonstrate the attack.
Tests should compare strings, cells, or captured virtual streams.

## What does sanitize remove and preserve?

The exact public rule matters:

- It removes `ESC`, including the following backslash when they form `ESC \`.
- It removes `BEL`, other C0 controls except tab and newline, and all C1 controls.
- It preserves tab, newline, printable Unicode, emoji, and other astral characters.
- It is pure: `sanitize(text)` returns the safe string and neither mutates nor logs its input.

In one sentence: it removes ESC and BEL plus the documented C0 and C1 control classes, while it
preserves tab, newline, printable Unicode, and emoji.

```ts
import { sanitize } from '@jsvision/core';

sanitize('hi\x1b[31mred\x07'); // "hi[31mred"
sanitize('café\tfirst\n😀'); // tab, newline, and Unicode remain
```

The printable parameters are not removed: `[31m` remains literal text after the ESC introducer is
gone. That is expected, inert evidence rather than an active command.
In direct terms, `sanitize()` does not remove printable parameters or the sequence tail.

`sanitize()` does not validate or authorize a URL, shell argument, HTML fragment, SQL value, or
path. Use destination-specific validation, parameterized APIs, and path confinement for those
problems:

```ts
import { sanitize } from '@jsvision/core';

sanitize('../../private/report.txt'); // still a traversal-shaped string
sanitize("'; DROP TABLE users; --"); // still printable SQL-shaped text
```

It also does not redact or remove a secret, token, personal value, or other sensitive printable
content:

```ts
import { sanitize } from '@jsvision/core';

sanitize('token=visitor-secret'); // the token remains
```

Sanitization is separate from bounding and validation. Limit size before long-lived storage and
before expensive parsing; then apply the correct sink boundary.

## Which JSVision paths sanitize automatically?

`ScreenBuffer.text()` and `DrawContext` text paths such as `ctx.text()` automatically apply the
built-in terminal sanitizer. `Text`, `Label`, window titles, and normal widgets draw through those
buffer paths, so their rendered cells cannot retain ESC or BEL controls.

```ts
import { ScreenBuffer } from '@jsvision/core';

const style = { fg: 'default' as const, bg: 'default' as const };
const buffer = new ScreenBuffer(40, 1, style);
buffer.text(0, 0, 'file\x1b]0;owned\x07.txt', style);
```

The OSC helpers protect their text fields too:

```ts
import { hyperlink, notify, setTitle, type CapabilityProfile } from '@jsvision/core';

declare const caps: CapabilityProfile;
setTitle('build\x1b]0;owned\x07', caps);
notify('Build', 'remote\x1b]0;owned\x07', caps);
hyperlink('docs', 'https://example.invalid', caps);
```

Their sanitization prevents an embedded text field from breaking out into a second terminal
command. Capability checks still decide whether a helper emits a supported protocol.

Automatic drawing safety is defense at the terminal-cell boundary, not permission to retain an
unbounded or sensitive raw value elsewhere.

## When must I sanitize explicitly?

Any path that bypasses JSVision's drawing and OSC helpers owns an explicit obligation. Sanitize
before `output.write`, `process.stdout.write`, a custom host raw stream, or a third-party renderer
when the destination will interpret terminal controls:

For `output.write`, stdout, a custom host, or any raw stream, explicitly call `sanitize()` at that
sink.

```ts
import { sanitize } from '@jsvision/core';

function writePlainStatus(output: NodeJS.WritableStream, raw: string): void {
  output.write(sanitize(raw.slice(0, 120)));
}
```

Do not wrap framework widgets in redundant double sanitization. Keep one clear display boundary so
tests can prove which owner neutralized the controls.

Encoding rules can differ by protocol. `setClipboard()` is deliberately byte-exact: it does not
pre-sanitize the clipboard text and instead base64 encodes it, so arbitrary bytes cannot break out
of the OSC 52 frame while the clipboard receives the original content.
It does not sanitize before encoding and therefore preserves the original clipboard content.

```ts
import { resolveCapabilities, setClipboard } from '@jsvision/core';

const caps = resolveCapabilities().profile;
const sequence = setClipboard('line one\nline two', caps);
```

Do not generalize that exception to a raw stream. Base64 is safe for that protocol field; raw
terminal text is a different destination. Browser clipboard APIs similarly receive text through a
host authorization boundary rather than a terminal control frame.

## Why is redaction a different boundary?

Sanitization removes terminal controls. Redaction removes content that a diagnostic must not retain.
`redactEvent()` drops the character and code point from a printable key. For a paste, it retains
only the length and `truncated` flag, never the pasted text:

When `redactEvent()` receives a printable character, it removes that character and its code point
from the diagnostic shape.

```ts
import { redactEvent } from '@jsvision/core';

const safeEvent = redactEvent({
  type: 'paste',
  text: 'visitor-secret-token',
  truncated: false,
});
// { type: 'paste', length: 20, truncated: false }
```

Use a bounded, screen-safe logger, then pass only redacted or allowlisted fields:

```ts
import { createLogger, redactEvent } from '@jsvision/core';

const log = createLogger({ sink: 'ring', size: 50 });
log.debug('input', 'event', {
  event: redactEvent({
    type: 'key',
    key: 'x',
    codepoint: 120,
    ctrl: false,
    alt: false,
    shift: false,
  }),
});
```

`createLogger()` prevents ordinary logging from corrupting the screen and its ring can be bounded,
but it does not sanitize or redact arbitrary fields for you. A token passed through `sanitize()`
still remains a token and is not safe to log.

Put differently, `sanitize(tokenOrSecret)` can remove terminal controls while the secret still
remains intact and unsafe for diagnostics.

Prefer an allowlist such as stable error code, operation, count, duration, and generation
identifier. Redact each field before logging. Never log clipboard text, pasted content, printable
keystrokes, file content, authorization headers, or raw host errors.

## How do multiline text and terminal cells affect safety?

Tab and newline survive `sanitize()` because they can be meaningful text separators. A terminal
cell view still owns geometry: split multiline content into lines deliberately, expand or represent
tabs consistently, measure cell width, wrap to the available width, bound height, and clip overflow.
Sanitization alone is not a layout engine.

A common failure symptom is clipping rather than a visible control: safe multiline content still
needs explicit geometry, while a secret still needs redaction.

```ts
import { sanitize } from '@jsvision/core';

function safeLines(raw: string, maximumLines: number): readonly string[] {
  return sanitize(raw).split('\n').slice(0, maximumLines);
}
```

Printable Unicode, emoji, combining marks, and wide characters are preserved. Use the width and
wrapping tools taught in the prerequisite course; JavaScript string length is not terminal-cell
width.

For accessible evidence, label comparisons `UNSAFE`, `SAFE`, `PASS`, or `WARN`; never make colour
the only cue. Every safety action must be keyboard reachable through a focused button or documented
hotkey, with mouse parity where it helps exploration. Reduced geometry should keep the status and
instructions visible rather than silently clipping the only warning.

## How do I compose safety with widgets and hosts?

Keep responsibilities local:

- A widget accepts bounded semantic text and relies on its draw context for terminal sanitization.
- A feature validates domain rules and chooses what is safe to display.
- A diagnostic adapter receives allowlisted metadata, not the feature payload.
- A terminal host owns protocol encoding and raw writes.
- A browser or native adapter owns authorization for clipboard, files, and network capabilities.

```ts
import { sanitize } from '@jsvision/core';

type SafeNotice = { readonly code: string; readonly display: string };

function notice(code: string, remoteMessage: string): SafeNotice {
  const bounded = Array.from(remoteMessage).slice(0, 120).join('');
  return { code, display: sanitize(bounded) };
}
```

Subscriptions, timers, readers, and process streams must be acquired and released by the same
owner. Register their cleanup with `onCleanup`, dispose or unsubscribe exactly once, and reject
late callbacks before they can publish stale text:

```ts
import type { View } from '@jsvision/ui';

declare const panel: View;
declare const unsubscribe: () => void;

panel.onMount(() => {
  panel.onCleanup(unsubscribe);
});
```

Sanitize at publication even when the source was previously trusted; ownership can change and a
future adapter may supply different data. Do not keep multiple transformed copies longer than the
workflow needs.

## What belongs in advanced boundary design?

Threat-model each destination, not just each source. The same raw value may need domain validation
for a path, JSON encoding for a transport, base64 for OSC 52, sanitization for terminal display,
and redaction for a log. Record the allowed transformation and maximum size in the port contract.

For parsers, accept only complete bounded grammar. Terminal responses are untrusted input: cap
their bytes, reject malformed or unterminated replies, and log a stable result code rather than the
raw response. Child-process output needs a bounded decoder and cancellation/cleanup; do not mirror
its bytes directly to the UI output stream.

Use equality evidence for drawing: hostile input and its pre-sanitized equivalent should produce
identical rendered cells. Use absence evidence for diagnostics: the secret and raw event content
must not occur anywhere in retained records. Exercise both with Unicode and reduced geometry so a
security fix does not create unreadable or inaccessible output.

Security review should ask:

1. Where is the last raw value retained?
2. Which owner bounds it?
3. Which destination-specific validation or encoding applies?
4. Which display path neutralizes terminal controls?
5. Which diagnostic allowlist proves secrets are absent?
6. Which cleanup prevents late publication after disposal?

## How do I diagnose unsafe text handling?

Use a captured buffer, virtual stream, or bounded ring. Do not reproduce an injection against the
visitor's real terminal.

| Symptom or failure                        | Cause                                               | Correction or fix                                      | Distinguishing evidence                                 |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Title, cursor, or screen changes          | Raw control bytes reached a terminal stream         | Route through drawing or explicitly sanitize           | Captured raw stream contains ESC/OSC/CSI                |
| Literal `[31m` appears                    | ESC was removed but its printable tail remains      | Keep it, or apply domain-specific presentation cleanup | Cells contain printable text but no control bytes       |
| Secret appears in a safe-looking log      | Sanitization was mistaken for redaction             | Redact or allowlist before the logger                  | Token is printable and survives `sanitize()`            |
| Multiline content overlaps or clips       | Newline/tab geometry was not modeled                | Split, wrap, measure, bound height, then clip          | Sanitized string is safe but layout evidence is invalid |
| Valid Unicode disappears                  | An over-broad filter replaced the public sanitizer  | Use `sanitize()` and width-aware layout                | Emoji/combining/wide fixtures differ before cell layout |
| Text changes twice or loses separators    | Multiple layers sanitize or normalize independently | Assign one display owner and test it                   | Boundary trace shows duplicate transformations          |
| Late unsafe text appears after navigation | Subscription, timer, or stream outlived its owner   | Cleanup and guard publication                          | Post-disposal callback changes state or frame           |

Similar symptoms need different evidence. Literal printable parameters are inert; actual ESC bytes
are injection. A clean frame does not prove a clean log, and a redacted log does not prove a raw
stream is safe.

## What are the best practices?

- Treat every external or cross-process string as untrusted, because provenance can change without
  changing its TypeScript type.
- Bound before retaining or parsing large values; otherwise sanitization can still leave a memory
  or rendering denial of service.
- Rely on built-in JSVision drawing sanitization for widgets; otherwise duplicate transformations
  make the owning boundary ambiguous.
- Call `sanitize()` immediately before a raw terminal sink; otherwise an unreviewed stream can
  execute attacker-controlled terminal commands.
- Validate URLs, paths, shell arguments, and queries with destination-specific rules; terminal
  sanitization cannot authorize them.
- Redact or allowlist before logging; otherwise printable secrets remain in memory, files, or the
  diagnostic ring.
- Never log raw paste, clipboard, keystroke, file, network, process, or terminal-response content.
- Display hostile fixtures only as escaped notation; replaying them makes the teaching tool the
  vulnerability.
- Preserve Unicode and use explicit multiline/cell geometry; replacing all non-ASCII text harms
  users without improving the documented control-byte boundary.
- Pair subscriptions, timers, streams, and adapters with owner cleanup; otherwise stale work can
  republish unsafe data after the screen changes.

## What should I practice next?

Run these as bounded experiments:

1. Put ESC, BEL, C0, and C1 controls inside a filename; compare its escaped notation, sanitized
   string, and exact buffer cells.
2. Mix multiline text, a tab, Unicode, emoji, a combining mark, and a wide glyph; sanitize, split,
   wrap, and verify the reduced viewport.
3. Pass a printable token through `sanitize()` and prove it remains; then replace the payload with
   an allowlisted diagnostic code.
4. Feed printable key and paste events to `redactEvent()` and assert no character or text survives.
5. Compare hostile and pre-sanitized input through `ScreenBuffer` and require identical cells.
6. Retain a virtual stream callback, dispose its owner, and verify no later frame or log mutation.

Continue with [Crash safety & terminal restore](/guide/crash-safety) for process ownership and
[In production](/guide/in-production) for deployment and operational boundaries. Use
[Accessibility & resilient interaction](/guide/accessibility) for non-color safety cues and
[Terminal capabilities & portability](/guide/terminal-capabilities) for honest host degradation.

Public API:

- [`sanitize()`](/api/core/functions/sanitize)
- [`redactEvent()`](/api/core/functions/redactEvent)
- [`createLogger()`](/api/core/functions/createLogger)
- [`ScreenBuffer`](/api/core/classes/ScreenBuffer)
- [`setTitle()`](/api/core/functions/setTitle)
- [`notify()`](/api/core/functions/notify)
- [`hyperlink()`](/api/core/functions/hyperlink)
- [`setClipboard()`](/api/core/functions/setClipboard)
