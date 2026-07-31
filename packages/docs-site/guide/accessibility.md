---
title: Accessibility & resilient interaction
description: Build keyboard-complete focus workflows with non-color and monochrome cues that survive ASCII fallbacks and reduced geometry.
---

# Accessibility & resilient interaction

## Who is this course for?

This course is for developers who can already assemble a JSVision application and now need every
important task to remain understandable and operable across input methods, terminal capabilities,
and viewport sizes. Complete [Views & focus](/guide/views-and-focus),
[Keyboard & clipboard](/guide/keyboard-and-clipboard), and
[Theming & colour depth](/guide/theming-and-colour-depth) first.

By the end you can **build** a keyboard-complete workflow, **explain** how focus and command
discovery fit together, **diagnose** colour-only, clipped, or unreachable states, and **verify** the
same task across keyboard, monochrome, ASCII, narrow, and browser-host evidence.

The beginner boundary is a complete focus route with visible actions. The intermediate boundary is
command discovery, pointer parity, non-colour semantics, and responsive geometry. Advanced work is
platform testing, assistive-technology evaluation, host integration, and production audit evidence.
The motivating problem is a deployment form that looks obvious with a mouse and rich colour but
becomes unusable when its primary action is clipped, its focus ring disappears in monochrome, or its
shortcut belongs to the browser.

## What is the resilient-interaction mental model?

Treat interaction as a task graph, then verify every edge:

```text
discover action -> reach control -> perceive focus -> activate command -> perceive outcome
                         |                |
                  keyboard/pointer   colour-independent cue
```

Every action in a required task or workflow needs a keyboard path without a mouse. A visible label,
menu item, instruction, or help surface makes the action discoverable. Focus identifies the current
target. A shared command gives keyboard and pointer activation the same outcome. Persistent text or
a glyph carries success, warning, and error meaning independently of colour.

Resilience adds a second axis:

| Axis     | Question to verify                                                  |
| -------- | ------------------------------------------------------------------- |
| Input    | Can keyboard and pointer users complete the same task?              |
| Focus    | Is the current target both reachable and visibly distinct?          |
| Colour   | Does state survive monochrome and `NO_COLOR`?                       |
| Glyphs   | Does meaning survive ASCII-safe fallback?                           |
| Geometry | Are essential actions and recovery instructions still reachable?    |
| Host     | Which keys and semantics does the terminal or browser actually own? |

Passing one row does not prove another. A working Alt shortcut does not prove a logical Tab order;
an attractive monochrome theme does not prove the browser exposes semantic HTML or ARIA.

## How do I get the first keyboard-complete result?

Start with normal focusable controls in document order. Mark a visible accelerator in the label and
give the primary action an ordinary activation path:

```ts
import { Button, Group, Text, at, createApplication, signal } from '@jsvision/ui';

const actions = new Group();
const outcome = signal('ready');
const save = new Button('~S~ave', { onClick: () => outcome.set('PASS: saved') });
const cancel = new Button('~C~ancel', { onClick: () => outcome.set('cancelled') });

actions.add(at(save, 0, 0, 12, 2));
actions.add(at(cancel, 14, 0, 12, 2));
actions.add(at(new Text(() => outcome()), 0, 3, 26, 1));
const app = createApplication({ content: actions });
```

`Tab` and `Shift+Tab` follow retained tree or document order. `Alt+S` activates Save, while Space
activates whichever button owns focus. The tilde markers are authoring syntax: the visible label is
“Save,” and the marked letter is its accelerator.

Do not stop at “the controls accept keys.” Test the task from its start state to its complete
workflow outcome with keyboard only. The result must also be visible in text or shape rather than
only as a colour change.

## Laboratory: keyboard-complete interaction

Use Tab and Shift+Tab to move between enabled actions; the disabled action is skipped. Press F12 to
reveal accelerators, then A, or use Alt+A directly. Click Activate to compare the pointer route. The
focus label, bracketed state markers, and PASS result make each observation independent of colour.

<PlayExample id="guides/accessible-interaction"
  title="Keyboard-complete interaction laboratory"
  blurb="Traverse focus, reveal and activate a shortcut, then click the same action to verify discoverable non-color feedback and pointer parity." />

