---
title: Theming & colour depth
description: Author semantic themes and exact component roles, audit concrete contrast, switch live applications, and preserve meaning through colour-depth and monochrome fallbacks.
---

# Theming & colour depth

## Who is this course for?

This course is for developers who can already assemble a JSVision application and now need its
visual language to remain coherent across controls, states, terminals, and user-supplied themes. It
assumes the shell ownership and lifecycle model from
[The application shell](/guide/application-shell). You do not need prior color-science knowledge.

By the end you can build a complete semantic theme, explain how a component chooses an exact role,
diagnose contrast and degraded-capability failures, and verify that focused, selected, disabled, and
error states retain meaning from truecolor through monochrome. The motivating problem is not “pick
some attractive hex values.” It is “make the whole application communicate the same state after its
palette has been compressed or removed.”

The beginner boundary is choosing a preset or generating a theme and applying it. Intermediate work
maps component states to roles, audits concrete pairs, and switches themes without rebuilding
application state. Advanced work covers alias and role overrides, capability-owned downsampling,
attribute-driven monochrome design, safe theme import, and production test evidence.

## What is the theme mental model?

A `Theme` is plain, readonly data: a complete map of semantic names to a `ThemeRole`. Each role has
`fg` and `bg`, may add `hotkey` and `attrs`, and some structural roles add `pattern`, `border`,
`title`, or `icon`. `ThemeOptions` is the smaller seed-and-override input accepted by
`createTheme()`. A component requests a role because of meaning—`buttonFocused`, not “blue”—and the
active render root resolves that role for every cell it paints.

```text
seed colours
    │ createTheme()
    ▼
semantic aliases ── overrides ──► complete role map ── roleOverrides
                                            │
component state ── exact role name ─────────┘
                                            │
terminal capabilities ── serializer ──► ANSI + glyph output
```

Themes do not inherit at draw time, and controls do not guess substitute roles. `createTheme()`
expands seeds into a complete map before rendering. `app.setTheme()` replaces that map and
recomposes the retained tree. The serializer then encodes each resolved style for the host's
immutable capability profile.

Use `ctx.color(name)` when a custom widget needs the role's paintable `fg`, `bg`, and `attrs`. Use
`ctx.role(name)` when it also needs structural extras such as a window border or desktop pattern:

```ts
import type { DrawContext } from '@jsvision/ui';

function drawChrome(ctx: DrawContext): void {
  const body = ctx.color('window');
  const chrome = ctx.role('window');
  ctx.fill(' ', body);
  ctx.text(1, 0, 'Workspace', { fg: chrome.title, bg: body.bg });
}
```

## How do I create and apply my first theme?

Give `createTheme()` a mode and a resolvable accent. Pass the resulting complete theme at
application construction:

```ts
import { createTheme } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const theme = createTheme({
  mode: 'dark',
  accent: '#3b82f6',
});

const app = createApplication({ theme });
```

`mode` chooses which end of the neutral ramp supplies surfaces and text. `accent` drives focus and
selection roles. `accent` and `neutral` participate in color math, so both must resolve to RGB and
cannot be terminal `'default'`. Optional accelerator, menu-accelerator, danger, warning, success,
and info values are assigned directly to semantic aliases; the current API accepts `'default'`
there. A directly assigned default remains unmeasurable, so use a concrete color when you need a
portable contrast result.

Start with a shipped preset when its visual language already fits:

```ts
import { classicTheme, nordTheme } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const classic = createApplication({ theme: classicTheme });
const dark = createApplication({ theme: nordTheme });
```

`classicTheme` is the render-root default and an alias of `defaultTheme`. Other named presets are
independent exports, so importing one does not require a runtime preset registry.

## Laboratory: semantic roles and states

<PlayExample id="guides/theme-role-states" title="Semantic Theme Roles Laboratory" blurb="Map exact semantic roles to normal, focused, selected, and disabled states; switch the real application theme; and audit a concrete contrast pair without losing lesson state." />

