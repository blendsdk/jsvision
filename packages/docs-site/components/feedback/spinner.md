---
title: Spinner
description: Spinner — an indeterminate, caller-driven progress spinner with dots/line/blocks presets and an automatic ASCII fallback; advance it with runSpinner.
---

# Spinner

`Spinner` is an indeterminate progress spinner for unknown-duration work. It holds **no clock** — you
advance a caller-owned `frame` signal and it renders `frames[frame mod n]` (any integer frame is
valid; negatives and large values wrap safely). Three built-in presets: `dots` (braille `⠋⠙⠹…`, the
default, needs UTF-8), `line` (ASCII `| / - \`, safe everywhere), and `blocks` (eighth blocks, needs
UTF-8 + half-blocks). On a terminal that can't render the chosen preset, any non-`line` preset
automatically swaps to `line`, so animation is preserved rather than freezing on a glyph.

## Usage

```ts
import { Spinner, runSpinner, signal } from '@jsvision/ui';

const frame = signal(0);
const spinner = new Spinner({ frame, preset: 'dots', label: 'Loading…' });
spinner.setLayout({ position: 'absolute', rect: { x: 1, y: 0, width: 20, height: 1 } });

// Advance it on a timer; the returned stop() halts the animation.
const stop = runSpinner(frame, { timer: app.runtime, intervalMs: 80 });
// …later: stop();
```

## Live example

<PlayComingSoon title="Spinner" />

## Props

`new Spinner(options)`.

| Prop     | Type                           | Default  | Description                                                        |
| -------- | ------------------------------ | -------- | ------------------------------------------------------------------ |
| `frame`  | `Signal<number>`               | —        | Reactive frame index (caller-owned; reduced mod n, negative-safe). |
| `preset` | `'dots' \| 'line' \| 'blocks'` | `'dots'` | Named frame set; falls back to `'line'` on an ASCII terminal.      |
| `label`  | `string \| (() => string)`     | —        | Optional trailing label (literal or reactive getter).              |

### Driving it: `runSpinner`

`runSpinner(frame, { intervalMs?, timer })` advances the `frame` signal on a self-re-arming one-shot
timer over an injectable timer seam, and returns an idempotent, leak-free `stop()`. Supply `timer`
(e.g. an app's `runtime`); `intervalMs` defaults to a sensible cadence. You can also drive `frame`
yourself from any tick source.

## Behaviour

The spinner is passive — no keyboard or mouse. It repaints when `frame` (or a reactive `label`)
changes. The glyph draws at column 0 and the label at column 2 (a one-cell gap).

## Sizing & layout

Give it bounds; it draws on a single row. Reserve enough width for the glyph plus the label text.

## Best practices

- **Own the tick.** Reach for `runSpinner` for a timer-driven spin and always keep its `stop()` to
  halt cleanly; or advance `frame` from your own loop when you already have a tick.
- **`line` is the universal preset.** If a terminal can't render `dots`/`blocks` the spinner swaps to
  `line` automatically — but choose `line` explicitly when you want identical output everywhere.

## Theming

`Spinner` adds **no new theme role** — the glyph draws in `staticText` and the label in `label`.

## Related

- [Progress bar](/components/feedback/progress-bar) — the determinate counterpart, for known progress.
- [API reference](/api/ui/classes/Spinner) — the generated `Spinner` signature.
