/**
 * Story: `createRouter` + `@jsvision/forms` (GH #26 / #91) — a multi-step **wizard**.
 *
 * The router is the whole canvas: three screens (`account` → `prefs` → `review`) driven by
 * `push`/`back`, with **one shared form** spanning them all. Each step's **Next** button is greyed
 * until that step validates — the exact "gate the next action on step validity" idiom — and the
 * Account/Preferences screens are `keepAlive`, so values entered on step 1 survive a Back round-trip
 * from the review screen. A live line above the router echoes the current step and whether Next is
 * enabled.
 *
 * Because a story is embedded in the shell's content pane (the shell owns the menu/status chrome),
 * the step gate is shown on the in-body Next button via a reactive `disabled` getter rather than on a
 * status item; the `wizard-demo` walkthrough shows the same gate driving the shared status bar.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Input, Switch, RadioGroup, CheckGroup, Button, Label, createRouter, signal } from '@jsvision/ui';
import type { ScreenBundle } from '@jsvision/ui';
import { createForm, bindField, bindRadio, bindCheck } from '@jsvision/forms';
import { z } from 'zod';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** The wizard's three screens, one per step; none carry params (`void`). */
type Routes = { account: void; prefs: void; review: void };

/**
 * The showcase's wizard story: a shared `createForm` driving three `createRouter` screens, each step's
 * Next greyed until it validates, `keepAlive` steps, and a review→submit finish.
 *
 * @example
 * import { STORIES } from './stories/index.js';
 * const story = STORIES.find((s) => s.id === 'navigation/wizard');
 * const group = story!.build({ caps, width: 72, height: 16 }); // a Group ready for the shell to place
 */
