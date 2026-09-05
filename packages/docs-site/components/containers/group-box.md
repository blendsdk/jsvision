---
title: GroupBox
description: GroupBox — a passive JSVision container with an opaque themed frame, display-cell-aware caption alignment, reactive titles, padding, nesting, and optional shadow.
---

# GroupBox

`GroupBox` is a [`Group`](/components/foundations/group) with a visible frame and optional caption.
Use it to explain that nearby controls belong to one section without adding another interactive
stop. It owns children, layout, mounting, and disposal exactly like `Group`, but paints an opaque
themed surface before those children and never receives focus or handles input itself.

Captions can be fixed strings or reactive getters. They align at the start, center, or end of the
top border and clip by terminal display cells, so wide and combining characters do not split the
frame. A GroupBox can contain controls, layout groups, or another GroupBox.

## Usage

```ts
import { GroupBox, Text, at } from '@jsvision/ui';

const details = new GroupBox({ title: 'Application', padding: 1 });
details.add(at(new Text('Name: Customer Portal'), 0, 0, 24, 1));
details.add(at(new Text('Status: Active'), 0, 1, 24, 1));
```

The parent still assigns `details` its outer bounds. Child coordinates are relative to the padded
content area inside the frame.

## Live example

<PlayExample id="containers/group-box"
  title="GroupBox alignment and nesting laboratory"
  blurb="Compare start, center, and end captions in nested passive groups. Click or Tab to the real button, then use Alt+A or Space to update the center caption while the frame remains outside the focus order."
/>

## Props and public state

`new GroupBox(options)` accepts `GroupBoxOptions`; every option is optional.

| Option           | Type                       | Default        | Purpose                                                                                 |
| ---------------- | -------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `title`          | `string \| (() => string)` | `''`           | Fixed caption or reactive getter.                                                       |
| `titleAlignment` | `GroupBoxTitleAlignment`   | `'start'`      | Places the caption at `'start'`, `'center'`, or `'end'` inside the top-border interior. |
| `padding`        | `number \| Padding`        | `1`            | Initial content inset. A number applies to every side; an object sets individual sides. |
| `role`           | `ThemeRoleName`            | `'staticText'` | Colors the border, caption, and opaque interior as one surface.                         |
| `shadow`         | `boolean`                  | `false`        | Requests the renderer's standard drop shadow.                                           |

The constructor writes `padding` into normal layout state. A later `setLayout({ padding: ... })`
call is authoritative, just as it is for any `Group`.

## Sizing & layout

`GroupBox` adds no component-specific measurement rule. It inherits `Group` measurement, so ordinary
flow children, gaps, and padding can provide a natural auto size. Absolute and fill-positioned
children do not contribute a natural size; use explicit or flex sizing for those cases, or whenever
the frame should be larger than its content. At least 2×2 cells are needed to draw a complete frame.
Smaller bounds still receive the opaque fill but cannot show the box border. The top-border interior
is two cells narrower than the outer width, and children use the remaining padded content area.

For responsive rows, let the existing layout engine divide the available cells:

```ts
import { GroupBox, grow, row } from '@jsvision/ui';

const primary = new GroupBox({ title: 'Primary' });
const secondary = new GroupBox({ title: 'Secondary' });
const sections = row({ gap: 2 }, grow(primary, 2, { min: 18 }), grow(secondary, 1, { min: 12 }));
```

Use `at` when exact placement is part of the screen design:

```ts
import { Group, GroupBox, at } from '@jsvision/ui';

const screen = new Group();
const filters = new GroupBox({ title: 'Filters', padding: { top: 1, right: 2, bottom: 1, left: 2 } });
screen.add(at(filters, 2, 1, 36, 8));
```

An enabled shadow is composited outside the GroupBox bounds: reserve two columns on the right and
one row below it in the parent. Ancestor clipping is final, so a box placed against its parent's
edge loses the part of the shadow that falls outside. See the [Layout guide](/guide/layout) for
flow sizing and exact placement.

