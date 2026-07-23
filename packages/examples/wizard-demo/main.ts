/**
 * Navigation-router walkthrough — a narrated, headless console demo of a multi-step **wizard**: the
 * primary reference app for `@jsvision/ui`'s screen router driving a shared `@jsvision/forms` form
 * across three screens. Step 1 (Account) collects a name + email, Step 2 (Preferences) a mode /
 * feature set / TLS toggle, and Step 3 (Review) echoes the coerced values and submits.
 *
 * The showcase idiom is **step gating**: one `wizard.next` command is greyed until the current step
 * validates — an `effect` mirrors the current step's validity onto `enableCommand`, so emitting the
 * command while the step is invalid is silently **dropped** (the walkthrough proves navigation does
 * not advance). The Account and Preferences screens are `keepAlive`, and the whole flow shares one
 * form store, so a value entered on step 1 survives a Back round-trip from the review screen.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:wizard
 *
 * It builds a router as the application `content` body, mounts it through `createApplication`
 * (headless — no `run()`/TTY), registers the wizard's navigation commands, then drives the flow by
 * setting the form's field signals directly and emitting `wizard.next` / `wizard.submit` /
 * `wizard.back` — printing a composed ASCII frame after each step plus the gate's live state.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui` /
 * `@jsvision/forms`), exactly as a consumer would.
 */
import { resolveCapabilities } from '@jsvision/core';
import {
  Group,
  Text,
  Input,
  Switch,
  RadioGroup,
  CheckGroup,
  Button,
  Label,
  createApplication,
  createRouter,
  at,
  signal,
  effect,
  createRoot,
  statusLine,
  statusItem,
} from '@jsvision/ui';
import type { ScreenBundle } from '@jsvision/ui';
import { createForm, bindField, bindRadio, bindCheck } from '@jsvision/forms';
import { z } from 'zod';

/** The wizard's three screens, one per step; none carry params (`void`). */
type Routes = { account: void; prefs: void; review: void };

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

