---
name: jsvision-doctor
description: Lint a jsvision app for the documented footguns (missing measure(), bind-in-constructor, content laid out with absolute rects, missing .js imports, modal close(), focusing a list container instead of its rows). Run it after composing or editing a jsvision app, before calling the app done.
argument-hint: '[path-to-app-or-src]'
allowed-tools: 'Bash Read Edit'
---

# Check a jsvision app for footguns

Run the static linter over a jsvision app and fix what it finds. It parses the app's TypeScript and
reports the common mistakes from `gotchas.md` — the ones that make an app paint nothing, leak, or
hang — each mapped to its gotcha and fix. **Run this before you call any jsvision app done.**

## What to do

1. Run the linter over the app source (a file, a `src/` dir, or a package dir). Defaults to the
   current directory:

   ```bash
   node scripts/jsvision-doctor.mjs "$ARGUMENTS"
   ```

2. Read the findings. Each line is `file:line [rule] message (gotcha N)`, at one of three levels:
   - **✗ error** — will break at runtime or typecheck (e.g. a relative import missing its `.js`).
     Fix every error.
   - **⚠ warn** — a likely bug worth fixing (bind in a constructor, a custom `View` with no
     `measure()`, content positioned with an absolute rect instead of the `col`/`row`/`stack` DSL,
     focusing a list/grid container instead of its `.rows`).
   - **ℹ info** — a context-dependent smell to eyeball (a `.close()` that might be on a modal, a
     signal write in a timer with no `flush`).

3. Fix each finding against the cited gotcha (open `references/gotchas.md` in the `jsvision` skill for
   the full symptom → cause → fix). Re-run until the errors and warnings you intend to fix are gone.

## Notes

- The linter is heuristic and advisory — it reads the syntax tree, not full types. A warning can be a
  false positive (e.g. an invisible full-screen overlay `View` genuinely needs no `measure()` because
  it is absolutely placed). Use judgment; the point is to surface the likely footguns fast.
- A window's or dialog's **own** placement rect (`win.setLayout({ rect })`) is _not_ flagged — that is the
  sanctioned absolute case. Only content positioned with absolute rects is.
- It runs in this monorepo (the supported target) via the repo script; no build or type-check needed.