Try Alt+R to check the displayed role relationships, Alt+C to audit `staticText`, and Alt+T to
switch the complete application between Classic and a generated dark theme. Use the same buttons
with the mouse. Notice that the dialog, shell, state strip, and controls repaint together while the
switch counter remains mounted.

## How do I choose exact semantic roles?

Choose a role from the component's actual state model. Similar-looking roles are not
interchangeable: a normal button, focused button, selected list row, and disabled button carry
different meaning even if one palette happens to give two of them the same background.

| Region or state                              | Exact role or role family                                    | Required independent cue                                   |
| -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Desktop field                                | `desktop`                                                    | Pattern must have an ASCII-safe fallback                   |
| Menu normal / open                           | `menuBar`, `menuSelected`                                    | Title, open popup, and hotkey marker                       |
| Window active / inactive                     | `window`, `windowInactive`                                   | Border/title distinction and active ownership              |
| Dialog surface                               | `dialog`                                                     | Frame and title                                            |
| Button normal / focused / default / disabled | `button`, `buttonFocused`, `buttonDefault`, `buttonDisabled` | Focus, default action, and disabled behavior               |
| List normal / focused / selected             | `listNormal`, `listFocused`, `listSelected`                  | Focus cursor and persistent selection are different states |
| Input field / text selection                 | `inputNormal`, `inputSelected`, `inputSelection`             | Caret identifies field focus; selection identifies a range |
| Error / warning text                         | `dangerText`, `warningText`                                  | Error or warning label, not hue alone                      |
| Status normal / pressed                      | `statusBar`, `statusSelected`                                | Command label and pressed feedback                         |

The public `Theme` type is the complete source of role names. Keep a custom widget typed to that
surface:

```ts
import type { Theme } from '@jsvision/core';
import type { ThemeRoleName } from '@jsvision/ui';

function roleForRow(focused: boolean, selected: boolean): ThemeRoleName {
  if (focused) return 'listFocused';
  if (selected) return 'listSelected';
  return 'listNormal';
}

declare const theme: Theme;
theme[roleForRow(true, false)];
```

State precedence belongs to the component, not the theme. For example, a list can paint focused
before selected before normal. A theme supplies all three appearances; it cannot redefine that
behavioral order.

## How do seeds, aliases, and role overrides differ?

Generation has three levels:

1. Seeds create ramps and the initial semantic aliases.
2. `overrides` replaces an alias and therefore re-drives every role that consumes it.
3. `roleOverrides` is a surgical field-level patch for one named role after expansion.

Use an alias override when the semantic token is wrong across the application:

```ts
import { createTheme } from '@jsvision/core';

const theme = createTheme({
  mode: 'dark',
  accent: '#3b82f6',
  overrides: {
    accent: '#ff0000',
  },
});

theme.button.bg; // '#ff0000'
theme.listFocused.bg; // '#ff0000'
```

Use `roleOverrides` when one role needs a context-specific correction and related roles should stay
unchanged:

```ts
import { createTheme } from '@jsvision/core';

const theme = createTheme({
  mode: 'light',
  accent: '#3b82f6',
  roleOverrides: {
    buttonFocused: {
      hotkey: '#000000',
    },
  },
});
```

Do not spread a partial role over the whole theme yourself. The public helper keeps every generated
field and merges only present override fields. After either kind of override, rerun role-specific
contrast and state tests; local improvement can still collapse another state after depth reduction.

## How do I verify concrete contrast?

`contrastRatio()` measures two concrete, resolvable colors. It returns the WCAG ratio from 1 to 21
without modifying either color:

```ts
import { contrastRatio, createTheme } from '@jsvision/core';

const theme = createTheme({
  mode: 'dark',
  accent: '#3b82f6',
});

const role = theme.staticText;
const ratio = contrastRatio(role.fg, role.bg);
if (ratio < 4.5) {
  throw new Error('staticText needs stronger contrast');
}
```

Treat 4.5:1 for normal text and 3:1 for component boundaries or non-text indicators as practical
authoring targets. Audit the actual pairs your application paints—foreground on that role's
background, border on its surface, and hotkey on both normal and selected surfaces. A seed name or
hex value alone is not evidence.

