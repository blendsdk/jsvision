/**
 * Story: `@jsvision/forms` — the **comprehensive showcase**. Where the other Forms stories each isolate
 * one capability, this is the end-to-end tour: one realistic server-connection form that ties the whole
 * shipped engine together on a single screen. It composes `createForm` + Zod with the stock widgets and
 * layers on four things a real edit screen wants at once:
 *
 * - a live **state inspector** beside the form, echoing `rawValues` / `values` / `errors` / `isValid` /
 *   `dirty` / `validating` / `loading` reactively as you type;
 * - an **amber advisory** that appears only while the port is privileged (`1 ≤ port < 1024`) — app-level
 *   advisory text (a `Text` with `severity: 'warning'`), no engine change;
 * - an **errors-layout toggle** that reflows every text field's error between beside-the-field and
 *   below-the-field, built with the `col`/`row` layout DSL;
 * - the async surface inline — a debounced availability check on `host`, a **Load defaults** button that
 *   runs `form.load()` and rebases the baseline, and an **Open as dialog…** button that re-hosts a subset
 *   of the same schema through `formDialog()`.
 *
 * The reflow uses a **two-slot** design rather than reactive re-parenting: each text field carries two
 * error `Text` slots (one beside it, one below it) that share a single touched-gated getter but each
 * self-blank unless the toggle selects its placement — so exactly one is ever non-empty and the error
 * visibly moves without rebuilding the view tree.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import {
  Group,
  Input,
  Switch,
  RadioGroup,
  CheckGroup,
  Button,
  Label,
  Text,
  signal,
  col,
  row,
  grow,
  fixed,
} from '@jsvision/ui';
import type { View, LayoutProps } from '@jsvision/ui';
import { createForm, bindField, bindRadio, bindCheck, formDialog } from '@jsvision/forms';
import type { Field } from '@jsvision/forms';
import { z } from 'zod';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Resolve after `ms`, or reject early when `signal` aborts (a superseded/disposed run is torn down). */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new Error('aborted'));
    });
  });
}

/**
 * The flagship showcase story: one server-connection form that composes the whole `@jsvision/forms`
 * engine — a bound form with sync + debounced-async validation, a live state inspector, an amber
 * privileged-port advisory, a right/below error-layout toggle, and an inline load/dialog tour.
 *
 * @example
 * import { STORIES } from './stories/index.js';
 * const story = STORIES.find((s) => s.id === 'forms/showcase');
 * const group = story!.build({ caps, width: 72, height: 16 }); // a Group ready for the shell to place
 */
