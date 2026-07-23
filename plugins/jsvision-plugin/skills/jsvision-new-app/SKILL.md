---
name: jsvision-new-app
description: Scaffold a standalone JSVision TypeScript application using published npm packages. Use when creating a new JSVision app or starter project, including form, grid, and dashboard starters.
---

# Scaffold a standalone JSVision app

1. Detect the package manager from `packageManager` and lockfiles. Ask when detection is ambiguous;
   use npm when no preference is available.
2. Default to a new subdirectory. Obtain explicit confirmation before passing `--current-dir`.
3. Resolve this skill directory and run:

   ```bash
   node <skill-directory>/new-jsvision-app.mjs <name> --package-manager <manager>
   ```

   Add `--template form|grid|dashboard` when it matches the request. Use `--list` to inspect choices.

4. The generator refuses path traversal, conflicting files, and non-empty current directories.
5. It installs dependencies automatically. Report created files and verification results.