Resize, maximize, and restore the window. The complete instruction and the primary action must
remain visible; the disabled control must never enter the focus route.

## How do I design a complete focus route?

Begin with the task, not with a list of key names. Write each required step and identify its entry
control, forward and backward route, activation, outcome, error correction, and exit. Every
workflow action must be reachable without a mouse.

The event loop exposes exact focus operations:

```ts
import { Group, createEventLoop } from '@jsvision/ui';

const root = new Group();
const loop = createEventLoop({ width: 80, height: 24 });
loop.mount(root);
loop.focusNext(); // Tab: next eligible leaf in document/tree order
loop.focusPrev(); // Shift+Tab: previous eligible leaf
const focused = loop.getFocused();
```

Disabled, hidden, and unmounted views are ineligible and must be skipped. If the focused view becomes
disabled, hidden, or unmounted, move focus to the nearest logical continuation instead of leaving an
invisible focus target.

For composite content, enter its focusable subtree deliberately:

```ts
import { Group, createEventLoop } from '@jsvision/ui';

const editorGroup = new Group();
const loop = createEventLoop({ width: 80, height: 24 });
loop.mount(editorGroup);
loop.focusInto(editorGroup);
```

A modal dialog must confine or contain focus inside its active scope. Save the previously focused
control before opening; after the modal closes, restore that exact eligible control or a documented
fallback. This avoids dropping the learner at the beginning of a long form.

Controls also have different local interaction models. Space activates a focused Button; an
unconsumed Enter activates only a Button marked as the default. Arrow keys navigate or change
selection within lists, menus, tabs, grids, and similar composites. Do not turn every arrow key into
global focus traversal; preserve the owning control's documented behavior.

## How do users discover commands?

An available command is not discoverable merely because a keymap knows it. Put frequent actions in
visible controls, menus, a status line, concise instructions, or contextual help. Use `~S~ave` to
mark a button or menu accelerator and explain `Alt+S` near the first workflow.

F12 is the default `revealKey`. It reveals or underlines accelerators; while the mode is armed, a
bare letter activates the same accelerator:

```ts
import { createApplication } from '@jsvision/ui';

const app = createApplication({ revealKey: 'f12' });
app.loop.setAcceleratorMode(true);
```

Call `setAcceleratorMode(false)` when a custom surface dismisses discovery. An open menu manages its
own accelerator scope.

Duplicate accelerator collision is a scope problem: two co-visible actions in the same active scope
must not claim the same hotkey. Inventory the visible labels for each window and modal, including
localized variants.

Browser and OS hosts may reserve or consume an F-key, Tab, Alt, Ctrl, or other chord before the
terminal receives it. Supply a visible menu, control, or alternative fallback when a reserved key is
unavailable. Never make an unreclaimable chord the only path to a required task.

## How do I make focus and state visible without colour?

A focused control needs a border, caret, marker, underline, label, reverse attribute, or other cue
that is independent of colour. Colour may reinforce the cue; colour alone is insufficient and must
never carry the only distinction.

Give every meaningful state a textual or shaped equivalent:

| State    | Durable cue examples                        |
| -------- | ------------------------------------------- |
| Focused  | `>` marker, caret, labelled focus readout   |
| Selected | `[x]`, `SELECTED`, reverse attribute        |
| Checked  | `[x]` / `[ ]`                               |
| Expanded | `[-]` / `[+]`, `expanded` / `collapsed`     |
| Disabled | `DISABLED`, dim attribute, unavailable text |
| Error    | `ERROR`, `!`, correction text               |

Theme roles are semantic rather than decorative. Roles such as `buttonFocused`, `listFocused`,
`inputSelected`, and `dangerText` map a state to a theme role; the widget still needs semantic
content that survives a profile where colours collapse.

```ts
import { Button, Text, signal } from '@jsvision/ui';

const failed = signal(false);
const retry = new Button('~R~etry');
const status = new Text(() => (failed() ? 'ERROR: retry required' : 'PASS: saved'));
```