export const wizardStory: Story = {
  id: 'navigation/wizard',
  category: 'Navigation',
  title: 'Router — Wizard',
  blurb:
    'createRouter + @jsvision/forms: a 3-step wizard sharing one form, Next greyed until each step validates, keepAlive-preserved values, and a review + submit.',
  build(ctx: StoryContext) {
    const schema = z.object({
      name: z.string().min(1, 'Required'),
      email: z.string().email('Enter a valid email'),
      mode: z.enum(['Dev', 'Staging', 'Prod']),
      features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
      tls: z.boolean(),
    });
    // The empty feature list is annotated so `bindCheck`'s domain inference stays exact — a bare `[]`
    // would infer a degenerate element type.
    const form = createForm({
      schema,
      initial: { name: '', email: '', mode: 'Dev', features: [] as Array<'Logs' | 'Metrics' | 'Tracing'>, tls: false },
    });
    const nameField = form.field('name');
    const emailField = form.field('email');
    const modeField = form.field('mode');
    const featuresField = form.field('features');
    const tlsField = form.field('tls');

    // Per-step validity — read live (independent of touched); each gates its own step's Next button.
    const accountValid = (): boolean => nameField.error() === null && emailField.error() === null;
    const prefsValid = (): boolean =>
      modeField.error() === null && featuresField.error() === null && tlsField.error() === null;

    const submitted = signal('');

    // The route closures call back into `router` on click — deferred, so they run only after it exists.
    const buildAccount = (): ScreenBundle => {
      const nameInput = new Input({ value: nameField.value });
      const emailInput = new Input({ value: emailField.value });
      bindField(nameField, nameInput);
      bindField(emailField, emailInput);
      const next = new Button('Next', { disabled: () => !accountValid(), onClick: () => router.push('prefs') });
      const screen = new Group();
      screen.background = 'window';
      screen.add(at(new Text('Step 1 of 3: Account'), 1, 0, 40, 1));
      screen.add(at(new Label('~N~ame', nameInput), 1, 2, 8, 1));
      screen.add(at(nameInput, 10, 2, 26, 1));
      screen.add(at(new Label('~E~mail', emailInput), 1, 4, 8, 1));
      screen.add(at(emailInput, 10, 4, 26, 1));
      screen.add(at(next, 1, 6, 12, 2));
      return { view: screen };
    };

    const buildPrefs = (): ScreenBundle => {
      const modeRadio = new RadioGroup({
        labels: ['~D~ev', '~S~taging', '~P~rod'],
        value: bindRadio(modeField, ['Dev', 'Staging', 'Prod']),
      });
      const featuresCheck = new CheckGroup({
        labels: ['~L~ogs', '~M~etrics', '~T~racing'],
        value: bindCheck(featuresField, ['Logs', 'Metrics', 'Tracing']),
      });
      const tlsSwitch = new Switch({ value: tlsField.value, label: 'TLS', onLabel: 'On', offLabel: 'Off' });
      const back = new Button('Back', { onClick: () => router.back() });
      const next = new Button('Next', { disabled: () => !prefsValid(), onClick: () => router.push('review') });
      const screen = new Group();
      screen.background = 'window';
      screen.add(at(new Text('Step 2 of 3: Preferences'), 1, 0, 40, 1));
      screen.add(at(new Label('~M~ode', modeRadio), 1, 2, 8, 1));
      screen.add(at(modeRadio, 1, 3, 16, 3));
      screen.add(at(new Label('~F~eatures', featuresCheck), 22, 2, 12, 1));
      screen.add(at(featuresCheck, 22, 3, 18, 3));
      screen.add(at(tlsSwitch, 1, 7, 20, 1));
      screen.add(at(back, 1, 9, 12, 2));
      screen.add(at(next, 15, 9, 12, 2));
      return { view: screen };
    };

    const buildReview = (): ScreenBundle => {
      const row = (label: string, value: () => string): Text => new Text(() => `${label.padEnd(10)}${value()}`);
      const raw = (): ReturnType<typeof form.rawValues> => form.rawValues();
      const result = new Text(() => (submitted() ? `✓ Submitted: ${submitted()}` : ''));
      const back = new Button('Back', { onClick: () => router.back() });
      const submit = new Button('Submit', {
        default: true,
        onClick: () => {
          void form.submit((values) => submitted.set(JSON.stringify(values)));
        },
      });
      const screen = new Group();
      screen.background = 'window';
      screen.add(at(new Text('Step 3 of 3: Review'), 1, 0, 40, 1));
      screen.add(
        at(
          row('Name:', () => raw().name),
          1,
          2,
          44,
          1,
        ),
      );
      screen.add(
        at(
          row('Email:', () => raw().email),
          1,
          3,
          44,
          1,
        ),
      );
      screen.add(
        at(
          row('Mode:', () => raw().mode),
          1,
          4,
          44,
          1,
        ),
      );
      screen.add(
        at(
          row('Features:', () => raw().features.join(', ')),
          1,
          5,
          44,
          1,
        ),
      );
      screen.add(
        at(
          row('TLS:', () => (raw().tls ? 'On' : 'Off')),
          1,
          6,
          44,
          1,
        ),
      );
      screen.add(at(back, 1, 8, 12, 2));
      screen.add(at(submit, 15, 8, 12, 2));
      screen.add(at(result, 1, 11, 60, 1));
      return { view: screen };
    };

    const router = createRouter<Routes>({
      initial: { name: 'account' },
      routes: {
        account: { keepAlive: true, build: buildAccount },
        prefs: { keepAlive: true, build: buildPrefs },
        review: { build: buildReview },
      },
    });

    const currentValid = (): boolean => {
      switch (router.location().name) {
        case 'account':
          return accountValid();
        case 'prefs':
          return prefsValid();
        default:
          return true;
      }
    };

    const g = new Group();
    g.add(
      at(
        new Text(() => {
          const name = router.location().name;
          const step = name === 'account' ? 1 : name === 'prefs' ? 2 : 3;
          return `step ${step}/3: ${String(name)}   ·   ${currentValid() ? 'Next enabled' : 'Next greyed until this step validates'}`;
        }),
        1,
        0,
        ctx.width - 2,
        1,
      ),
    );
    g.add(at(router, 1, 2, ctx.width - 2, ctx.height - 3));
    return g;
  },
};
