# RD-07: Sample Applications

> **Document**: RD-07-sample-apps.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-02 (`@jsvision/web`), RD-03 (DemoShell + live system)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

---

## Feature Overview

Four **polished, real, runnable-in-the-browser** sample applications that prove JSVision builds
actual apps, not just widgets — each demonstrating a different dimension: **Todo** (state &
reactivity), **tvedit** (a text editor: editing, files, clipboard), the **polished Kitchen-Sink**
(breadth — every component, and it doubles as the docs' live component navigator), and a **File/Data
Browser** (the two most "app-like" surfaces: file dialogs + a data grid over the virtual FS). Every
app runs inside the shared **DemoShell** with a representative **About** dialog and a **Theme
switcher** (all 13 presets, Turbo Vision default), and each is a live demo on the site.

The current kitchen-sink is explicitly called out as not top-notch; this RD **enhances it in both UX
and DX** and makes it the reference showcase.

---

## Functional Requirements

### Must Have

- [ ] **Shared DemoShell usage** — all four apps compose the RD-03 DemoShell: a menu bar with an
      **About** dialog (app name, version, links, a line of credits) and a **View → Theme** submenu
      over the 13 presets (default Turbo Vision), plus a status line. Theme changes repaint live.
- [ ] **Todo app** — add / edit / toggle-complete / delete / filter (all/active/done) todos, backed by
      reactive signals; keyboard-first with mouse support; persists within the session (in-memory);
      empty-state ("no todos yet") handled. A live demo on the site + a documented walkthrough.
- [ ] **tvedit** — a text editor built on the `@jsvision/ui` editor: open/save via the browser
      **virtual FileSystem** (RD-02) with a File System Access bridge (open/save real local files by
      picker; download/upload fallback), a working file dialog, modern clipboard (Ctrl+X/C/V/A), a menu
      + status line; opening a seeded file, editing, and saving all work with **no backend**.
- [ ] **Polished Kitchen-Sink** — an enhanced version of the showcase: a persistent **sidebar
      navigator** (built from `ListView`/`Tree`, dogfooding the components it demos) replacing the
      current menu-only navigation, a category → story browse flow, a live bound-state echo per story,
      keyboard + mouse throughout, faithful TV colors, and no clipped text. It is the reference for
      "what good looks like" and is itself a live demo.
- [ ] **File/Data Browser** — a two-pane app: a directory tree / file list (`@jsvision/files` over the
      virtual FS) on one side and a **`DataGrid`** rendering structured data (e.g. a parsed CSV/JSON
      from the seeded tree) on the other; navigating the tree loads data into the grid; sortable,
      scrollable grid. Proves the virtual-FS + grid story end to end.
- [ ] Each app has a **dedicated docs page** (`/apps/*`) with a blurb, a Play button (RD-03), the key
      source embedded via snippet, and a short "how it's built" walkthrough linking to the components
      it uses (RD-05).

### Should Have

- [ ] A "New file / New todo" flow with input validation and error feedback (empty/duplicate handling).
- [ ] tvedit: unsaved-changes guard on close/switch (confirm dialog).
- [ ] Kitchen-Sink: deep-linkable stories (`/apps/kitchen-sink?story=…`).
- [ ] Each app downloadable as a `degit`-able example (ties to RD-04's starter approach).

### Won't Have (Out of Scope)

- Real server persistence / accounts — none (client-only, in-memory / local files).
- The editable REPL — Phase E (AR-9).
- Replacing the existing native `demo:*` scripts — those remain; these are the web-facing polished set.

---

## Technical Requirements

- All four apps are `@jsvision/ui` applications (the same code would run in a native terminal); they
  mount in the browser via `@jsvision/web` (RD-02) and are wrapped by DemoShell (RD-03).
- tvedit and the File/Data Browser use the RD-02 virtual FileSystem seed; tvedit's save path uses the
  File System Access bridge (real local files) with a download/upload fallback — content **never
  leaves the browser** unless the user explicitly saves to their own disk via the picker.
- The polished Kitchen-Sink's navigator is built from shipped components (`ListView`/`Tree`/
  `Scroller`) — dogfooding; its stories remain independent modules so adding one is one file.
- Each app is registered as a docs example (RD-03) so it is smoke-tested and coverage-gated (RD-09).

---

## Integration Points

### With RD-02 (`@jsvision/web`)
- Virtual FS + File System Access bridge (tvedit, File/Data Browser); mount via `mountApp`.

### With RD-03 (DemoShell + live system)
- Shared About + theme switcher; Play + snippet on each app page; smoke test.

### With RD-05 (component docs)
- Each app page links to the components it showcases; the Kitchen-Sink is the broad cross-reference.

### With RD-09 (screenshots)
- App hero shots / GIFs for the no-keyboard fallback and OG cards come from RD-09.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Sample-app set | 3 named / +file-data browser | Four (add File/Data Browser) | Covers state, editing, breadth, data | AR-11 |
| Kitchen-Sink | Keep as-is / polish + make navigator | Polish (UX+DX) + dogfooding navigator | User: current one not top-notch | AR-31 |
| App shell | Bespoke per app / shared DemoShell | Shared DemoShell (About + theme) | Consistency; user requirement | AR-5, AR-20 |
| tvedit persistence | Backend / virtual FS + local files | Virtual FS + File System Access, client-only | No backend; privacy | AR-2, AR-26 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: tvedit and the File/Data Browser may hold the user's **own file content**; it
  stays in the browser (virtual FS) and is written to real disk **only** on an explicit user
  save-via-picker gesture — never transmitted to any server (there is none) (AR-26).
- **Input validation**: todo text, file names, and edited content are treated as untrusted and pass
  the engine's `sanitize()` boundary before rendering; file names are validated (no empty/`..`
  escapes in the virtual FS path handling).
