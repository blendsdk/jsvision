---
title: Form dialog
description: A modal form dialog with a valid() close-gate — a live, in-browser JSVision example.
---

# Form dialog

A modal form dialog hosting an **age** input (0–120), a **checkbox group**, and a **radio group**,
with OK / Cancel. **OK is vetoed** while the age is out of range — the `valid()` gate refuses to
close and returns focus to the offending field; Cancel, Esc, or **[×]** always close.

<PlayExample id="controls/form-dialog" title="Form dialog" blurb="A modal form — input + checks + radios with OK/Cancel; OK is vetoed while Age is out of range." />

## Source

The composition running above — the exact `build()` from the module:

<<< @/examples/controls/form-dialog.ts#example{ts}

::: details Full module (imports, JSDoc, data)

<<< @/examples/controls/form-dialog.ts

:::