## Caption behavior

The caption occupies the top-border interior. `start`, `center`, and `end` change its horizontal
placement; they do not change clipping. When the complete title plus one blank on each side fits,
both blanks separate it from the border. Otherwise the available cells show the leading title
prefix without an ellipsis or half of a wide glyph.

Caption text passes through JSVision's normal terminal-text sanitizer. Tabs and line breaks become
spaces because a frame caption is always one line. Accelerator markers such as `~A~` have no special
meaning here: a GroupBox caption is a label, not an action.

### Reactive captions

A getter is tracked in the GroupBox lifecycle scope. Reading a signal inside it repaints the
caption when that signal changes, including after the same GroupBox is removed and mounted again.

```ts
import { GroupBox, signal } from '@jsvision/ui';

const selectedCount = signal(2);
const selection = new GroupBox({
  title: () => `Selected: ${selectedCount()}`,
  titleAlignment: 'center',
});
```

Keep the getter pure. Side effects inside rendering make updates order-dependent and are harder to
dispose safely.

## Passivity and focus

`GroupBox` is deliberately passive. It does not become focused, turn caption text into a hotkey, or
consume keyboard, mouse, or command events. Focus traversal enters eligible descendants in their
ordinary child order and then continues to the next focusable sibling. Put actions on `Button`,
`Input`, or another interactive child and mark hotkeys on that control.

This boundary makes a GroupBox suitable for visual organization but not for selection, disclosure,
or page switching. Use [Tabs](/components/containers/tabs) when the heading must choose visible
content, or a button when the heading itself must perform an action.

## Composition and nesting

Nested GroupBoxes need no special API. Each box applies its own frame and padding, then its normal
`Group` layout solves its children. Budget the outer box's padding before assigning the inner box,
and avoid stacking borders so tightly that captions become hard to scan.

Choose a GroupBox when a persistent border improves comprehension. Use a plain `Group` when layout
and lifecycle ownership are enough, because an extra frame adds visual weight and consumes terminal
cells. Use a `Dialog` or `Window` only when the region also needs independent window behavior.

## Best practices

- Use short, stable captions. Long translated titles clip, so essential distinctions should appear
  near the beginning.
- Put actions on descendants. Treating caption text as an implied control creates an unreachable
  mouse and keyboard affordance.
- Keep the default one-cell padding unless the design has measured space for another inset. Zero
  padding lets child painting touch or overwrite the frame.
- Reserve external shadow space. The shadow does not enlarge layout bounds and will otherwise be
  clipped or overlap a sibling.
- Prefer a plain `Group` for structure that does not need a visible boundary. Repeated nested frames
  reduce usable space and make a terminal screen noisy.

## Theming

The selected `role` applies one style to all cells owned by the GroupBox, including its border,
caption, and opaque interior. Descendants still paint with their own roles.

| Role                         | Region or state                                          |
| ---------------------------- | -------------------------------------------------------- |
| `staticText`                 | Default GroupBox frame, caption, and fill.               |
| Any supplied `ThemeRoleName` | Replacement style for the complete GroupBox surface.     |
| `shadow`                     | Standard renderer-composited shadow when `shadow: true`. |

Custom themes must keep the frame and caption legible against the chosen surface. A non-default
role should work for all three regions; GroupBox does not provide separate border and caption roles
or a fallback contrast adjustment.

## Related

- [Group](/components/foundations/group) — the child ownership, layout, and lifecycle base.
- [Dialog](/components/containers/dialog) — framed task surface with window and modal behavior.
- [Tabs](/components/containers/tabs) — interactive switching between labeled pages.
- [Window](/components/application/window) — movable, resizable desktop surface.
- [GroupBox API](/api/ui/classes/GroupBox) — generated `GroupBox`, `GroupBoxOptions`, and
  `GroupBoxTitleAlignment` signatures.
