# @jsvision/theme-designer

A standalone, "pro" terminal application for authoring [`@jsvision/core`](../core) themes — built from
the very widgets it themes (it dogfoods [`@jsvision/ui`](../ui) and [`@jsvision/files`](../files)).

- Edit a theme's 16 semantic **aliases** (which regenerate all control roles) or override individual
  **roles** directly.
- A curated widget gallery repaints live on every edit.
- A color inspector: per-channel **R/G/B sliders**, a `#rrggbb` **hex** field, and the DOS-16 **swatch** grid.
- **WCAG contrast** scoring and a **color-depth** preview strip as you go.
- The 7 built-in presets seed a starting point; themes **import/export** to JSON via a real file dialog.

Private until [`@jsvision/ui`](../ui) has its first public release.

## Run

```bash
# live, interactive designer on a real terminal
yarn workspace @jsvision/theme-designer start

# piped / headless — a narrated walkthrough that renders composed frames
yarn workspace @jsvision/theme-designer start | cat
```
