# Preflight Report — RD-09 Files package `@jsvision/files`

> **Artifact:** `codeops/features/jsvision-ui/requirements/RD-09-files-package.md`
> **Date:** 2026-07-05 · **Skill:** preflight 3.3.0 · **Iteration:** 1
> **⚠️ SAME-SESSION REVIEW** — RD-09 was authored in this same session; an extra-adversarial pass
> was run and every code/fidelity claim was independently re-verified against primary sources
> (the C++ at `/home/gevik/workdir/github/tvision`, read directly + by an independent decode agent;
> the monorepo at `packages/**`, read by an independent composition agent). Consider a fresh-session
> re-scan for full independence.

## Codebase Context Summary

- **Scope is real and correctly bounded.** Component-map §9 lists exactly the six 🟣 relocate
  targets the RD claims (`TFileDialog`/`TFileList`/`TFileInputLine`/`TFileInfoPane`/`TDirListBox`/
  `TChDirDialog`). RD-09 = roadmap "Files package `@jsvision/files`", stage RD Drafted.
- **All dependency numbering CONFIRMED** against the ui roadmap: RD-05 App shell · RD-06 Essential
  controls · RD-11 Containers/scrolling/lists · RD-14 Input dropdowns (History · ComboBox).
- **The "compose, no new ui primitives" thesis holds.** `Dialog` (`valid()` gate + `execView`
  modality, `dialog.ts:58/119/176`), generic `ListView<T>` (`list-view.ts:43`; `ListBox` already
  subclasses it, `list-box.ts:17`), `Input` (protected fields + `filter` validator, `input.ts:61`),
  `ScrollBar`, `History`/`ComboBox` (`dropdown/`, exported `index.ts:110`) are all exported and
  composable. `sanitize` is a real write-time boundary (`buffer.ts:193`). `RuntimeAdapter`
  (`host/types.ts`) is a fair analogy for the fs seam. Private-package exclusion from
  `sync-versions` is automatic via `pkg.private === true` (no skip-list edit).
- **Suspected modal-story feasibility gap is RESOLVED by the code:** `StoryContext.execView?`
  (`story.ts`) + the shipped `dialog.story.ts` prove a modal dialog is hosted from a story's launch
  button and degrades to just the button headless. A `FileDialog` story is feasible as-specified.