function main(): void {
  createRoot((dispose) => {
    void run(dispose).catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

async function run(dispose: () => void): Promise<void> {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

  // One shared form spans every step. `email` is validated as text; the enum/array/boolean fields are
  // edited directly. The raw `initial` carries the editing types (an empty, annotated feature list so
  // `bindCheck`'s domain inference stays exact — a bare `[]` would infer a degenerate element type).
  const schema = z.object({
    name: z.string().min(1, 'Required'),
    email: z.string().email('Enter a valid email'),
    mode: z.enum(['Dev', 'Staging', 'Prod']),
    features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
    tls: z.boolean(),
  });
  const form = createForm({
    schema,
    initial: {
      name: '',
      email: '',
      mode: 'Dev',
      features: [] as Array<'Logs' | 'Metrics' | 'Tracing'>,
      tls: false,
    },
  });

  const nameField = form.field('name');
  const emailField = form.field('email');
  const modeField = form.field('mode');
  const featuresField = form.field('features');
  const tlsField = form.field('tls');

  // Per-step validity — read live (independent of touched). Each gates its own step's Next action.
  const accountValid = (): boolean => nameField.error() === null && emailField.error() === null;
  const prefsValid = (): boolean =>
    modeField.error() === null && featuresField.error() === null && tlsField.error() === null;
  /** Validity of whichever step is currently on top — this is what the greyed `wizard.next` mirrors. */
  const currentStepValid = (): boolean => {
    switch (router.location().name) {
      case 'account':
        return accountValid();
      case 'prefs':
        return prefsValid();
      default:
        return true; // the review step has no Next
    }
  };

  const submitted = signal('');

  // Step 1 — Account: name + email.
  const buildAccount = (): ScreenBundle => {
    const nameInput = new Input({ value: nameField.value });
    const emailInput = new Input({ value: emailField.value });
    bindField(nameField, nameInput);
    bindField(emailField, emailInput);
    const next = new Button('Next', { command: 'wizard.next', disabled: () => !accountValid() });
    const screen = new Group();
    screen.background = 'window';
    screen.add(at(new Text('Step 1 of 3: Account'), 1, 0, 40, 1));
    screen.add(at(new Label('~N~ame', nameInput), 1, 2, 8, 1));
    screen.add(at(nameInput, 10, 2, 26, 1));
    screen.add(at(new Label('~E~mail', emailInput), 1, 4, 8, 1));
    screen.add(at(emailInput, 10, 4, 26, 1));
    screen.add(
      at(new Text(() => (accountValid() ? 'This step is valid ✓' : 'Enter a name and a valid email')), 1, 6, 44, 1),
    );
    screen.add(at(next, 1, 8, 12, 2));
    return { view: screen, status: [statusItem('~Enter~ Next', 'wizard.next', 'Enter')] };
  };

  // Step 2 — Preferences: mode (single) + features (multi) + TLS toggle.
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
    const back = new Button('Back', { command: 'wizard.back' });
    const next = new Button('Next', { command: 'wizard.next', disabled: () => !prefsValid() });
    const screen = new Group();
    screen.background = 'window';
    screen.add(at(new Text('Step 2 of 3: Preferences'), 1, 0, 40, 1));
    screen.add(at(new Label('~M~ode', modeRadio), 1, 2, 8, 1));
    screen.add(at(modeRadio, 1, 3, 16, 3));
    screen.add(at(new Label('~F~eatures', featuresCheck), 22, 2, 12, 1));
    screen.add(at(featuresCheck, 22, 3, 18, 3));
    screen.add(at(tlsSwitch, 1, 7, 20, 1));
    screen.add(at(new Text(() => (prefsValid() ? 'This step is valid ✓' : 'Pick at least one feature')), 24, 7, 30, 1));
    screen.add(at(back, 1, 9, 12, 2));
    screen.add(at(next, 15, 9, 12, 2));
    return {
      view: screen,
      status: [statusItem('~Esc~ Back', 'wizard.back', 'Escape'), statusItem('~Enter~ Next', 'wizard.next', 'Enter')],
    };
  };

  // Step 3 — Review: echo the raw values, then submit the shared form.
  const buildReview = (): ScreenBundle => {
    const fieldRow = (label: string, value: () => string): Text => new Text(() => `${label.padEnd(10)}${value()}`);
    const raw = (): ReturnType<typeof form.rawValues> => form.rawValues();
    const result = new Text(() => (submitted() ? `✓ Submitted: ${submitted()}` : ''));
    const back = new Button('Back', { command: 'wizard.back' });
    const submit = new Button('Submit', { command: 'wizard.submit', default: true });
    const screen = new Group();
    screen.background = 'window';
    screen.add(at(new Text('Step 3 of 3: Review'), 1, 0, 40, 1));
    screen.add(
      at(
        fieldRow('Name:', () => raw().name),
        1,
        2,
        54,
        1,
      ),
    );
    screen.add(
      at(
        fieldRow('Email:', () => raw().email),
        1,
        3,
        54,
        1,
      ),
    );
    screen.add(
      at(
        fieldRow('Mode:', () => raw().mode),
        1,
        4,
        54,
        1,
      ),
    );
    screen.add(
      at(
        fieldRow('Features:', () => raw().features.join(', ')),
        1,
        5,
        54,
        1,
      ),
    );
    screen.add(
      at(
        fieldRow('TLS:', () => (raw().tls ? 'On' : 'Off')),
        1,
        6,
        54,
        1,
      ),
    );
    screen.add(at(back, 1, 8, 12, 2));
    screen.add(at(submit, 15, 8, 12, 2));
    screen.add(at(result, 1, 11, 60, 1));
    return {
      view: screen,
      status: [
        statusItem('~Esc~ Back', 'wizard.back', 'Escape'),
        statusItem('~Enter~ Submit', 'wizard.submit', 'Enter'),
      ],
    };
  };

  const router = createRouter<Routes>({
    initial: { name: 'account' },
    routes: {
      account: { keepAlive: true, build: buildAccount },
      prefs: { keepAlive: true, build: buildPrefs },
      review: { build: buildReview },
    },
  });

  const app = createApplication({
    caps,
    content: router,
    statusLine: statusLine([statusItem('Multi-step wizard'), statusItem('~Alt-X~ Quit', 'quit', 'Alt+X')]),
    viewport: { width: 64, height: 18 },
  });

  // Navigation commands, funnelled from both the status accelerators and the body buttons. `goNext`
  // guards on validity too, but the greyed command is the real gate — an invalid emit never arrives.
  const goNext = (): void => {
    const name = router.location().name;
    if (name === 'account' && accountValid()) router.push('prefs');
    else if (name === 'prefs' && prefsValid()) router.push('review');
  };
  app.loop.onCommand('wizard.next', goNext);
  app.loop.onCommand('wizard.back', () => router.back());
  app.loop.onCommand('wizard.submit', () => {
    void form.submit((values) => submitted.set(JSON.stringify(values)));
  });

  // The gate: keep `wizard.next` enabled only while the current step validates. Re-runs on any field
  // edit and on every navigation (both reads are reactive), so the status item greys live and an
  // invalid `emitCommand('wizard.next')` is dropped by the registry.
  effect(() => {
    app.loop.enableCommand('wizard.next', currentStepValid());
  });

  app.loop.renderRoot.flush();

  // Frame 1 — the empty Account step: the gate is closed (Next greyed).
  printFrame(
    'Frame 1 — Step 1 of 3: Account (Next greyed until the step validates)',
    app.loop.renderRoot.buffer().rows(),
  );
  console.log(
    `  location: ${JSON.stringify(router.location())}  · Next enabled: ${app.loop.isCommandEnabled('wizard.next')}`,
  );

  // Emitting Next while the step is invalid is dropped — navigation does not advance.
  const beforeAccount = router.location().name;
  app.loop.emitCommand('wizard.next');
  console.log(
    `  emit wizard.next (invalid) → location: ${JSON.stringify(router.location())}  · dropped: ${router.location().name === beforeAccount}`,
  );

  // Fill the Account step; the gate opens (the field edits flow through the shared form store).
  nameField.value.set('Ada Lovelace');
  emailField.value.set('ada@example.com');
  app.loop.renderRoot.flush();
  console.log(`  filled name + email  · Next enabled: ${app.loop.isCommandEnabled('wizard.next')}`);

  // Advance to Preferences.
  app.loop.emitCommand('wizard.next');
  app.loop.renderRoot.flush();
  printFrame('Frame 2 — Step 2 of 3: Preferences', app.loop.renderRoot.buffer().rows());
  console.log(
    `  location: ${JSON.stringify(router.location())}  · Next enabled: ${app.loop.isCommandEnabled('wizard.next')}`,
  );

  // The Preferences step starts invalid (no feature picked) — Next is dropped again until it validates.
  const beforePrefs = router.location().name;
  app.loop.emitCommand('wizard.next');
  console.log(
    `  emit wizard.next (invalid) → location: ${JSON.stringify(router.location())}  · dropped: ${router.location().name === beforePrefs}`,
  );

  modeField.value.set('Prod');
  featuresField.value.set(['Logs', 'Metrics']);
  tlsField.value.set(true);
  app.loop.renderRoot.flush();
  console.log(`  set mode + features + tls  · Next enabled: ${app.loop.isCommandEnabled('wizard.next')}`);

  // Advance to Review.
  app.loop.emitCommand('wizard.next');
  app.loop.renderRoot.flush();
  printFrame('Frame 3 — Step 3 of 3: Review', app.loop.renderRoot.buffer().rows());
  console.log(`  location: ${JSON.stringify(router.location())}`);

  // Submit the whole shared form; on valid it echoes the coerced z.output values.
  await form.submit((values) => submitted.set(JSON.stringify(values)));
  app.loop.renderRoot.flush();
  console.log(`  Submitted: ${submitted()}`);

  // keepAlive + one shared form: Back twice lands on the warm Account step with its value intact.
  app.loop.emitCommand('wizard.back'); // review → prefs
  app.loop.emitCommand('wizard.back'); // prefs → account
  app.loop.renderRoot.flush();
  const preserved = router.location().name === 'account' && nameField.value() === 'Ada Lovelace';
  console.log(
    `  Back → Back → location: ${JSON.stringify(router.location())}  · name field still: "${nameField.value()}"`,
  );
  console.log(
    `\nkeepAlive + shared form: the Account step's entered value survived the round-trip → ${preserved ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    'Done — a multi-step wizard: one @jsvision/forms form across router screens, a Next greyed until each step validates, and keepAlive-preserved values.',
  );

  form.dispose();
  dispose();
}

main();
