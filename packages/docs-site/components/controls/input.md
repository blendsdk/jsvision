---
title: Input
description: Text fields with live validators — a live, in-browser JSVision example.
---

# Input

Text fields with live validators and two-way binding: a **name** field that accepts only letters
and spaces, an **age** field clamped to 0–150, and a **phone** field whose dashes auto-fill from a
picture mask. Tab moves between fields and the echo below tracks the bound values.

<PlayExample id="controls/input" title="Input" blurb="Text fields with live validators: a letters-only filter, a 0–150 range, and a picture mask." />

## Source

The composition running above — the exact `build()` from the module:

<<< @/examples/controls/input.ts#example{ts}

::: details Full module (imports, JSDoc, data)

<<< @/examples/controls/input.ts

:::
