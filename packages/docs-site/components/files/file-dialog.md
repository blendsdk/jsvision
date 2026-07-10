---
title: File dialog
description: Browse a virtual file tree in a modal dialog — a live, backend-free JSVision example.
---

# File dialog

Browse a virtual file tree in a modal dialog — no backend, entirely in-memory. Move with the
**arrows**, **Enter** a directory to descend, and pick a file or **Cancel**. The tree is seeded into
`@jsvision/web`'s pure browser file system, so the whole dialog runs with no server.

<PlayExample id="files/file-dialog" title="File dialog" blurb="Browse a virtual file tree in a modal dialog — no backend, entirely in-memory." />

## Source

The composition running above — the exact `build()` from the module:

<<< @/examples/files/file-dialog.ts#example{ts}

::: details Full module (imports, JSDoc, data)

<<< @/examples/files/file-dialog.ts

:::
