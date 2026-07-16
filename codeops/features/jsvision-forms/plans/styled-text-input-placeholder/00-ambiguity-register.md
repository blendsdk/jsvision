# Ambiguity Register — Styled Text Severity & Input Placeholder (RD-09 plan)

> **✅ GATE PASSED** (2026-07-15)
> **Parent**: [Index](00-index.md) · **Implements**: jsvision-forms/RD-09
>
> This plan implements a **fully preflighted** RD. Every semantically-weighted decision was
> resolved upstream in the requirements register (`../../requirements/00-ambiguity-register.md`,
> AR-25…AR-32) and hardened by the RD-09 preflight (`../../requirements/00-preflight-report-rd-09.md`,
> PF-001…PF-007, all applied). Those rows import here as **resolved** and are **not** re-confirmed
> (shared gate rule 3). Only genuinely NEW, plan-local decisions surfaced while grounding the RD in
> the code get a row below — and each is a derivation or an obvious fact, not a new semantic choice.

## Imported — resolved upstream (RD-09 requirements register + preflight)

| AR | Decision (one-line gloss) | Source |
|----|---------------------------|--------|
| AR-25 | `dangerText` + `warningText` semantic core roles, derived from the `danger`/`warning` aliases | requirements AR-25 (user) |
| AR-26 | Extend the existing `Text` with an optional `severity` — no new widget class | requirements AR-26 (user) |
| AR-27 | `Text` option is `severity?: 'error' \| 'warning'` (public, semantic); `draw()` maps it to the roles | requirements AR-27 |
| AR-28 | Placeholder shown muted **whenever the bound value is empty** (any focus), gone on first char | requirements AR-28 (user) |
| AR-29 | Placeholder styling = composed muted style (`staticText` fg over `inputNormal` bg); no `inputPlaceholder` role | requirements AR-29 |
| AR-30 | Placeholder propagation = `DatePicker` + `ComboBox` + `inputBox()` (History/ColorPicker excluded) | requirements AR-30 / PF-001 |
| AR-31 | Per-field `field.reset()` deferred (GH #89) — out of this plan | requirements AR-31 (user) |
| AR-32 | Package span = core (roles) + ui (Text/Input) + examples (stories); **no `@jsvision/forms` change** | requirements AR-32 |

> Do not restate the above. Every plan document cites `AR-25…AR-32` and the RD sections they own.

## Plan-local rows (new to the plan; derivations / obvious facts — not re-confirmed)

| AR | Item | Resolution | Evidence | Status |
|----|------|-----------|----------|--------|
| AR-P1 | **Verify command** | `yarn verify` (= `yarn lint` then `turbo run typecheck build test check:docs`) fills every Verify line | `CLAUDE.md` §Commands:35 | ✅ Resolved (obvious) |
| AR-P2 | **Where the two roles are placed** in the `Theme` interface + the three `: Theme` literals | **Appended at the end** of the interface and of each literal (`theme.ts`, `presets.ts` monochrome, `roles.ts` return) — the additive convention the tripwire allowlists already model | Zero semantic impact; `Object.keys`-based specs are set-membership, not order | ✅ Resolved (structural, exempt) |
| AR-P3 | **Per-theme fg/bg values for the roles** (the RD role table gives the `defaultTheme` view only) | `dangerText`/`warningText` bg = **that theme's own `staticText` bg**; fg = literal `#ef4444`/`#f59e0b` in `defaultTheme`, `c.danger`/`c.warning` in `rolesFromAliases`, and **`{fg:W,bg:B}` achromatic** in `monochromeTheme` (attrs unset, per the RD's "no bold" rule — a monochrome theme carries no hue) | `theme.ts:293` staticText; `roles.ts:55` staticText; `presets.ts:75` mono staticText; RD role table + AR-25 | ✅ Resolved (derived from RD + code) |
| AR-P4 | **`createTheme` plumbing** — how far does the change reach? | **No logic change to `create-theme.ts`** — `ThemeOptions.danger/warning` already seed the aliases (`create-theme.ts:117-118`), so override-flow is automatic once `rolesFromAliases` consumes `c.danger`/`c.warning`. The only edit there is **correcting the now-stale doc-comments** `danger?`/`warning?` "…drives no built-in role" (`create-theme.ts:31,33`; check the matching alias doc in `aliases.ts`) | `create-theme.ts:31,33,117-118,156-159` | ✅ Resolved (derived from code) |
| AR-P5 | **`placeholder` reactivity** when a `Signal<string>` is passed | Resolve to a string in `Input.draw()`; if the placeholder is a signal, **subscribe on mount** (mirroring the existing `value` binding at `input.ts:132-147`) so a changing placeholder repaints an empty field. Placeholder participates in no edit/selection/scroll math | `input.ts:132-147` value-binding pattern; `input-render.ts:78` paint helper | ✅ Resolved (impl detail) |
| AR-P6 | **Own-guard spec + story targets** | The additive-role byte-for-byte guard lives in `@jsvision/core`'s test dir following the existing per-role theme-guard pattern; the kitchen-sink demos = a placeholder on `input.story` + a severity error/warning demo (exact files pinned in `02`/`07` from recon), each green under `kitchen-sink.smoke.spec.test.ts` | RD AC #7/#8; recon | ✅ Resolved (derived from ACs) |

