---
name: jsvision-doctor
description: Diagnose JSVision TypeScript applications for rendering, layout, lifecycle, focus, modal, and NodeNext footguns. Use after editing a JSVision application or when debugging missing, stale, or unresponsive UI.
---

# Diagnose a JSVision app

Resolve this skill directory, then run the bundled doctor against a file, source directory, or
project directory:

```bash
node <skill-directory>/jsvision-doctor.mjs [path]
```

The doctor resolves TypeScript from the consumer project. If unavailable, ask before installing it
as a development dependency with the detected package manager. Fix errors, review warnings and
informational findings, then rerun until the result is understood.