Visible focus or another focus cue must survive every supported colour depth, theme, and capability
profile. Likewise, status feedback for success, warning, or error needs a word, marker, or other
non-colour cue.

## How do pointer and keyboard paths stay equivalent?

Route mouse or pointer and keyboard activation to the same command or domain operation. Parity means
the same outcome, validation, authorization, feedback, and cleanup—not identical physical gestures.
A pointer reaches the same command and same outcome as the keyboard.

```ts
import { Button, createApplication, signal } from '@jsvision/ui';

const outcome = signal('ready');
const app = createApplication();
app.onCommand('document.save', () => outcome.set('PASS: saved'));
const save = new Button('~S~ave', { command: 'document.save', default: true });
```

The Button emits `document.save` for a click, Space while focused, its Alt accelerator, and an
unconsumed Enter when it is the default. Avoid separate handlers that drift into different
validation or feedback.

Drag, hover, and wheel may improve a workflow, but they are not required input. Provide a keyboard
alternative or equivalent command—for example move commands beside drag-and-drop, explicit detail
opening beside hover, and page/navigation keys beside wheel scrolling.

## Laboratory: resilient presentation

Press Alt+P repeatedly to compare Classic, `NO_COLOR`, Monochrome, ASCII, and Narrow evidence. Each
profile retains FOCUSED, SELECTED, DISABLED, ERROR, and PASS text while the chrome and capability
description change.

<PlayExample id="guides/resilient-presentation"
  title="Resilient presentation laboratory"
  blurb="Cycle NO_COLOR, monochrome, ASCII, and narrow geometry and verify that labelled focus, state, actions, and recovery meaning remain intact." />

This is a deterministic comparison of public capability APIs. It does not mutate the visitor's host
terminal or claim that a browser canvas supplies assistive-technology semantics.

## What does NO_COLOR change?

`resolveCapabilities()` treats the presence of `NO_COLOR`—with any value, including the empty
string—as an instruction to use mono or monochrome colour depth. It overrides `FORCE_COLOR`.

```ts
import { resolveCapabilities } from '@jsvision/core';

const result = resolveCapabilities({
  env: { NO_COLOR: '', FORCE_COLOR: '3', TERM: 'xterm-256color' },
  platform: 'linux',
});

result.profile.colorDepth; // "mono"
```

`NO_COLOR` concerns colour output. It does not independently force ASCII glyphs, remove Unicode
text, redesign geometry, or prove contrast. Test those axes separately.

The public `monochromeTheme` keeps semantic roles achromatic and differentiates states through
attributes such as reverse, underline, bold, and dim:

```ts
import { monochromeTheme } from '@jsvision/core';

const focusedAttrs = monochromeTheme.buttonFocused.attrs;
const normalAttrs = monochromeTheme.button.attrs;
const shortcutAttrs = monochromeTheme.buttonShortcut.attrs;
```

Attribute differences are terminal-dependent evidence, so retain textual markers for important
state even when reverse and underline work.

## How do monochrome and ASCII fallbacks preserve meaning?

Full degradation is an explicit capability transformation:

```ts
import { degradeCapsFully, resolveCapabilities } from '@jsvision/core';

const rich = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const ascii = degradeCapsFully(rich);
// boxDrawing=false, halfBlocks=false, ambiguousWide=true: use ASCII-safe chrome.
```

Use `fallbackGlyph()` at a glyph boundary instead of scattering ad hoc replacements:

```ts
import { degradeCapsFully, fallbackGlyph, resolveCapabilities } from '@jsvision/core';

const rich = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const ascii = degradeCapsFully(rich);
const vertical = fallbackGlyph('│', ascii); // "|"
const horizontal = fallbackGlyph('─', ascii); // "-"
const block = fallbackGlyph('█', ascii); // "#"
```

Verify the resulting profile rather than inferring safety from one sample:

```ts
import { degradeCapsFully, isAsciiSafe, resolveCapabilities } from '@jsvision/core';

const rich = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const ascii = degradeCapsFully(rich);
if (!isAsciiSafe(ascii)) throw new Error('Expected an ASCII-safe profile');
```

