---
title: Surface
description: Surface — a reactive offscreen cell buffer with safe drawing, preserving resize, snapshots, and a DrawContext facade.
---

# Surface

`Surface` is an offscreen cell buffer for canvases, diagrams, and other content that should be drawn
once and projected through a [`SurfaceView`](/components/surface/surface-view). Every mutation is
sanitized and versioned, so mounted views repaint without rebuilding the content.

## Usage

```ts
import { Surface } from '@jsvision/ui';

const surface = new Surface({ size: { x: 80, y: 24 } });
surface.getDrawContext().text(2, 1, 'Safe offscreen text', { fg: 'cyan', bg: 'default' });
surface.resize({ x: 100, y: 30 }); // overlapping cells survive
```

## Live example

<PlayExample id="surface/surface"
  title="Surface Lab"
  blurb="Draw into an offscreen cell buffer, preserve content while resizing, and inspect safe mutation paths."
/>

## Props and public state

`new Surface(options: SurfaceOptions)` exposes `size`, the `ScreenBuffer` escape hatch `buffer`,
`getDrawContext(): DrawContext`, safe cell reads/writes, resize helpers, and snapshots.

| Option  | Type                        | Default       | Description                                    |
| ------- | --------------------------- | ------------- | ---------------------------------------------- |
| `size`  | `Point`                     | —             | Initial width/height, clamped to at least 1×1. |
| `theme` | `Theme`                     | built in      | Theme used by the drawing facade.              |
| `caps`  | `CapabilityProfile`         | conservative  | Glyph/capability policy for drawing.           |
| `fill`  | `Style & { char?: string }` | default space | Initial and newly exposed cells.               |

## Cell storage and mutation

Use `getDrawContext()` for text, boxes, fills, and shadows. `set()` writes one sanitized glyph;
`at()` returns a frozen cell copy or `undefined` out of bounds. Direct `buffer` writes are an escape
hatch and require `invalidate()` so observers repaint.

## Resize and snapshots

`resize()` preserves the overlapping region and blanks newly exposed cells; `grow()` applies a
relative size change. `snapshot()` returns an independent buffer clone, while `Surface.from(rows)`
creates a correctly measured surface from text.

## Sizing and layout

A Surface has storage size, not layout bounds. Its `size` determines allocation; a SurfaceView
chooses which rectangle becomes visible. Large surfaces therefore cost memory but not additional
terminal layout space.

## Best practices

- Draw through the facade so sanitization and invalidation happen together.
- Resize instead of rebuilding when existing content should survive.
- Keep raw buffer access isolated and call `invalidate()` after mutations.

## Theming

Cells retain their explicit styles; a hosting SurfaceView fills uncovered areas with
`windowInactive`.

## Related

- [Surface view](/components/surface/surface-view) — projects a viewport onto the buffer.
- [API reference](/api/ui/classes/Surface) — generated signatures.
