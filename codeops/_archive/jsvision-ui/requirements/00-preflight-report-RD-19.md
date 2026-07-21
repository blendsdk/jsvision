# Preflight Report — RD-19 (Surface family: `Surface` + `SurfaceView`)

> **Artifact**: `requirements/RD-19-surface.md`
> **Scanned**: 2026-07-05 (fresh session — not same-session as authoring; independence OK)
> **Scanner**: preflight (CodeOps 3.3.0), 13-dimension codebase-grounded audit
> **Outcome**: ✅ **PASSED** — **0 CRITICAL · 1 MAJOR · 4 MINOR · 1 OBSERVATION**; all resolved & applied to RD-19 (2026-07-05).

## Resolution log (2026-07-05)

| Finding | Decision | Applied |
|---|---|---|
| **PF-001** (MAJOR) | **(a)** sanitize-on-mutation | `at()`/facade/raw writes all write-time sanitize-clean → faithful raw blit safe by construction. New **AC-14**; line-82 wording fixed; Security section + `at()` bullet + AR-232 updated. |
| **PF-002** (MINOR) | Apply | `Surface.at(x, y)` house order (was `at(y, x)`); documented deviation in the `at()` bullet, AC-2, AR-232. |
| **PF-003** (MINOR) | Apply | `windowInactive` owner-relativity documented as a scoped simplification; empty-area bullet, theme-roles bullet, AC-4/AC-10, AR-231. |
| **PF-004** (MINOR) | Apply | Paint-facade `theme`/`caps` seam note added to Technical Requirements. |
| **PF-005** (MINOR) | Apply | TV `file:line` citations corrected in the decode table + AC intro + AC-3. |
| **PF-006** (OBS) | Noted | Already flagged in the RD (invalidate/version bump pinned at plan time). No change. |

RD-19 is a strong, well-grounded requirements doc. The TV decode is faithful (re-verified cell-by-cell
against `tsurface.cpp`), the core-reuse claims hold (`ScreenBuffer`, `windowInactive`, `makeDrawContext`
all verified), and the AR/DEFERRED/roadmap traceability is intact. The findings below are refinements,
not rewrites — the single MAJOR is the collision point of the two NON-NEGOTIABLE directives
(TV-fidelity × security) at the `at()`/blit boundary.

---

## Codebase Context Summary

| Claim in RD-19 | Verified against | Result |
|---|---|---|
| `TDrawSurface`/`TSurfaceView` exist; decode table | `include/tvision/surface.h`, `source/tvision/tsurface.cpp:1-147` | ✅ faithful |
| No bundled TV example uses Surface | whole-tree grep (only `README.md` text) | ✅ correct |
| `Surface` wraps core `ScreenBuffer` (clone/set/get/text/fillRect/box/shadow) | `packages/core/src/engine/render/buffer.ts` | ✅ present |
| `ScreenBuffer.resize` exists | buffer.ts | ⚠️ absent — RD anticipates (allocate-new) |
| `set`/`text` sanitize; `set`/`get` bounds-safe | buffer.ts:141,163,193 | ✅ sanitize at write-time |
| `windowInactive` = passive-frame role | theme.ts:335 (`0x17` lightGray-on-blue); window.ts:143 | ✅ present, but owner-fixed (see PF-003) |
| `DrawContext` facade over any buffer | draw-context.ts:64 `makeDrawContext(buffer,viewRect,clip,theme,caps)` | ✅ feasible |
| AR-225…234, DEF-31 registered | `00-ambiguity-register.md`, `DEFERRED.md:50` | ✅ all present |
| No `Surface`/`SurfaceView` symbol collision | grep `packages/*/src` | ✅ clear |

---

## Findings

### 🟠 PF-001 (MAJOR) — Sanitize boundary vs. faithful raw-cell blit: an unpinned security × fidelity collision

**Dimensions:** 8 (Security), 3 (Contradiction), 13 (Codebase Alignment).

`ScreenBuffer.set()`/`text()` sanitize control bytes **at write time** (buffer.ts:141 turns a C0/DEL into
a space; buffer.ts:193 runs `sanitize(str)`). So content written into a `Surface` via `set`/`text`/
`fillRect`/the `DrawContext` facade is sanitized-by-construction, and a raw cell-copy blit of *that*
content is safe.

But two RD decisions are under-specified and, combined, open a bypass:
1. **`at()` is spec'd as a read-write cell accessor** (RD line 75-77; AC-1) faithful to TV's
   `TScreenCell& at()`. AC-2/AC-13 guarantee only that `at()` is **bounds-checked** — *not* that a value
   written through it is **sanitized**. TV's `at()` returns a mutable cell ref precisely so callers poke
   raw cells; if jsvision preserves that shape, a caller can store a raw `\x1b[…` control byte.