Borders, arrows, blocks, and markers need an ASCII fallback, but glyph substitution alone is not the
meaning. Keep `PASS`, `WARN`, `ERROR`, `SELECTED`, and `FOCUSED` text or ASCII markers so the result
remains understandable without colour.

`JSVISION_ASCII` is independent from `NO_COLOR`: its presence requests ASCII-safe chrome and avoids
the width probe, while colour depth may remain rich. Test the two environment choices independently
and together.

## How do I design for reduced geometry?

A reduced or narrow terminal geometry is a prioritization problem, not a desktop layout scaled down.
Keep the current task, primary action, focus cue, feedback, and recovery instruction first; disclose
or defer secondary decoration and detail progressively.

Responsive composition should wrap, reflow, or stack controls, instructions, and labels before they
clip or truncate. If content still exceeds the viewport, put secondary content in a documented
scrollable region rather than allowing it to cover actions.

```ts
import { Button, Text, col, row } from '@jsvision/ui';

const actions = row(new Button('~S~ave'), new Button('~C~ancel'));
const narrowBody = col(new Text('ERROR: fix the name'), actions);
```

Define a real minimum usable size. When the viewport is too small or insufficient, show a concise
diagnostic message with a recovery action such as “resize to at least 48×14”; do not render a
half-visible workflow.

Keyboard focus remains reachable and usable after a narrow resize. Never hide or clip the only
action, the focused control, essential instructions, or result feedback.

## What can a browser documentation terminal prove?

A browser documentation terminal or xterm-based lab can prove deterministic cell rendering,
keyboard events delivered to the terminal, focus movement inside the application tree, pointer
events, and resize behavior. Those are useful integration facts.

It cannot prove screen reader or assistive technology behavior in a native terminal. A cell canvas
is not semantic HTML; DOM and ARIA ownership belongs to the
documentation host and is outside the JSVision cell tree unless the host supplies a separate
semantic layer.

Browser or OS reserved shortcuts may be consumed before JSVision sees them. Key reclamation should
operate only while the terminal is focused, not across the unfocused page. Treat reclaimable and
unreclaimable shortcut lists as host policy evidence, then keep an alternate visible command path.

Production verification therefore combines automated browser evidence with manual platform and
assistive-technology testing. Record the browser, OS, terminal, keyboard layout, screen reader or
other assistive tool, exact workflow, and observed result. A demo must never claim “fully
accessible,” automatic WCAG compliance, or screen-reader compatibility from cell tests alone.

## How do I compose resilient interaction across an application?

Use one interaction contract across screens:

1. Define required task commands and their authorization.
2. Expose each command through visible controls or menus.
3. Assign collision-free accelerators within each active scope.
4. Establish forward, backward, modal-entry, and restoration focus routes.
5. Publish textual state and error feedback.
6. Reflow essentials for the supported minimum geometry.
7. Verify capability and host matrices.

Own resources with the view or application lifetime that creates them. Acquisition and cleanup
belong together:

```ts
import { Group } from '@jsvision/ui';

const panel = new Group();
panel.onMount(() => {
  const timer = setInterval(() => panel.invalidate(), 1_000);
  panel.onCleanup(() => clearInterval(timer));
});
```

Use `dispose()` or `onCleanup()` for timers, subscriptions, listeners, and host resources. Cleanup
must be idempotent, and stale async work must check that its owner is still active before changing
focus or feedback.

When a workflow spans a modal, async operation, or route change, preserve the semantic command and
feedback even though the focus scope and geometry change. Restore focus only to a still-mounted,
eligible target.

## What belongs in advanced accessibility work?

Advanced work is evidence about real users and hosts, not extra decoration:

- Test native terminals, browser hosts, platforms, keyboard layouts, input methods, and assistive
  technologies named in the support policy.
- Review contrast and attributes in every shipped theme and colour depth, including focused,
  selected, disabled, warning, and error roles.
- Localize labels and accelerators together; re-run collision checks and narrow-geometry tests for
  long translations and wide glyphs.
- Measure task completion and error recovery with representative users.
- Define safe host authorization for clipboard, files, network, and other privileged alternatives.
- Retain bounded, redacted evidence. Never log pasted content, secrets, or raw terminal responses.

