# jsvision

An SDK for building **Turbo Vision-style terminal (TUI) applications** in TypeScript —
a retained widget framework with fine-grained reactivity, on top of a pure,
zero-dependency rendering engine.

> ## 🚧 Under heavy development
>
> jsvision is **pre-1.0 and under active development**. The public API may change
> between minor versions — pin an exact version if you depend on it, and expect
> rough edges. Not yet recommended for production use.

## 📖 Documentation

The full guide, live component gallery, and API reference live on the documentation
site: **<https://blendsdk.github.io/jsvision/>**

- [Guide](https://blendsdk.github.io/jsvision/guide/) — build your first app
- [Components](https://blendsdk.github.io/jsvision/components/) — the widget catalog, running live
- [API reference](https://blendsdk.github.io/jsvision/api/)

## Packages

| Package                             | What it is                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@jsvision/core`](packages/core)   | The rendering engine — capability detection, input decoding, damage-diff rendering, colour, native tty host, safety. Zero runtime dependencies. |
| [`@jsvision/ui`](packages/ui)       | The widget framework — reactive core, layout, views, event loop, app shell, and ~40 controls.                                                   |
| [`@jsvision/web`](packages/web)     | Run any jsvision app in a browser tab, inside an xterm.js terminal, with no backend.                                                            |
| [`@jsvision/files`](packages/files) | The classic file-system dialog family (open/save, directory chooser).                                                                           |

## Install

```bash
npm install @jsvision/core @jsvision/ui
```

ESM-only. Requires Node.js **≥ 22**. See the
[Guide](https://blendsdk.github.io/jsvision/guide/) to build your first app.

## Development

This is a yarn 1.x + Turborepo monorepo. From the repo root:

```bash
yarn install
yarn verify   # lint + typecheck + build + test across all packages
```

All public packages share one lockstep version. For the full workflow, see the
[development guide](https://blendsdk.github.io/jsvision/reference/guides/development).

## Versioning & stability

jsvision follows [Semantic Versioning](https://semver.org/). While it is pre-1.0 the
public API may change between **minor** versions — pin an exact version. From 1.0
onward, each package's entry point is the stable public surface and breaking changes
ship only in a **major** release; anything marked `@deprecated` is kept for at least
one minor before removal. Notable changes are recorded per package in `CHANGELOG.md`.

## License

[MIT](LICENSE)
