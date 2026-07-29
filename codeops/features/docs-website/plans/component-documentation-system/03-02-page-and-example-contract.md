# Specification: Standard Page and Example Contract

> **Requirements**: PR-2, PR-3, PR-4, PR-8
> **Decisions**: AR-3, AR-4, AR-5, AR-13, AR-14, AR-15, AR-19

## Objective

Turn the two `AGENTS.md` directives into executable documentation constraints without reducing page
quality to heading-count boilerplate.

## Page Contract

Every `standard` primary page must provide:

| Contract area | Structural evidence | Content evidence |
|---|---|---|
| Metadata | Frontmatter title and description; one H1 | Description names the component and primary purpose. |
| Overview | Introductory prose before the first code/live block | Explains use case, model/state, and important visible behavior. |
| Quick usage | A TypeScript fence near the top | Uses a public package entry and stays focused on normal construction. |
| Flagship example | `<PlayExample id="…">` resolving to the page's primary catalog example | Title/blurb tells the reader what to try and observe. |
| Props/public state | `## Props…` heading | Names exact exported option/public types, practical defaults, signals/getters, and interactions. |
| Size and Layout | `## Size…` heading | Covers intrinsic/minimum sizing, parent/layout behavior, clipping/wrapping/scrolling as applicable. |
| Component capabilities | At least one non-generic component-specific H2 where behavior warrants it | Teaches actual interaction, state, lifecycle, data, or composition behavior. |
| Best Practices | `## Best Practices` | Concrete advice with consequences, not generic filler. |
| Theming | `## Theming` | Exact roles/regions and contrast/fallback considerations. |
| Related/API | `## Related` | Valid related catalog links plus generated API link(s). |

Button, Input, and Text are checked against this contract but their accepted prose/example intent is
not rewritten merely to satisfy a parser.

## Specialist Page Profiles

Every specialist topic selects one enforceable profile in the catalog:

| Profile | Required backbone | Example rule |
|---|---|---|
| `landing` | Frontmatter, one H1, scope/choice guidance, focused public-entry quick start, capability map, flagship example, cross-cutting practices, Related/API links | Exactly one or more flagship examples near the top. |
| `capability` | Frontmatter, one H1, purpose/prerequisites, focused usage snippet, capability sections, page-local practices/limits, Related/API links | Every declared example appears beside the capability it teaches; one or more examples required. |
| `api` | Frontmatter, one H1, task-organized public symbol/API map, ownership boundaries, generated API links, Related links | No live example required; an example is allowed only when it teaches API selection rather than duplicating a capability page. |

Profile checks require substantive introductory prose and focused snippets where the profile calls
for them. A page may document why a normally required section is not applicable, but it cannot pass
by silently omitting the teaching obligation.

## Focused Snippet Rules

Specification checks reject:

- imports from internal source paths;
- a whole demo-shell setup inside a teaching snippet;
- pasted full live-example modules;
- snippets whose only purpose is unrelated sample-data plumbing.

Judgment about clarity remains an author/reviewer responsibility; tests enforce objective signals,
not prose style by keyword.

Registry `sourcePath` values identify the separately compiled runnable modules. Markdown snippets are
authored independently and stay essence-only; neither the page tooling nor the build extracts a full
example module into Markdown.

## `template1` Runtime Contract

Every cataloged component example, including specialist examples, uses `kind: 'app'` and must, under
the standard 80×24 test viewport:

1. use `demoApp(ctx, { themeMenu: true })` with the default Classic theme;
2. add a real `Dialog` to `app.desktop`;
3. let JSVision auto-center it by specifying width/height without a positioned rect;
4. leave visible desktop margin on all sides;
5. use dialog padding `1`;
6. use the theme-controlled dialog surface that matches the Classic menu-bar background;
7. remain open unless close/reopen behavior is the lesson;
8. render the component's meaningful states and visible action feedback;
9. expose usable Alt-hotkeys and concise keyboard/mouse instructions;
10. avoid clipping at 80×24.

Button, Input, and Text already satisfy the runtime intent and are reference evidence rather than
rewrite targets.

## Staged Contract Applicability

The complete future catalog exists from Phase 1, so shared contract tests use cumulative,
requirements-owned delivery sets:

1. Phase 2 validates the Button/Input/Text references, the three specialist page profiles through
   controlled fixtures, and reusable page/runtime assertion helpers.
2. Each family or hub specification exports two separately typed immutable sets:
   `catalogEntryIds` for delivered component/topic rows and `exampleIds` for delivered runnable
   examples.
3. No intermediate phase requires future pages/examples to exist merely because their catalog rows
   already exist.
4. Phase 11 compares the union of `catalogEntryIds` with every catalog row ID and the union of
   `exampleIds` with the distinct catalog example IDs, then runs page/profile contracts over the
   former and runtime/behavior contracts over the latter.

There is no second delivery manifest and no implementation-derived applicability filter.

