/**
 * Story: `@jsvision/forms` — a live, self-contained **server-connection form** that exercises every
 * binding path the forms engine ships: a direct-bound text field, a coerced-number text field, a
 * `Switch`, a `RadioGroup` (single choice), and a `CheckGroup` (multi choice). Each field reveals its
 * first validation issue only after it is touched (focus leaves it), a `valid · dirty` echo mirrors
 * the whole-form state live, and a submit-gated button validates the entire object — on an invalid
 * submit every error reveals at once; on a valid submit the coerced values are echoed.
 *
 * It shows how `createForm` + Zod drive the standard `@jsvision/ui` widgets with no bespoke glue:
 * `field.value` binds two-way, `bindRadio` / `bindCheck` are stateless lenses that keep the field in
 * domain terms (never an index), and `bindField` wires touched-on-first-blur.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Input, Switch, RadioGroup, CheckGroup, Button, Label, Text, signal } from '@jsvision/ui';
import { createForm, bindField, bindRadio, bindCheck } from '@jsvision/forms';
import type { Field } from '@jsvision/forms';
import { z } from 'zod';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/**
 * The showcase's forms story: `createForm` + Zod bound to the five stock widgets, with touched-gated
 * error reveal, a live `valid · dirty` echo, and a submit-gated button that echoes the coerced values.
 *
 * @example
 * import { STORIES } from './stories/index.js';
 * const story = STORIES.find((s) => s.id === 'forms/form');
 * const group = story!.build({ caps, width: 72, height: 16 }); // a Group ready for the shell to place
 */
export const formsStory: Story = {
  id: 'forms/form',
  category: 'Forms',
  title: 'Form',
  rd: 'RD-04',
  blurb:
    'createForm + Zod: live validation, touched-on-blur errors, a submit-gated button, a bound valid · dirty echo.',
  build(ctx: StoryContext) {
    const schema = z.object({
      name: z.string().min(1, 'Required'),
      port: z.coerce.number().int().gte(1, 'Port ≥ 1').lte(65535, 'Port ≤ 65535'),
      tls: z.boolean(),
      mode: z.enum(['Dev', 'Staging', 'Prod']),
      features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
    });
    // The initial carries the RAW editing types: `port` is edited as text (the schema coerces it), and
    // the empty `features` list is annotated so `bindCheck`'s domain inference stays exact — a bare
    // `[]` would infer a degenerate element type.
    const form = createForm({
      schema,
      initial: { name: '', port: '', tls: false, mode: 'Dev', features: [] as Array<'Logs' | 'Metrics' | 'Tracing'> },
    });

    const nameField = form.field('name');
    const portField = form.field('port');
    const tlsField = form.field('tls');
    const modeField = form.field('mode');
    const featuresField = form.field('features');

    // Direct two-way value binds (text + switch); the choice fields go through the domain-value lenses.
    const nameInput = new Input({ value: nameField.value });
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
    bindField(portField, portInput);
    bindField(tlsField, tlsSwitch);
    bindField(modeField, modeRadio);
    bindField(featuresField, featuresCheck);

    // A field's first issue, revealed only once it is touched — `error()` is always live; the app gates.
    const errText = <T>(field: Field<T>): Text =>
      new Text(() => {
        const issue = field.error();
        return field.touched() && issue ? issue.message : '';
      });

    const submitted = signal('');
    const echo = new Text(() => `valid: ${form.isValid()}   dirty: ${form.dirty()}`);
    const submitBtn = new Button('~S~ubmit', {
      default: true,
      // `form.submit()` IS the gate: invalid marks all fields touched (every error reveals) and resolves
      // false without echoing; valid echoes the coerced z.output values. `void` discards the Promise.
      onClick: () => {
        void form.submit((v) => submitted.set(JSON.stringify(v)));
      },
    });
    const result = new Text(() => (submitted() ? `✓ Submitted: ${submitted()}` : ''));

    const w = Math.max(60, ctx.width - 2);
    const g = new Group();

    // Text fields: label · widget · touched-gated error.
    g.add(at(new Label('~N~ame', nameInput), 1, 0, 6, 1));
    g.add(at(nameInput, 8, 0, 22, 1));
    g.add(at(errText(nameField), 32, 0, w - 32, 1));

    g.add(at(new Label('~P~ort', portInput), 1, 1, 6, 1));
    g.add(at(portInput, 8, 1, 10, 1));
    g.add(at(errText(portField), 20, 1, w - 20, 1));

    g.add(at(tlsSwitch, 1, 2, 20, 1));

    // Choice fields side by side: a linked title, the group (3 tall), then its error below.
    g.add(at(new Label('~M~ode', modeRadio), 1, 3, 8, 1));
    g.add(at(new Label('~F~eatures', featuresCheck), 24, 3, 12, 1));
    g.add(at(modeRadio, 1, 4, 16, 3));
    g.add(at(featuresCheck, 24, 4, 18, 3));
    g.add(at(errText(featuresField), 24, 7, w - 24, 1));

    // Live bound-state echo, the submit gate, and the post-submit result.
    g.add(at(echo, 1, 8, w, 1));
    g.add(at(submitBtn, 1, 10, 12, 2));
    g.add(at(result, 15, 10, w - 15, 1));
    g.add(
      at(new Text('Tab moves between fields · errors reveal on blur · Submit validates the whole form.'), 1, 13, w, 1),
    );

    return g;
  },
};