The color `'default'` is unresolvable because the terminal chooses it. A pair involving it returns
`NaN`; skip that numeric result or report “cannot verify,” then test the rendered host. Do not turn
`NaN` into zero and call the theme a failure:

```ts
import { contrastRatio } from '@jsvision/core';

const ratio = contrastRatio('default', '#ffffff');
if (Number.isNaN(ratio)) {
  console.log('Cannot verify the terminal default numerically.');
}
```

An authored truecolor ratio is not a guarantee at 256 or 16 colors. Palette collapse can make two
previously distinct colors identical. Render and inspect the important state pairs under every
supported capability profile.

## How does theming integrate with an application?

`app.setTheme(theme)` swaps the active map and repaints the full retained tree in one coalesced
frame. It does not reconstruct views, reset focus, or clear application state:

```ts
import { classicTheme, monochromeTheme } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const app = createApplication({ theme: classicTheme });
let active = classicTheme;

app.onCommand('theme.toggle', () => {
  active = active === classicTheme ? monochromeTheme : classicTheme;
  app.setTheme(active);
});
```

Keep one registry of theme label, command, and value when menus, settings, and persisted preference
all select themes. For a preview dialog, retain the previously active theme so Cancel can restore it.
Acquire temporary preview subscriptions and remove them with the dialog owner.

The application theme owns shell and ordinary UI roles. Specialist surfaces can have an additional
theme contract: the Code Editor, for example, owns syntax-token and editor-state themes inside the
surrounding application. Follow the [Code Editor themes and fallbacks](/components/code-editor/themes-and-fallbacks)
course instead of copying its token roles into the application `Theme`.

## Laboratory: colour-depth degradation

<PlayExample id="guides/color-depth-fallbacks" title="Colour Depth Fallbacks Laboratory" blurb="Trace one authored accent through truecolor, 256-color, 16-color, and monochrome encoder evidence, then verify attribute and ASCII-safe cues without pretending to mutate the visitor's terminal." />

Press Alt+D three times to reach monochrome. The four colored blocks are labelled stand-ins derived
from the same public palette mapping used by the encoder; the visible `Depth` row is the selected
evidence profile, not a mutation of the mounted browser terminal. At mono, observe that the lesson
keeps `>` on the selected depth, renders that block with reverse attributes, and reports that no
colour codes are needed. Press Alt+A to compare box/block glyphs with their ASCII-safe output.

## How does rendering degrade across colour depths?

The resolved capability profile owns `colorDepth`. The renderer or serializer encodes every cell in
this order:

| Depth       | Output behavior                    | What can collapse                       |
| ----------- | ---------------------------------- | --------------------------------------- |
| `truecolor` | 24-bit `38;2` / `48;2` SGR         | Authored RGB is retained                |
| `256`       | Nearest xterm-256 palette slot     | Nearby RGB values may become one slot   |
| `16`        | Nearest normal or bright ANSI slot | Many accents and neutrals may merge     |
| `mono`      | No foreground/background color SGR | Every color-only distinction disappears |

The application reads a capability profile; it does not rewrite the theme:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const caps = resolveCapabilities({
  env: process.env,
}).profile;

const app = createApplication({ caps });
console.log(caps.colorDepth);
```

Do not manually downsample or quantize application colors before giving them to JSVision. Author
resolvable truecolor values and let the serializer use `caps.colorDepth`. Low-level encoders are
useful for deterministic tests and diagnostic tools:

```ts
import { ScreenBuffer, resolveCapabilities, serialize } from '@jsvision/core';

const caps = resolveCapabilities({
  override: { colorDepth: '16' },
}).profile;
const frame = new ScreenBuffer(1, 1, {
  fg: 'default',
  bg: 'default',
});
frame.set(0, 0, 'X', { fg: '#ff0000', bg: 'default' });
const ansi = serialize(frame, null, { caps });
```

Monochrome emits no colour codes, but `attrs` such as bold, dim, underline, and reverse still emit.
The `monochromeTheme` deliberately uses those attributes to distinguish normal, focused, selected,
and disabled roles:

```ts
import { Attr, monochromeTheme } from '@jsvision/core';