## Typed Behavior Contracts

Before an example module is implemented, its family/hub specification adds a checked-in contract
under `packages/docs-site/test/contracts/`. One coherent example may require several independently
resettable interaction cases. Every case covers named capabilities and contains explicit initial
expectations, a bounded action sequence, and executable expected-state probes:

```ts
type ObservableValue = string | number | boolean | null;

type ExampleAction =
  | {
      readonly kind: 'key';
      readonly key: string;
      readonly modifiers: readonly ('Alt' | 'Ctrl' | 'Shift')[];
    }
  | {
      readonly kind: 'mouse';
      readonly gesture: 'click' | 'double-click' | 'drag' | 'wheel';
      readonly at: { readonly x: number; readonly y: number };
      readonly button?: 'left' | 'middle' | 'right';
      readonly to?: { readonly x: number; readonly y: number };
      readonly delta?: number;
    };

type ProbeExpectation<Probe extends string> = {
  readonly probe: Probe;
  readonly operator: 'equals' | 'contains' | 'excludes' | 'greater-than' | 'less-than';
  readonly value: ObservableValue;
};

interface InteractionCase<Capability extends string, Probe extends string> {
  readonly id: string;
  readonly covers: readonly Capability[];
  readonly initial: readonly ProbeExpectation<Probe>[];
  readonly actions: readonly ExampleAction[];
  readonly expected: readonly ProbeExpectation<Probe>[];
  readonly reset: 'rebuild-example';
  readonly dispose: 'after-case';
}

interface ExampleBehaviorContract<Capability extends string, Probe extends string> {
  readonly exampleId: string;
  readonly capabilities: readonly Capability[];
  readonly cases: readonly InteractionCase<Capability, Probe>[];
}
```

`ExampleAction` is the discriminated key/mouse union: key actions require one non-empty key and a
canonical, duplicate-free modifier list; mouse actions require non-negative coordinates; `drag`
alone requires `button` and `to`, while `wheel` alone requires a non-zero integer `delta`.
Inapplicable fields are rejected.

Each case contains one to six primitive actions. Tests rebuild the example before the case, prove
every initial expectation, dispatch the actions in order, prove every expected probe, and dispose
afterward. Standard probes cover rendered text, focus, dialog geometry, and theme roles; each family
may add a closed literal union of public-state probes with typed readers. Operators are validated
against value type.

Validators require unique contract/case IDs, non-empty cases/actions/expectations, exact parity
between the objective's declared capabilities and the union of case `covers` values, and exact
parity with the cumulative `exampleIds` set. A lab is split into separate examples only when its
capabilities are no longer one coherent lesson or cannot remain deterministic within six actions.
Implementers never translate free-form prose into the specification oracle.

## Reusable Example Test Harness

Extend `test/example-lab-harness.ts` with an assertion helper returning:

```ts
interface Template1Evidence {
  readonly dialogRect: Rect;
  readonly viewport: Size2D;
  readonly frameLines: readonly string[];
  readonly dialogInterior: readonly string[];
}
```

The helper paints the real example and verifies shell/menu/status presence, desktop margins, centered
geometry, padding, dialog surface role, and unclipped frame. Component-specific spec tests then assert
states and interactions using the returned evidence.

It must not infer conformance from source strings such as “`new Dialog`”; behavior is verified from
the real application tree/render and dispatched input.

## Multiple Examples

- The page's flagship example appears near the top.
- Additional examples appear beside the component-specific prose they teach.
- Each example ID has one learning objective.
- Closely related comparative states can share one lab.
- Duplicate examples with only different fixture data are rejected in review, not through brittle
  automated similarity scoring.

## Accessibility, Security, and Loading

- `<PlayExample>` keeps labelled keyboard-operable controls and DOM prose/source.
- Example content stays behind the existing sanitization boundary.
- Dynamic imports remain per example; merely rendering a page must not load or mount every example.
- File examples use virtual data; Code Editor LSP examples use bounded in-process seams.

## Files

| File | Change |
|---|---|
| `packages/docs-site/test/component-pages.spec.test.ts` | Required page backbone, catalog/example bindings, no Coming Soon, stale routes. |
| `packages/docs-site/test/component-pages.impl.test.ts` | Markdown/frontmatter/heading parser edge cases. |
| `packages/docs-site/test/template1-examples.spec.test.ts` | Shared behavioral contract over every applicable example. |
| `packages/docs-site/test/template1-examples.impl.test.ts` | Harness geometry/diagnostic edge cases. |
| `packages/docs-site/test/example-lab-harness.ts` | Reusable runtime evidence helper. |
| `packages/docs-site/test/contracts/` | Shared typed behavior schema plus immutable family/hub contract modules. |

## Verification

- Specification: ST-9 through ST-17, ST-29, ST-30.
- Focused: `yarn workspace @jsvision/docs-site test component-pages template1-examples`
- Final: `yarn verify`