2. **The blit is spec'd as faithful** (AC-3: "blits exactly the surface cells", matched to `writeBuf`),
   which in TV is a raw `TScreenCell` array copy — *not* routed through a sanitizing `set()`.

The Security section (RD line 245) *asserts* "every blitted cell … routes through the … `sanitize`
boundary," but that contradicts a faithful raw-copy blit for content injected via `at()`. The RD's line 82
wording ("writes go through sanitize **at the point they reach a screen**") is also imprecise — sanitize
is at write-into-buffer, not at blit.

**Failure scenario:** app calls `surface.at(0,0).char = '\x1b[2J'` (raw cell poke) → `SurfaceView` blits
the raw cell into the screen buffer via a `writeBuf`-style copy → the escape reaches the terminal
unsanitized. The security guarantee the RD claims does not hold for the `at()` path.

**Options:**
- **(a) — recommended.** Guarantee that *every* mutation of a surface cell is sanitize-clean (make `at()`
  writes go through the same C0/DEL sanitize as `set()`/`text()`, or make `at()` a read + a sanitizing
  setter, or read-only). Then a faithful raw-copy blit is safe **by construction** — fidelity and
  security both hold. Add an AC: "no surface mutation path can store an unsanitized control byte."
- **(b)** Re-sanitize at blit time (route each blitted cell through the screen `ScreenBuffer.set`). Safe,
  but re-runs width/sanitize on every visible cell every frame (perf cost) and is a mild fidelity
  deviation from `writeBuf`'s raw copy.
- **(c)** Accept `at()` as an unchecked/unsanitized escape hatch and document it. Rejected — it reopens
  exactly the injection boundary RD-13/RD-08 closed.

**Recommendation:** **(a)** — it dissolves the contradiction at the source: if surface cells cannot hold
an unsanitized control byte, the faithful raw blit stays faithful *and* safe. Fix line 82's wording and
add the sanitize-on-mutation AC.
*Confidence: medium-high. Hardening: one inline challenger ("isn't this moot since set() already
sanitizes?") — rejected, because `at()` is explicitly framed as a TV-faithful mutable-cell accessor whose
only stated guard is bounds, so the gap is real until the mutation path is pinned.*

---

### 🟡 PF-002 (MINOR) — `Surface.at(y, x)` argument order reverses the house `(x, y)` convention

**Dimensions:** 12 (Consistency), 9 (Edge/Footgun).

RD line 75-77 + AC-1/AC-2 specify `at(y, x)` — faithful to TV's `at(int y, int x)` (row-major memory).
But the wrapped `ScreenBuffer` and **every** jsvision drawing API use `(x, y)` (`set(x,y)`, `get(x,y)`,
`fillRect(x,y,…)`, `ctx.text(x,y)` — verified in buffer.ts). A caller mixing `surface.at(y,x)` with
`ctx.text(x,y)` silently swaps coordinates.

**Recommendation:** adopt house `(x, y)` for the jsvision accessor and document the deviation (the
TV-fidelity directive scopes fidelity to *drawing geometry/glyphs/color*, not API ergonomics — behavior
"the original couldn't have" may extend TV, and the RD already documents the bounds-check deviation, so
arg-order is a natural sibling deviation). If `(y, x)` is kept for faithfulness, call it out loudly in the
JSDoc + AC as the one place the coordinate order flips.

---

### 🟡 PF-003 (MINOR) — Empty-area role is owner-relative in TV; RD hardcodes `windowInactive`

**Dimensions:** 13 (Architecture/Fidelity), 1 (Ambiguity).

TV's `mapColor(1)` resolves the empty area through the **owner's** palette — surface.h states it maps to
"**TWindow's *and* TDialog's** frame passive color," i.e. it is container-dependent. jsvision's
`windowInactive` (theme.ts:335 = `0x17` lightGray-on-blue) is faithful only for a `SurfaceView` inside an
**inactive blue Window**. Inside a **gray Dialog**, TV would paint the dialog's frame-passive (gray);
AC-10 commits to the single fixed `windowInactive`, so a surface-in-dialog would show blue.

**Options:**
- **(a) — recommended.** Accept + document the simplification (fixed `windowInactive`) as a scoped
  deviation, like the bounds-check one — surface-in-dialog is rare and this is the "Later" phase. Note it
  in the Security/Scope Decisions and soften AC-10 to "reuses a passive-frame role (`windowInactive` for
  the window case)."