const normal = monochromeTheme.listNormal;
const focused = monochromeTheme.listFocused;

console.log(normal.fg === focused.fg); // true
console.log((focused.attrs ?? Attr.none) & Attr.reverse); // reverse cue
```

Running a color-oriented theme at mono does not invent new attributes. Preserve meaning with text,
glyph, border, attribute, or explicit labels such as “selected,” “focused,” “disabled,” and “error.”
Color may reinforce those states but must not be their only evidence.

Color depth and glyph support are separate capabilities. The serializer performs ASCII fallback
when box drawing, half blocks, ambiguous-width chrome, or UTF-8 is unavailable. Keep one logical
buffer; do not maintain a second ASCII layout:

```ts
import { fallbackGlyph, resolveCapabilities } from '@jsvision/core';

const caps = resolveCapabilities({
  override: {
    unicode: { utf8: false },
    glyphs: { boxDrawing: false, halfBlocks: false },
  },
}).profile;

fallbackGlyph('┌', caps); // '+'
fallbackGlyph('█', caps); // '#'
```

## What belongs in advanced theme design?

### Attribute and structural fields

Use `attrs` to add a non-color distinction, not as decoration pasted onto every role. Check combined
masks at mono. Preserve each structural field: `desktop.pattern`; `window` and `dialog`
border/title/icon; and `hotkey` where a role supports accelerator highlighting.

### Safe persistence and import

`serializeTheme()` writes a versioned, deterministic JSON envelope. `parseTheme()` validates the
complete exact role set, color syntax, attribute range, structural extras, and a printable
one-cell desktop pattern. It rejects missing or unknown roles and never returns a partial theme:

```ts
import { InvalidThemeError, parseTheme, serializeTheme } from '@jsvision/core';

declare const activeTheme: Parameters<typeof serializeTheme>[0];
const json = serializeTheme(activeTheme);

try {
  const restored = parseTheme(json);
  console.log(restored.desktop.pattern);
} catch (error) {
  if (error instanceof InvalidThemeError) console.error('Theme rejected');
}
```

Treat imported JSON as untrusted input. Keep validation at the parse boundary, report a bounded
error without echoing the payload, and retain the last valid active theme after rejection. The
parser uses JSON data, not executable code, and rejects control bytes in the desktop pattern.

### Production verification

Text snapshots prove labels and geometry but not colors. Inspect rendered cells for the exact
`fg`, `bg`, and `attrs` that matter, and serialize a small frame under explicit profiles:

```ts
import { Attr, encodeStyle, resolveCapabilities } from '@jsvision/core';

const mono = resolveCapabilities({
  override: { colorDepth: 'mono' },
}).profile;

const sgr = encodeStyle('#ff0000', '#0000ff', Attr.bold | Attr.underline, mono);
console.log(sgr); // attributes remain; colors do not
```

Test truecolor, 256, 16, and mono; Unicode and ASCII-safe glyph profiles; normal, focused, selected,
disabled, and error states; runtime theme switching; and compact geometry. For benchmarks or
compatibility claims, link the exact environment and evidence rather than presenting one terminal
snapshot as a guarantee.

## How do I diagnose theme failures?

| Symptom                                    | Likely cause                                                       | Correction                                                             | Distinguishing evidence                                                  |
| ------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| One custom widget ignores theme changes    | It painted literal colors or cached a resolved style               | Request the semantic role during draw and switch with `app.setTheme()` | Shell repaints while only that widget remains stale                      |
| Focus and normal look identical            | Wrong role, collapsed palette slots, or a color-only theme at mono | Verify state precedence and add an attribute, border, glyph, or label  | Role names differ; serialized colors or attrs reveal where they collapse |
| Contrast audit reports `NaN`               | A color is terminal `'default'`                                    | Report “cannot verify” and inspect the rendered host                   | Either `fg` or `bg` is unresolvable                                      |
| Good truecolor contrast fails at 16 colors | Downsampling merged the pair                                       | Choose seeds that survive supported depths or add non-color evidence   | Explicit 16-color render uses the same slot for both meanings            |
| Monochrome is blank or ambiguous           | State relied only on hue                                           | Use `monochromeTheme` or deliberate `attrs` plus textual cues          | Mono output contains attributes but no `38`/`48` color codes             |
| Borders or patterns disappear              | A role override dropped structural fields, or glyph caps degraded  | Use field-level `roleOverrides` and verify ASCII output                | Complete role has extras; fallback output uses `+`, `-`, `\|`, or `#`    |
| Imported theme is partial or unsafe        | Raw JSON was cast to `Theme`                                       | Use `parseTheme()` and retain the prior valid theme on error           | Parser rejects missing/unknown roles or control bytes                    |
| Theme mutation does not repaint            | A readonly theme object was bypassed instead of replaced           | Create a new complete theme and call `app.setTheme()`                  | A real setTheme call produces a new rendered frame                       |