An automated matrix can prevent regressions, but it does not replace manual observation. State the
scope and date of each compatibility result; do not turn an informational measurement into a
guarantee.

## How do I diagnose accessibility failures?

Use symptom → cause → correction → evidence so similar failures do not collapse into guesswork:

| Symptom            | Likely cause                            | Correction                                      | Distinguishing evidence                    |
| ------------------ | --------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Focus lost         | Target hidden, disabled, or unmounted   | Move to logical eligible continuation           | `getFocused()` plus mounted/disabled state |
| Invisible focus    | Focused role collapsed with normal role | Add text/shape/attribute cue                    | Rendered cells across theme/depth matrix   |
| Shortcut collision | Duplicate accelerator in active scope   | Reassign or separate scope                      | Co-visible accelerator inventory           |
| Colour-only result | State encoded only by palette           | Add `PASS`, `WARN`, `ERROR`, or shaped marker   | Monochrome frame comparison                |
| Clipped action     | Fixed desktop geometry in narrow view   | Reflow priorities or declare a usable minimum   | Resize test plus solved bounds             |
| Browser key absent | Browser or OS consumed the chord        | Provide visible alternative and focused reclaim | Host key trace and manual test             |
| Stale focus jump   | Async callback outlived its owner       | Cancel or guard work and clean up with owner    | Lifecycle trace after disposal             |

Diagnose ownership first. A visible control with no action is a command-routing failure; an action
that works only by mouse is an interaction-path failure; an action outside the viewport is a layout
failure. Capture bounded facts at the owning boundary instead of logging raw input.

## What are the best practices?

- Audit complete tasks rather than counting keys. A shortcut inventory misses unreachable error and
  recovery paths.
- Keep tree order aligned with reading and task order. Arbitrary focus jumps make both forward and
  backward traversal unpredictable.
- Use shared commands for keyboard and pointer parity. Separate handlers drift in validation,
  authorization, feedback, and cleanup.
- Pair colour with text, shape, or attributes. Palette collapse otherwise erases state.
- Treat narrow geometry as information priority. Shrinking fixed coordinates clips the exact action
  a user needs.
- Keep required commands visibly discoverable. Hidden shortcuts exclude newcomers and fail when a
  host reserves the chord.
- Test explicit capability profiles and real supported hosts. Auto-detection on one development
  terminal is not compatibility evidence.
- Acquire and clean up listeners, timers, and async owners together. Stale work can steal focus or
  announce an obsolete result.

For each release, maintain an audit matrix with rows for required workflows and columns for keyboard,
focus visibility, monochrome, ASCII, geometry, browser, native host, and manual assistive evidence.
Record a result only for the environment actually tested.

## What should I practice next?

Try these exercises or experiments:

1. Complete one real form from first focus to success and from validation error to correction using
   keyboard only. Repeat backward with Shift+Tab.
2. Disable the currently focused action. Verify focus moves to a logical target and remains visible.
3. Run the same screen with `NO_COLOR`, then an ASCII-safe profile. Inventory every state whose
   meaning disappears.
4. Resize the viewport one cell at a time. Confirm the focused control, primary action, instruction,
   and feedback never overlap or clip.
5. Compare a browser documentation terminal with a supported native terminal. Record which keys the
   browser or OS reserves and verify every required task has an alternative.
6. Perform a manual assistive-technology test and state exactly what it proves; do not infer semantic
   compatibility from screenshots.

Revisit [Views & focus](/guide/views-and-focus) for focus scopes,
[Keyboard & clipboard](/guide/keyboard-and-clipboard) for host boundaries, and
[Theming & colour depth](/guide/theming-and-colour-depth) for role-driven colour degradation. For
production lifecycle evidence, continue with [Crash safety](/guide/crash-safety) and
[Displaying untrusted text safely](/guide/untrusted-text).

Public API:

- [`createApplication()`](/api/ui/functions/createApplication)
- [`createEventLoop()`](/api/ui/functions/createEventLoop)
- [`degradeCapsFully()`](/api/core/functions/degradeCapsFully)
- [`fallbackGlyph()`](/api/core/functions/fallbackGlyph)