## Runtime decisions (surfaced during execution — tagged `(runtime)`)

| AR | Item | Resolution | Evidence | Status |
|----|------|-----------|----------|--------|
| AR-P8 (runtime) | **`input.ts` hit the ≤500-line control-file oracle** (ST-13/ST-15) — adding `placeholder` pushed it to 509 (was ~491, already near the cap, per the standing "input.ts near the ≤500 oracle" note). | Keep the placeholder feature and land the file under 500 by **extracting the trivial resolver to a pure helper** `resolvePlaceholder(p)` in `input-render.ts` (its natural home; `paintInput` still receives a resolved string, consistent with how `value` is passed) and trimming two now-redundant internal comments. Lands `input.ts` at 499 (1-line headroom). No behaviour change; no spec touched (the ≤500 oracle is upheld, not modified). | `input.ts` size (509→499); `input-render.ts:resolvePlaceholder`; ST-13/ST-15 packaging guards green | ✅ Resolved (runtime, in-scope size-fit) |
| AR-P7 (runtime) | **Two more guards encode the now-overturned "danger/warning drive no role" premise** that the plan's recon did not enumerate: `create-theme.spec.test.ts:180` ("overriding danger/warning changes no role — byte-identical") and `accelerator-aliases.impl.test.ts:69` ("danger/warning drive no role — sentinels never appear"). RD-09 AC #1 deliberately overturns this premise. | **Revise both** as the sanctioned oracle-follows-requirement update (identical in kind to the plan's `roles-panel.spec` revision, task 1.2.5), into **scoped** guards: the spec asserts a danger/warning override moves **only** `dangerText`/`warningText`; the impl asserts each sentinel lands in exactly its role and leaks into **no other** role. Both file docstrings updated. **User approved** (Phase 1, 2026-07-15). | `create-theme.spec.test.ts:180-186`; `accelerator-aliases.impl.test.ts:69-83` + header; RD-09 AC #1; the plan's own oracle-follows-requirement precedent (03-01/07/99 §1.2.5) | ✅ Resolved (user-approved runtime) |

### Gate confirmation
- [x] Every semantic decision traces to a **user-confirmed** upstream AR (AR-25/26/28/31) or a preflight-hardened derivation (AR-27/29/30/32), or is a plan-local derivation/obvious fact (AR-P1…P6).
- [x] Zero deferred *in-scope* items. Per-field reset is the only deferral and is **out of scope by decision** (AR-31 / GH #89).
- [x] No new semantic choice required a fresh user decision — the RD-09 preflight already collected them.
- [x] Header reads **✅ GATE PASSED**.