When two symptoms look similar, inspect in this order: the component's chosen role name, the active
theme role value, the resolved capability profile, the rendered cell style, and the serialized
output. That sequence separates a behavioral state bug from a palette or host-capability issue.

## What are the best practices?

- Name visual decisions by semantic role. Literal colors inside components prevent coherent theme
  switching and make state audits incomplete.
- Generate a complete base before overriding. Alias overrides intentionally move a family;
  `roleOverrides` intentionally moves one role.
- Audit concrete foreground/background and structural pairs. A palette swatch does not prove the
  actual container/on-color combination.
- Test after downsampling. Passing truecolor contrast can still collapse at 256 or 16 colors.
- Design monochrome and ASCII behavior while designing the state, not after the color palette.
  Focus, selection, disabled, and error meaning need non-color evidence from the start.
- Treat capability profiles as host facts. A theme switch repaints; a depth change normally requires
  a host remount with a different immutable profile.
- Parse untrusted theme data with `parseTheme()` and keep the last valid theme active on failure.
- Acquire and release preview handlers, subscriptions, and modal work with the view that owns them.

## What should I practice next?

1. **Exercise — role inventory.** Pick one real screen. List every normal, focused, selected,
   disabled, warning, and error state; map each to the component's exact role; then verify the
   rendered cells use those names.
2. **Exercise — override boundary.** Change the accent alias and record every role that moves. Revert,
   apply one `roleOverrides` patch, and explain why the smaller blast radius is correct.
3. **Experiment — contrast collapse.** Audit a truecolor text pair, render it at 256 and 16 colors,
   and add a non-color cue if either palette makes the states indistinguishable.
4. **Experiment — mono and ASCII.** Run a focused/selected workflow with `monochromeTheme` and an
   ASCII-safe capability profile. Verify keyboard reachability, visible focus, labels, borders, and
   cleanup without referring to hue.
5. **Exercise — safe import.** Corrupt a serialized theme with a missing role, an unknown role, and a
   control-byte pattern. Verify each is rejected and the prior theme stays active.

Related material:

- [The application shell](/guide/application-shell) for application ownership and runtime switching;
- [Application](/components/application/application) for `theme`, `setTheme`, and lifecycle;
- [Button](/components/controls/button) for a concrete component-to-role mapping;
- [Code Editor themes and fallbacks](/components/code-editor/themes-and-fallbacks) for the specialist
  editor theme contract;
- [`createTheme`](/api/core/functions/createTheme) and
  [`ThemeOptions`](/api/core/interfaces/ThemeOptions);
- [`contrastRatio`](/api/core/functions/contrastRatio);
- [`Theme`](/api/core/interfaces/Theme) and [`ThemeRole`](/api/core/interfaces/ThemeRole);
- [`serializeTheme`](/api/core/functions/serializeTheme) and
  [`parseTheme`](/api/core/functions/parseTheme); and
- [`Application.setTheme`](/api/ui/interfaces/Application#settheme).