- **(b)** Resolve the empty-area role from the host frame role (window→`windowInactive`, dialog→a
  dialog-passive value) so it tracks TV's owner-relativity — more faithful, more plan work, and needs a
  dialog-passive value (possibly the 1 "new role" the RD is trying to avoid).

**Recommendation:** **(a)** for MVP faithfulness-vs-cost, with the deviation documented so "0 new roles"
stays an *informed* choice rather than an unnoticed fidelity gap.

---

### 🟡 PF-004 (MINOR) — DrawContext paint-facade theme/caps source is unspecified for offscreen authoring

**Dimensions:** 4 (Completeness), 6 (Feasibility).

`makeDrawContext` requires `(theme, caps)` (draw-context.ts:64). The RD makes the `DrawContext` facade the
**primary** offscreen paint API (AR-227, AC-7) — `ctx.color(role)` needs a theme — but doesn't say where a
`Surface`'s facade obtains `theme`/`caps` when a caller draws into it **before/independent of** a render
root (a `Surface` isn't inherently bound to either). Plan-level detail, but it should be pinned: does the
surface capture the app theme/caps at construction, take them per `getDrawContext()` call, or default?

**Recommendation:** add a one-line technical note that the surface's paint facade takes/binds `theme` +
`caps` (defaulting to `defaultTheme` + a mono/ASCII-safe caps profile) so offscreen `ctx.color(role)` is
well-defined; pin the exact seam at plan time.

---

### 🟡 PF-005 (MINOR) — TV `file:line` citations drift from the actual source

**Dimensions:** 13 (Phantom/Precision), 12 (Consistency).

The decode facts are accurate, but several exact refs drift (the fidelity directive requires citing exact
`file:line`):
- "Empty area … `tsurface.cpp:90,142-160`" — the file ends at **line 147** (`getPalette` is 143-146);
  line 90 is inside `fillWithSpaces`. The `mapColor(1)` fact is at **line 98**; `cpSurfaceView "\x01"` at
  **line 19**.
- "Viewport fields … `tsurface.cpp:74-79`" — the fields (`surface`, `delta`) are declared in
  **`surface.h`**; line 74 is inside `clear()`; the ctor is 77-83.
- Buffer-model rows cite `tsurface.cpp:36-79`/`20-79` — `resize` is **40-70**, `clear` **72-75**; `at` is
  inline in **`surface.h`**.

Low impact (plan GATE-1 re-verifies cell-by-cell), but tightening now keeps the decode table trustworthy.

**Recommendation:** correct the refs (point field/`at` rows at `surface.h`; empty-area at `tsurface.cpp:19,85-91,98,138-146`).

---

### 🔵 PF-006 (OBSERVATION) — Reactive content-invalidation mechanism is deferred to plan

AC-6 requires that mutating surface **content** (same identity, in-place) invalidates the bound
`SurfaceView`. `ScreenBuffer` has no built-in signal, so this needs an explicit `invalidate()`/version
bump. The RD already flags this ("pinned at plan time", line 85-86) — noted only for completeness so it
isn't lost between RD and plan; not a defect.

---

## Dimension coverage

| # | Dimension | Result |
|---|---|---|
| 1 | Ambiguities | PF-003 (partial), PF-004 |
| 2 | Implicit Assumptions | clean (theme/caps → PF-004) |
| 3 | Logical Contradictions | PF-001 |
| 4 | Completeness Gaps | PF-004, PF-006 |
| 5 | Dependency Issues | clean (deps verified: RD-01/02/03/04/05 + core) |
| 6 | Feasibility | PF-004; facade + resize-by-realloc verified feasible |
| 7 | Testability | clean (13 ACs are concrete oracles) |
| 8 | Security Blind Spots | PF-001 |
| 9 | Edge Cases | PF-002; degenerate/null/overshoot covered by AC-9 |
| 10 | Scope Creep | clean (tight scope; DEF-31 tracked) |
| 11 | Ordering | clean (self-contained; independently sequenceable) |
| 12 | Consistency | PF-002, PF-005 |
| 13 | Codebase Alignment | PF-001, PF-003, PF-005; core-reuse claims verified |

---

## Verdict

**✅ PASSED.** No CRITICAL. All 1 MAJOR + 4 MINOR findings decided and applied to RD-19 (see the
Resolution log); PF-006 is already flagged in the RD. The RD now carries **14 ACs** (added AC-14,
sanitize-on-mutation). RD-19 is ready for **`make_plan RD-19`** with its mandatory GATE-1/GATE-2 decode
tasks (`tsurface.cpp:19,40-75,85-141` + `surface.h`).