export const formsShowcaseStory: Story = {
  id: 'forms/showcase',
  category: 'Forms',
  title: 'Comprehensive showcase',
  rd: 'RD-05',
  blurb:
    'The grand tour: one bound form with a live state inspector, an amber privileged-port advisory, a right/below error-layout toggle, and an inline async/load/dialog tour.',
  build(ctx: StoryContext) {
    // --- Schema + form -----------------------------------------------------------------------------
    // The server-connection shape, with `host` async-validated for availability so both validation
    // modes (sync Zod + debounced async) live in one form.
    const schema = z.object({
      name: z.string().min(1, 'Required'),
      host: z.string().min(1, 'Required'),
      port: z.coerce.number().int().gte(1, 'Port ≥ 1').lte(65535, 'Port ≤ 65535'),
      tls: z.boolean(),
      mode: z.enum(['Dev', 'Staging', 'Prod']),
      features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
    });
    const TAKEN = new Set(['db-primary', 'localhost']); // the simulated availability directory

    // The initial carries the RAW editing types: `port` is edited as text (the schema coerces it), and
    // the empty `features` list is annotated so `bindCheck`'s domain inference stays exact.
    const form = createForm({
      schema,
      initial: {
        name: '',
        host: '',
        port: '',
        tls: false,
        mode: 'Dev' as 'Dev' | 'Staging' | 'Prod',
        features: [] as Array<'Logs' | 'Metrics' | 'Tracing'>,
      },
      asyncValidators: {
        host: async (value, { signal }) => {
          await sleep(500, signal); // simulated availability round-trip (abortable)
          return TAKEN.has(value.toLowerCase()) ? 'Already in use' : null;
        },
      },
      asyncDebounceMs: 300,
    });

    const nameField = form.field('name');
    const hostField = form.field('host');
    const portField = form.field('port');
    const tlsField = form.field('tls');
    const modeField = form.field('mode');
    const featuresField = form.field('features');

    // Direct two-way value binds (text + switch); the choice fields go through the domain-value lenses.
    const nameInput = new Input({ value: nameField.value });
    const hostInput = new Input({ value: hostField.value, placeholder: 'db-primary' });
    const portInput = new Input({ value: portField.value });
    const tlsSwitch = new Switch({ value: tlsField.value, label: 'TLS', onLabel: 'On', offLabel: 'Off' });
    const modeRadio = new RadioGroup({
      labels: ['~D~ev', '~S~taging', '~P~rod'],
      value: bindRadio(modeField, ['Dev', 'Staging', 'Prod']),
    });
    const featuresCheck = new CheckGroup({
      labels: ['~L~ogs', '~M~etrics', '~T~racing'],
      value: bindCheck(featuresField, ['Logs', 'Metrics', 'Tracing']),
    });

    // Touched-on-first-blur for every field: an error stays hidden until focus has visited and left it.
    bindField(nameField, nameInput);
    bindField(hostField, hostInput);
    bindField(portField, portInput);
    bindField(tlsField, tlsSwitch);
    bindField(modeField, modeRadio);
    bindField(featuresField, featuresCheck);

    // --- The errors-layout toggle + per-field messages ---------------------------------------------
    // A plain index signal (0 = beside the field, 1 = below it) bound to a two-item RadioGroup. Both
    // error slots below read `place()`; only the selected one is ever non-empty, so the error moves.
    const errPlace = signal(0);
    const place = (): 'right' | 'below' => (errPlace() === 0 ? 'right' : 'below');
    const toggle = new RadioGroup({ labels: ['~r~ight', '~b~elow'], value: errPlace });

    // A field's first sync issue, revealed only once it is touched — `error()` is always live; the app gates.
    const issueMsg = <T>(field: Field<T>): string => {
      const issue = field.error();
      return field.touched() && issue ? issue.message : '';
    };
    // `host` composes its async surface into the same slot: mid-flight `checking…`, then the async
    // verdict, else the touched-gated sync issue (at most one is meaningful at a time).
    const hostMsg = (): string => {
      if (hostField.validating()) return 'checking…';
      const asyncErr = hostField.asyncError();
      if (asyncErr !== null) return asyncErr;
      return issueMsg(hostField);
    };

    // One text field as a 2-row block: [ label · input · right-slot ] over [ below-slot ]. The two slots
    // share `msg` but self-blank by placement, so flipping the toggle reflows the error with no re-parenting.
    const fieldBlock = (labelText: string, input: View, msg: () => string): Group => {
      const errRight = new Text(() => (place() === 'right' ? msg() : ''));
      const errBelow = new Text(() => (place() === 'below' ? msg() : ''));
      const top = row({ gap: 1 }, fixed(new Label(labelText, input), 10), fixed(input, 20), grow(errRight));
      return col(fixed(top, 1), fixed(errBelow, 1));
    };

    // --- The two choice fields, side by side -------------------------------------------------------
    const modeCol = col(fixed(new Label('~M~ode', modeRadio), 1), fixed(modeRadio, 3));
    const featuresCol = col(fixed(new Label('~F~eatures', featuresCheck), 1), fixed(featuresCheck, 3));
    const choicesRow = row({ gap: 2 }, fixed(modeCol, 16), grow(featuresCol));

    // The whole form column: the three text fields (each 2 rows), the switch, then the choice groups.
    const formCol = col(
      { gap: 0 },
      fixed(
        fieldBlock('~N~ame', nameInput, () => issueMsg(nameField)),
        2,
      ),
      fixed(fieldBlock('~H~ost', hostInput, hostMsg), 2),
      fixed(
        fieldBlock('~P~ort', portInput, () => issueMsg(portField)),
        2,
      ),
      fixed(tlsSwitch, 1),
      fixed(choicesRow, 4),
    );

    // --- The live state inspector (+ the toggle above it) ------------------------------------------
    // `Text` word-wraps to its width; a value longer than the 26-wide panel would wrap to a clipped
    // second line and vanish. Clip each dynamic line to the panel so it stays one visible line — a live
    // inspector only needs the leading, moving portion of `values`/`raw`.
    const INSPECTOR_W = 26;
    const fit = (s: string): string => (s.length <= INSPECTOR_W ? s : `${s.slice(0, INSPECTOR_W - 1)}…`);
    const inspectorLines = col(
      { gap: 0 },
      fixed(new Text(() => fit(`isValid  : ${form.isValid()}`)), 1),
      fixed(new Text(() => fit(`dirty    : ${form.dirty()}`)), 1),
      fixed(new Text(() => fit(`validating: ${form.validating()}`)), 1),
      fixed(new Text(() => fit(`loading  : ${form.loading()}`)), 1),
      fixed(new Text(() => fit(`errors   : ${form.errors().length}`)), 1),
      fixed(new Text(() => fit(`values   : ${form.isValid() ? JSON.stringify(form.values()) : '— (invalid)'}`)), 1),
      fixed(new Text(() => fit(`raw      : ${JSON.stringify(form.rawValues())}`)), 1),
    );
    const inspectorCol = col(
      { gap: 0 },
      fixed(new Text('Errors placement:'), 1),
      fixed(toggle, 2),
      fixed(new Text('State inspector'), 1),
      grow(inspectorLines),
    );

    const bodyRow = row({ gap: 1 }, grow(formCol), fixed(inspectorCol, 26));

    // --- The amber privileged-port advisory (app-level, no engine change) --------------------------
    // Raw is a string; `Number('') === 0`, so a blank port draws nothing. Self-blank keeps it from
    // painting an empty amber cell when the port is unprivileged.
    const advisory = new Text(
      () => {
        const p = Number(portField.value());
        return Number.isInteger(p) && p >= 1 && p < 1024 ? '⚠ privileged port — needs elevated rights' : '';
      },
      { severity: 'warning' },
    );

    // --- The actions row: submit gate · load defaults · open-as-dialog -----------------------------
    const outcome = signal('');

    // The simulated record fetch: RAW editing values after an abortable delay. `host: 'db-primary'` is in
    // TAKEN, so a load also demonstrates the async "Already in use" verdict on the loaded value.
    const loadRecord = async ({
      signal,
    }: {
      signal: AbortSignal;
    }): Promise<{
      name: string;
      host: string;
      port: string;
      tls: boolean;
      mode: 'Dev' | 'Staging' | 'Prod';
      features: Array<'Logs' | 'Metrics' | 'Tracing'>;
    }> => {
      await sleep(500, signal);
      return { name: 'api', host: 'db-primary', port: '443', tls: true, mode: 'Prod', features: ['Logs'] };
    };

    const openDialog = (): void => {
      if (ctx.execView === undefined) {
        outcome.set('(headless — run demo:kitchen for the modal)');
        return;
      }
      // The shell's execModal (ctx.execView) already adds the modal to the desktop, runs it, and removes
      // it — so formDialog's desktop must be a NO-OP shim, or the dialog would be mounted twice. `bounds`
      // only satisfies the host type; formDialog never reads it. ctx.execView is non-generic, so
      // re-expose it as the generic method formDialog calls.
      const exec = ctx.execView;
      const host = {
        loop: { execView: <R>(view: View): Promise<R> => (exec as (m: View) => Promise<R>)(view) },
        desktop: {
          addWindow: (): void => {},
          removeWindow: (): void => {},
          bounds: { x: 0, y: 0, width: ctx.width, height: ctx.height },
        },
      };
      // A 2-field subset of the same schema so the modal fits a small dialog.
      const dialogSchema = z.object({
        name: z.string().min(1, 'Required'),
        port: z.coerce.number().int().min(1).max(65535),
      });
      void formDialog(host, {
        schema: dialogSchema,
        initial: { name: '', port: '8080' }, // RAW editing values (port edited as a string)
        title: ' Edit server ',
        width: 44,
        height: 9,
        body: (dform) => {
          const b = new Group();
          const nField = dform.field('name');
          const pField = dform.field('port');
          const nInput = new Input({ value: nField.value, placeholder: 'db-primary' });
          const pInput = new Input({ value: pField.value });
          bindField(nField, nInput); // touched-on-first-blur → the error reveals as you leave the field
          b.add(at(new Label('~N~ame', nInput), 2, 1, 7, 1));
          b.add(at(nInput, 10, 1, 30, 1));
          b.add(at(new Label('~P~ort', pInput), 2, 3, 7, 1));
          b.add(at(pInput, 10, 3, 30, 1));
          const nameErr = new Text(
            () => {
              const issue = nField.touched() ? nField.error() : null;
              return issue ? issue.message : '';
            },
            { severity: 'error' },
          );
          b.add(at(nameErr, 2, 5, 38, 1));
          return b;
        },
      }).then((values) => outcome.set(values ? `saved: ${values.name}:${values.port}` : 'cancelled'));
    };

    const submitBtn = new Button('~S~ubmit', {
      default: true,
      // `form.submit()` IS the gate: invalid marks all fields touched (every error reveals) and resolves
      // without echoing; valid echoes the coerced z.output values. `void` discards the Promise.
      onClick: () => {
        void form.submit((v) => outcome.set(`✓ ${JSON.stringify(v)}`));
      },
    });
    const loadBtn = new Button('~L~oad defaults', {
      disabled: () => form.loading(), // no double-trigger while a fetch is in flight
      onClick: () => {
        void form.load(loadRecord).then((ok) => outcome.set(ok ? '✓ loaded — baseline rebased' : '✗ load failed'));
      },
    });
    const openBtn = new Button('~O~pen as dialog…', { command: 'forms.showcase.dialog', onClick: openDialog });
    const outcomeText = new Text(() => outcome());
    const actionsRow = row({ gap: 1 }, fixed(submitBtn, 13), fixed(loadBtn, 18), fixed(openBtn, 21), grow(outcomeText));

    // --- The always-painted hint -------------------------------------------------------------------
    // Never reactive-blank, so the demonstration literals paint even in a headless mount (the smoke
    // oracle reads rendered text). Leads with the port/privileged literal so it stays inside a narrow
    // clip, and echoes the right/below toggle labels — mirroring the sibling stories' hint pattern.
    const hint = new Text(
      'Tip: a port <1024 is privileged · errors reveal on blur · Errors: right/below reflow · Load defaults · Open as dialog…',
    );

    // --- Assemble the single DSL frame -------------------------------------------------------------
    const w = Math.max(64, ctx.width - 2);
    const frame = col({ gap: 0 }, grow(bodyRow), fixed(advisory, 1), fixed(actionsRow, 2), fixed(hint, 1));
    // Place the DSL frame by MERGING an absolute rect onto its layout (preserving `direction`); `at()`
    // would replace the layout and lose it. The `grow`/`fixed` split reflows for free with the canvas.
    const framed: LayoutProps = {
      ...frame.layout,
      position: 'absolute',
      rect: { x: 1, y: 0, width: w, height: ctx.height },
    };
    frame.layout = framed;

    const g = new Group();
    g.add(frame);
    return g;
  },
};
