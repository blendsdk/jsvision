# Runtime Component: GroupBox

> **Document**: 03-01-runtime-component.md
> **Parent**: [Index](00-index.md)

## Overview

The runtime component is one passive `Group` subclass. It owns initial configuration, painting, and
the re-establishment of its title subscription on each mount. Child lifecycle, layout participation,
focus traversal, scope disposal, and shadow composition remain in existing framework code (AR #3).

## Architecture

### Public Surface

```ts
export type GroupBoxTitleAlignment = 'start' | 'center' | 'end';

export interface GroupBoxOptions {
  readonly title?: string | (() => string);
  readonly titleAlignment?: GroupBoxTitleAlignment;
  readonly padding?: number | Padding;
  readonly role?: ThemeRoleName;
  readonly shadow?: boolean;
}

export class GroupBox extends Group {
  constructor(options?: GroupBoxOptions);
  override mount(host: ViewHost | null, parentScope: Owner | null): void;
  override draw(ctx: DrawContext): void;
}
```

The class and every exported type and option receive exhaustive JSDoc and a public-package example
as required by FR-13.

### Stored Configuration

Store the title source, alignment, and role as private readonly fields. Initialize them from the
FR-2 defaults. Set `castsShadow` from `shadow ?? false`, and merge the configured padding into the
inherited layout with `setLayout()` (AR #3).

For a getter title, override `mount()`, call `super.mount()` first, and then call `bind(title)`. Each
mount creates a fresh inherited view scope, so this one local override re-establishes the subscription
after remove/re-add while inherited unmount disposal remains authoritative. Do not change global
`View` or add a second reactive abstraction. `draw()` resolves the current title each frame.

## Painting Algorithm

1. Resolve `style = ctx.color(role)` on every draw.
2. Fill all `ctx.size` cells with a blank in that style. This applies even when no drawable frame
   exists.
3. Return after the fill when width or height is below two.
4. Call `ctx.box(0, 0, width, height, style)` without a title. This owns glyphs, clipping, and
   capability fallback.
5. Resolve the current title, pass it through the existing core `sanitize()`, and replace retained
   tab/newline characters with ordinary spaces. If that canonical display title is empty, leave the
   frame unchanged.
6. Let `interior = width - 2`. If the full canonical title plus two blank cells fits, decorate it as
   ` ${title} `; otherwise clip the title itself to `interior` (AR #4, AR #5).
7. Measure the selected caption by terminal cells. Place it at interior start, centered with integer
   floor, or interior end. Draw through `ctx.text()` at row zero.

The algorithm does not use JavaScript string length for width or placement. Prefix clipping never
splits a wide glyph; combining marks remain attached according to the existing helper semantics.

## Layout and Container Semantics

The configured padding is the initial content-box inset. No border-specific child positioning is
implemented: the existing layout engine offsets both flow and absolute children from the padded
content box. Later `setLayout()` calls can change padding, direction, gap, size, alignment,
justification, or position normally.

Apart from the title-only `mount()` subscription described above, the class must not override
`focusable`, `grabsFocus`, event handlers, accelerator behavior, unmount, add/remove, dynamic-child
behavior, or focus-scope flags. Inherited passive defaults and `Group` behavior are the contract.

## Integration Points

- Export the class and types from `packages/ui/src/group-box/index.ts`.
- Re-export them from `packages/ui/src/index.ts` in the containers section.
- Import `Group` and view types from the local `view` barrel, `Padding` from the layout barrel, and
  internal width helpers from the existing control measurement module.
- Do not export `clipCellText` or add a public `DrawContext` overload (AR #3).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Empty/omitted title | Draw uninterrupted frame | AR #2 |
| Caption wider than interior | Preserve fitting leading glyphs; no ellipsis | AR #4 |
| Decoration does not fit | Omit both blanks and spend cells on caption | AR #5 |
| Width/height below two | Opaque fill only; no frame or caption | AR #5 |
| Ancestor or viewport clipping | Rely on clipped `DrawContext` writers | AR #3 |
| Unsafe/control or multi-line title | Sanitize once, normalize tab/newline to spaces, then use that same display value for geometry and drawing | AR #3 |
| Shadow lacks surrounding space | Permit normal overlap/clipping; do not alter layout | AR #2 |

## Testing Requirements

Cover ST-1 through ST-18, ST-25 through ST-27, and ST-31 through ST-33 from
`07-testing-strategy.md`. Prefer exact buffer cells and real render roots over mocks.
