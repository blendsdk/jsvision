---
title: Hello, JSVision
description: The smallest complete JSVision application — the standard shell and a modal welcome dialog, running live in the browser.
---

# Hello, JSVision

The smallest complete application you can build: the standard shell — a menu bar, a status line, and
a patterned desktop — greeting you with a modal welcome dialog. Everything here comes from
`createApplication` and the stock widgets; no custom drawing is involved.

Press **Enter** (or click **OK**) to dismiss the dialog and see the bare shell. The dialog is modal
while it is up — it owns the keyboard, exactly as a classic modal should — so **F10** for the menu
and **Alt+X** to exit apply once it has closed.

<PlayExample id="apps/hello" title="Hello, JSVision" blurb="The standard application shell — menu bar, status line, desktop — and a modal welcome dialog." />
