---
name: jsvision-render
description: Render a JSVision application or view as a deterministic headless text screenshot. Use to inspect layout, clipping, focus, and interaction states after building or changing a JSVision screen.
---

# Render a JSVision screen

Require an exported `buildApp`, `build`, or default factory. When none exists, add or propose a small
adapter export instead of executing arbitrary startup code.

Resolve this skill directory and run the bundled renderer through the consumer project's `tsx`:

Use the command form for the consumer project's package manager. The `--` after `npm exec` keeps
renderer flags out of npm's own argument parser:

```bash
npm exec -- tsx <skill-directory>/render-app.mjs <module> [--export name] [--pick property] [--size 80x24] [--keys "tab enter"]
yarn exec tsx <skill-directory>/render-app.mjs <module> [--export name] [--pick property] [--size 80x24] [--keys "tab enter"]
pnpm exec tsx <skill-directory>/render-app.mjs <module> [--export name] [--pick property] [--size 80x24] [--keys "tab enter"]
bunx tsx <skill-directory>/render-app.mjs <module> [--export name] [--pick property] [--size 80x24] [--keys "tab enter"]
```

Render normal and constrained sizes. Use `--keys` for important interaction states. The renderer
resolves JSVision from the consumer project and never connects to a real terminal.
