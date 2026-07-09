# Data Studio — Feasibility Decision Memo

> Copy this file to `decision-memo.md` and fill every section as you run the probes in
> `00-spike-plan.md`. This memo is the spike's deliverable. Be honest — a well-evidenced NO-GO that
> saves a doomed build is the best possible outcome.

**Executed by:** <agent/date>
**Environment:** Postgres <version> via <docker/local>, `pg` <version>, Node <version>, native build? <y/n>

---

## TL;DR — recommendation

**Verdict:** ☐ GO ☐ GO-WITH-CAVEATS ☐ NO-GO

**Single strongest reason:** <one sentence>

**If GO, the recommended first slice:** <one or two sentences>

**Confidence:** <low / medium / high> — <why>

---

## Verdict scorecard

| Probe | Subsystem | Verdict | Effort (S/M/L/XL) | Evidence (script / output) |
|-------|-----------|---------|-------------------|----------------------------|
| 0 | Setup / `pg` connect | 🟢/🟡/🔴 | — | |
| 1 | Introspection & type mapping | | | |
| 2 | CRUD / txn / concurrency | | | |
| 3 | **RecordSet spine + paging** | | | |
| 4 | **Editable grid + editor overlay** | | | |
| 5 | Bound form (shared spine) | | | |
| 6 | Scripting / event model | | | |
| 7 | Scale & perf | | | |

Legend: 🟢 works / low risk · 🟡 works with caveats or open work · 🔴 blocked / fights the framework.

---

## Probe findings (detail)

### Probe 0 — Setup
- Finding:
- Evidence:

### Probe 1 — Introspection & type mapping
- Can we fully describe a table (cols/types/null/default/PK/FK/enum/check/generated/updatable)?
- **Type → editor table:**

  | PG type (in seed) | Proposed editor | Verdict (trivial / needs-work / read-only) |
  |-------------------|-----------------|--------------------------------------------|
  | text | Input | |
  | integer / serial | Input+range | |
  | numeric(12,2) | Input+range | |
  | boolean | CheckGroup | |
  | date | DatePicker | |
  | timestamptz | ? | |
  | enum (customer_tier) | dropdown | |
  | uuid | ? | |
  | integer[] | ? | |
  | jsonb | ? | |
  | generated (available) | read-only | |

- What the catalog can't tell us:
- Evidence:

### Probe 2 — CRUD / transactions / concurrency
- CRUD round-trip (parameterized):
- Transaction behavior:
- **Concurrency strategy chosen** (xmin / all-columns WHERE / version col) + cost:
- Composite-PK table (`order_item`) — editable? how:
- No-PK table (`tag`) — editable or read-only? decision:
- Constraint errors (CHECK/NOT NULL/FK) — structured & user-presentable? sample:
- Evidence:

### Probe 3 — RecordSet spine (MOST IMPORTANT)
- **Recommended `RecordSet` contract** (revised from the plan strawman):
  ```
  <paste the contract you'd actually ship>
  ```
- Reactivity fit — does a cursor move reactively repaint bound controls? idiomatic or a fight?
- **PAGING VERDICT (make-or-break):** in-memory-only / windowed-source works / needs a
  `@jsvision/ui` change / needs a grid fork — pick one, with evidence:
- Evidence:

### Probe 4 — Editable grid (MAKE-OR-BREAK)
- Cell cursor added as: additive layer / subclass / requires forking `@jsvision/ui`:
- **Editor-overlay verdict** — can a typed editor mount at a cell rect in the current
  view/compose/overlay model? how (overlay / absolute child) / what broke:
- Commit/advance, dirty markers, new-row, delete-row, NULL-vs-empty — status:
- Rough size of the edit layer + which grid internals it needs:
- Evidence:

### Probe 5 — Bound form (shared-spine proof)
- Grid + form share one RecordSet and stay in sync? proven / broken / caveats:
- Save gated by `Dialog.valid()`? :
- Evidence:

### Probe 6 — Scripting
- Trusted TS `BeforeSave` veto works end-to-end? :
- Untrusted-sandbox options + **recommendation** (node:vm / isolated-vm / DSL / defer):
- Evidence:

### Probe 7 — Scale & perf
- 100k-row table with paging: usable / marginal / not usable — timings:
- Within the 16 ms frame budget? :
- Evidence:

---

## Assess-on-paper (pillars we did not prototype)

- **Reports (export):**
- **Visual query builder / QBE:**
- **Relationships editor:**
- **Form designer vs. code-defined forms** — recommended v1:
- **Packaging** (`@jsvision/data` + app; `check:deps` boundary respected?):

---

## Framework additions `@jsvision/ui` would need

(Things the spike proved are missing — do NOT implement in the spike; list them for the real build.)

1.
2.

---

## Features to defer (with rationale)

1.
2.

---

## Risk register (re-ranked with evidence)

| Risk | Likelihood | Impact | Mitigation / open question |
|------|-----------|--------|----------------------------|
| Editor-overlay integration | | | |
| Server-paging vs in-memory grid | | | |
| RecordSet ⇄ reactivity fit | | | |
| Concurrency correctness | | | |
| Untrusted-script sandbox | | | |
| Type-mapping long tail | | | |

---

## Unknown unknowns discovered

(Things this plan did not anticipate — often the most valuable output.)

-

---

## Rough effort to a v1 (if GO)

| Subsystem | Effort | Notes |
|-----------|--------|-------|
| `pg` adapter + introspection | | |
| RecordSet layer | | |
| Editable grid | | |
| Bound forms + code-defined forms | | |
| Event/scripting (trusted) | | |
| App shell wiring (menu/status/nav) | | |
| **Total to a usable v1** | | |