- **All TV geometry/glyph/palette citations verified ACCURATE:** FileDialog `TRect(15,1,64,20)` +
  child rects + button `+3` step (`tfildlg.cpp:58-136`); FileList trailing-`\` getText
  (`tfillist.cpp:119-120`) + `findAttr=FA_RDONLY|FA_ARCH` (`:167`); FileInput dir-append
  (`stddlg.cpp:83-88`); FileInfoPane `cpInfoPane="\x1E"` + no-attrs field (`stddlg.cpp:67/244-298`);
  DirList connectors (`tvtext1.cpp:119-124`) + `indentSize=2`; ChDirDialog `TRect(16,2,64,20)` +
  buttons (`tchdrdlg.cpp:42-76`); wildcard `isWild`/`wildcardMatch`/`*.*`→`*`
  (`tdircoll.cpp:144-147`, `findfrst.cpp:125-186`); no `cpFileDialog`/`cpChDirDialog` palette
  (`dialogs.h:80-92`). **The RD's decode is strong.**

## Findings

| ID | Sev | Dimension | Summary | Status |
|----|-----|-----------|---------|--------|
| PF-001 | 🟠 MAJOR | 12 Consistency / 13 Fidelity | `..` sort position is inverted — RD says "first", source sorts it **last** | ✅ Fixed (Option a) |
| PF-002 | 🟡 MINOR | 3 Contradiction | AC-8 lists all six buttons; Replace/Clear are save-mode (Should-Have) — internal inconsistency | ✅ Fixed (Option a) |
| PF-003 | 🟡 MINOR | 1 Ambiguity | "RD-07 RuntimeAdapter" points at the *archived foundation* RD-07, not the ui feature-set's RD-07 | ✅ Fixed (Option a) |
| PF-004 | 🟡 MINOR | 13 Fidelity | Two decode-table citation imprecisions (input label text; `findfrst.cpp` path) | ✅ Fixed (Option a) |
| PF-005 | 🔵 OBS | 9 Edge Case | Case-sensitive wildcard (faithful) is surprising on case-insensitive Windows FS | ✅ Fixed (Option a — documented) |

> **Resolution (2026-07-05):** user chose *apply all recommended fixes*; all five Option-(a) edits
> applied to `RD-09-files-package.md` (PF-001 corrected in 4 places incl. AC-3; PF-005 also mirrored
> into AR-243 of the register).

---

### PF-001 🟠 MAJOR — the `..` entry sorts **last**, not first (inverted decode, baked into AC-3)

**Where (RD):** decoded-facts table (`FileList rows`), FileList component-table row, Functional
Requirements FileList "Sort order", and **AC-3** — all four state `..` sorts **first**.

**Primary-source evidence** (`source/tvision/tfilecol.cpp:40-56`, read directly):
```c
int TFileCollection::compare(void *key1, void *key2) {
    if( strcmp(getName(key1), getName(key2)) == 0 ) return 0;
    if( strcmp(getName(key1), "..") == 0 ) return 1;   // ".." is "greater" → sorts LAST
    if( strcmp(getName(key2), "..") == 0 ) return -1;
    if( (attr(key1)&FA_DIREC) && !(attr(key2)&FA_DIREC) ) return 1;  // dir after file ✓
    if( (attr(key2)&FA_DIREC) && !(attr(key1)&FA_DIREC) ) return -1;
    return strcmp(getName(key1), getName(key2));
}
```
Ascending collation → top-to-bottom = **files A–Z, then directories A–Z, then `..` last**. The RD's
"directories after files" is correct; only the `..` position is inverted. Independent decode agent
reached the same conclusion.

**Why it matters:** the TV-fidelity directive is NON-NEGOTIABLE and makes the C++ authoritative;
AC-3 is an *immutable spec oracle*. A spec test written from AC-3 would encode the wrong order — the
implementer either "matches the spec" and ships wrong-order output, or GATE-2 catches it only after
implementation (a wasted cycle).

**Failure scenario:** navigate any subdirectory → the synthesized `..` renders at the **top** of the
FileList (per AC-3) instead of the **bottom** (per `tfilecol.cpp`), and the spec test asserts the
wrong position as truth.

**Options:**
- **(a) [Recommended]** Correct all four occurrences to "`..` **last**" and reword AC-3 to
  "files, then directories, then `..` last — matched to `tfilecol.cpp:40-56`". Cheap (4 text edits),
  restores fidelity before any test is written.
- (b) Soften AC-3 to "TV-faithful order per `tfilecol.cpp` (pinned at GATE-1)" without stating the
  order — rejected: an AC should be a concrete oracle, and the order is already known.

**Confidence: high.** **Hardening:** primary-source read (self) + independent decode agent agree; the
comparator is unambiguous.

---

### PF-002 🟡 MINOR — AC-8's button list contradicts the save-mode Should-Have

**Where:** AC-8 asserts "the Open/OK/Replace/Clear/Cancel/Help button strip"; the Functional
Requirement (line 88) qualifies it "per the `aOptions` flags"; the Should-Have (line 171) wires
Replace/Clear only for the **save** workflow. So AC-8 reads as "all six always", but Replace/Clear
are mode-gated and deferred to a Should-Have.

**Why it matters:** a spec test from AC-8 would expect six buttons in the Must-Have open dialog;
the design only guarantees the open-mode subset (Open/Cancel/Help — TV's `fdOpenButton` default).

**Options:**
- **(a) [Recommended]** Reword AC-8 to the Must-Have **open-mode** button set (Open =`bfDefault`,
  Cancel, Help) rendered at the decoded coordinates, and note the full OK/Replace/Clear set is the
  `aOptions`-gated save-mode (Should-Have). Aligns the AC with line 88 + the Should-Have.
- (b) Promote all six to Must-Have — rejected: contradicts the save-mode Should-Have split (line 171)
  and the `aOptions` gating.

---

### PF-003 🟡 MINOR — "RD-07 RuntimeAdapter" is an ambiguous cross-feature reference

**Where:** Functional Req ("the RD-07 `RuntimeAdapter` pattern for tty") and AR-235.

**Evidence:** `RuntimeAdapter` (`packages/core/src/engine/host/types.ts`, attributed "RD-07" in-code)
belongs to the **archived foundation** feature-set (`codeops/_archive/foundation/`), whose RDs restart
numbering. The **current jsvision-ui** RD-07 is "Essential-control completions" — a different RD-07.

**Options:**
- **(a) [Recommended]** Drop the RD number: "core's `RuntimeAdapter` host seam (`@jsvision/core`)".
  Unambiguous, points at the real artifact.
- (b) Qualify it "the archived-foundation RD-07 `RuntimeAdapter`". Works but verbose.

---

### PF-004 🟡 MINOR — two decode-table citation imprecisions (GATE-1 correctness aids)

**Where / evidence:**
1. The decoded-facts table calls the filename field's label "`~F~ile` label". `tfildlg.cpp:70` binds
   that label to the **caller-supplied `inputName`** argument — it is not hardcoded "~F~ile". Only the
   *list* label `~F~iles` is hardcoded (`filesText`, `:81`).
2. The wildcard citation `findfrst.cpp:162-186` lives under **`source/platform/`**, not the
   `source/tvision/` dir the sibling citations share.

**Option (a) [Recommended]:** fix both in the decode table (label = "caller-supplied `inputName`
(default per opener)"; cite `source/platform/findfrst.cpp`). Prevents a GATE-1 decoder chasing the
wrong file / hardcoding the wrong label text. Neither affects geometry.

---

### PF-005 🔵 OBSERVATION — case-sensitive wildcard on a case-insensitive Windows FS

**Where:** AR-243 / AC-2 mandate case-**sensitive** `*`/`?` matching (TV-faithful); AC-11 mandates
correct Windows behavior. On Windows (case-insensitive FS) a user typing `*.TXT` would not match
`readme.txt` — faithful to TV, but surprising, and a latent "why doesn't my filter work" report.

**Option (a) [Recommended]:** add one line to AR-243 / the AC-11 note documenting that
case-sensitivity is **retained cross-platform** as a deliberate fidelity choice (so it reads as
intended, not a bug). No behavior change. *(Accepting as-is is also fine — it is a documented
faithful decision.)*

---

## Final tier

**✅ PREFLIGHT PASSED — all 5 findings resolved** (1 MAJOR + 3 MINOR + 1 OBS, all Option (a) applied).
The RD is grounded: every TV geometry/glyph/palette citation and every `@jsvision/ui`-composition
claim was verified against primary sources, and the one substantive defect (the inverted `..` sort)
is corrected before any spec test encodes it. **Next:** `make_plan RD-09` (GATE-1/GATE-2 mandatory —
all six components are TV decodes).