- **Authentication / authorization / rate limiting**: N/A (no server, no accounts).
- **Injection risks**: closed by `sanitize()` for rendered text; the CSV/JSON parsed into the DataGrid
  is parsed defensively (malformed input yields an error state, not a crash).
- **Encryption / infra**: HTTPS site; no secrets; virtual FS in-memory only.

---

## Acceptance Criteria

1. [ ] Each of the four apps opens as a live demo, paints its first frame within 1 s, and shows the
       DemoShell menu bar with a working **About** dialog and a **View → Theme** submenu that repaints
       the app when a preset is chosen (default = Turbo Vision).
2. [ ] Todo: adding "Buy milk" then toggling it complete updates the visible list and the active/done
       filter counts reactively; deleting the last item shows the empty state.
3. [ ] tvedit: opening a seeded file shows its contents; typing edits it; Ctrl+C/Ctrl+V copy/paste
       within the buffer; saving writes back to the virtual FS (re-opening shows the change) — all with
       **no network request** (verified in the network panel).
4. [ ] tvedit: attempting to close/switch with unsaved changes prompts a confirm dialog (Should-Have,
       if implemented) — otherwise documented as a known limitation.
5. [ ] Kitchen-Sink: a persistent sidebar navigator built from JSVision components lists categories and
       stories; selecting a story swaps the canvas; at least one story shows a live bound-state echo;
       no visible text clipping at the documented viewport.
6. [ ] File/Data Browser: selecting a file in the tree/list loads structured rows into a `DataGrid`
       that can be sorted by a header and scrolled; selecting a malformed data file shows an error
       state, not a crash.
7. [ ] Every app is registered in the RD-03 example registry and passes the headless smoke test.
8. [ ] Security requirements verified: file/edited content never leaves the browser except via an
       explicit user save-picker gesture; a file whose content contains a raw `ESC`/control byte
       renders sanitized; malformed parsed data is handled without a crash.
