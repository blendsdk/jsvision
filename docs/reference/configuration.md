# Kanban configuration reference

> **Last Updated**: 2026-08-03
> **Status**: Design-level defaults; implementation pending

The final TypeScript names and signatures will be fixed during specification-first planning. The
values below are accepted compatibility targets and must not be silently replaced by implementation
guesses.

## Presentation defaults

| Setting                            | Default                                             | Notes                                                       |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Density                            | `comfortable`                                       | Compact, comfortable, spacious, and bounded custom policies |
| Card heights                       | 6 / 12 / 18 rows                                    | Compact / comfortable / spacious; custom ceiling 32         |
| Responsive column widths           | 18 / 24 / 32 cells                                  | Narrow / preferred / wide measured targets                  |
| Overscan                           | 1 viewport vertically; 1 column per horizontal side | Applied to bounded window acquisition                       |
| Search debounce                    | 150 ms                                              | Cancellable when query changes or board disposes            |
| Drag threshold                     | 1 terminal cell                                     | Prevents incidental pointer motion from starting a drag     |
| Drag hysteresis                    | 1 terminal cell                                     | Stabilizes insertion target changes                         |
| Collapsed swimlane hover expansion | 500 ms                                              | Temporary drag affordance, not durable state                |

## Autoscroll defaults

Autoscroll ticks every 50 ms. The outermost edge cell scrolls two cells per tick; the next two edge
cells scroll one cell per tick. All four viewport edges participate when the corresponding axis can
scroll.

## Safety limits

| Resource                             | Default ceiling |
| ------------------------------------ | --------------: |
| Identifier length                    | 256 UTF-8 bytes |
| Placement or undo token              |           2 KiB |
| Saved-view JSON                      |         256 KiB |
| Saved-view nesting depth             |              16 |
| Saved-view array entries             |           4,096 |
| Saved-view object keys               |             256 |
| Saved-view string length             |          16 KiB |
| Card fields                          |              64 |
| Summary sections                     |              16 |
| Checklist groups                     |              32 |
| Checklist items per group            |           1,024 |
| In-memory selected IDs               |          10,000 |
| Concurrent cell loads                |               8 |
| Concurrent async validators per form |               4 |
| Pending operations                   |              32 |
| Retained deduplication IDs           |           1,024 |
| Retained observations                |             256 |

Applications may lower limits. Raising a safety ceiling requires explicit documented support and
verification; it must not disable sanitization, cancellation, or lifecycle bounds.

## Default keymap

| Keys                 | Action                                                             |
| -------------------- | ------------------------------------------------------------------ |
| Arrow keys           | Spatial navigation                                                 |
| Home / End           | First or last card in the current context                          |
| Page Up / Page Down  | Viewport-relative navigation                                       |
| Ctrl+Home / Ctrl+End | Logical board start or end when known                              |
| Enter                | Open card or confirm a keyboard drop                               |
| Space                | Toggle selection                                                   |
| Shift+navigation     | Extend selection range                                             |
| Ctrl+A               | Select loaded, visible, matching cards within the configured bound |
| Ctrl+F               | Focus search                                                       |
| Insert               | Request card creation                                              |
| Alt+M                | Start keyboard grab/move mode                                      |
| Escape               | Cancel active interaction or clear transient state                 |
| Shift+F10            | Open context menu                                                  |
| F1                   | Open help                                                          |
| Ctrl+Z / Ctrl+Y      | Request undo / redo                                                |

Destructive and board-configuration commands are exported but unbound by default.
