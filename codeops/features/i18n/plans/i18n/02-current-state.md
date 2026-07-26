# Current state

## Repository

| Area | Current state | Consequence |
|---|---|---|
| Workspace | Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo | New package follows existing package scripts and NodeNext imports |
| Verification | Root `yarn verify`; package-local build/typecheck/test/docs checks | Focused task gates, full phase/final gate |
| Application | `packages/ui/src/app/application.ts` constructs and returns the app/loop/desktop host | Add optional `i18n` input and readonly exact-instance output here |
| Modal seams | UI exposes `ModalDialogHost`; Forms and Files accept narrow hosts | Add readonly `i18n` only where helpers mint framework text |
| Core | `@jsvision/core` is a zero-dependency terminal engine | Keep it entirely independent of localization |
| Consumer packages | UI depends on Core; Forms on UI; Files/Datagrid on Core+UI | Add direct `@jsvision/i18n` dependencies to packages that own messages |
| Tests | Vitest projects already separate `.spec.test.ts` and `.impl.test.ts` | Preserve immutable-oracle ordering |
| Plugin | `tools/jsvision-skill/` is canonical; distributed skill is generated | Edit canonical source, update impact mapping, then run generation/check |

## Existing user-facing literals

The initial high-value ownership seams are:

- UI: calendar month/week-day/Today text, switch On/Off, standard dialog buttons, message boxes,
  and editor dialogs.
- Forms: FormDialog default OK label.
- Files: open/save/change-directory dialog labels, file metadata, and package-owned errors.
- Datagrid: empty/filter/personalization text and default boolean Yes/No labels.

A checked literal-ownership manifest will classify remaining candidates as framework-owned,
developer-facing, or caller data. This avoids translating identifiers, data values, diagnostics, or
other developer-facing text accidentally.

## Upstream BlendSDK package

The supplied `/home/gevik/workdir/github/TrueSoftware/blendsdk-v5/packages/i18n` package provides
useful precedents for:

- ordered translation sources and merged translations;
- named interpolation and locale fallback;
- atomic replacement of translations;
- behavior-oriented tests.

It cannot be copied unchanged because it uses BlendSDK stdlib helpers, two-form plural tuples,
permissive/coercive parsing, and loader/content-source behavior outside the accepted JSVision
security and package boundaries. The port therefore reuses ideas and applicable test cases while
implementing JSVision's schema, `Intl.PluralRules`, strict JSON parser, bounded diagnostics, and
browser/Node export split independently.

## Build and package constraints

- Main `@jsvision/i18n` must have no runtime dependency and no reachable `node:*` import.
- `@jsvision/i18n/node` is the sole Node loader boundary.
- Ten locale families across four consuming packages require deterministic generation and export
  verification; handwritten repeated entry points would drift.
- Published files must include a third-party notice containing the upstream MIT notice.
