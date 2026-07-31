import { bindField, createForm } from '@jsvision/forms';
import { Group, Input, Label, Text, at, batch, signal } from '@jsvision/ui';
import { z } from 'zod';

/** Input route reported without relying on colour. */
export type FormStateActionSource = 'ready' | 'keyboard' | 'mouse';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  port: z.coerce.number().int('Whole number required').min(1).max(65535),
});

/**
 * Demonstrates one real headless form store through invalid, valid, dirty, and reset states.
 */
export class FormStateValidationPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Form state and validation';

  /** Number of settled valid submissions. */
  public validSubmissions = 0;

  /** Number of synchronously rejected submissions. */
  public invalidSubmissions = 0;

  /** Number of explicit baseline resets. */
  public resetCount = 0;

  /** Real name input bound directly to the form's raw field signal. */
  public readonly nameInput: Input;

  /** Real port input bound directly to the form's raw field signal. */
  public readonly portInput: Input;

  /** Headless form store owned by this panel. */
  protected readonly form = createForm({
    schema,
    initial: { name: '', port: '8080' },
  });

  /** Settled submission feedback. */
  protected readonly submitState = signal('none');

  /** Most recent input route. */
  protected readonly actionSource = signal<FormStateActionSource>('ready');

  /** Reactive invalidation token for public counters. */
  protected readonly counterVersion = signal(0);

  /** Build two bound inputs and their non-colour form-state readout. */
  public constructor() {
    super();
    const name = this.form.field('name');
    const port = this.form.field('port');
    this.nameInput = new Input({ value: name.value, placeholder: 'required' });
    this.portInput = new Input({ value: port.value });
    bindField(name, this.nameInput);
    bindField(port, this.portInput);

    this.add(at(new Label('~N~ame', this.nameInput), 0, 0, 10, 1));
    this.add(at(this.nameInput, 11, 0, 20, 1));
    this.add(at(new Label('~P~ort', this.portInput), 33, 0, 8, 1));
    this.add(at(this.portInput, 42, 0, 12, 1));
    this.add(at(new Text(() => `Raw name: ${name.value() || 'empty'} · Raw port: ${port.value()}`), 0, 2, 62, 1));
    this.add(
      at(
        new Text(() => {
          const values = this.form.values();
          return values === null
            ? 'Typed: null · Typed port: unavailable'
            : `Typed: available · Typed port: ${values.port} (${typeof values.port})`;
        }),
        0,
        3,
        62,
        1,
      ),
    );
    this.add(
      at(
        new Text(
          () =>
            `Dirty: ${this.form.dirty() ? 'yes' : 'no'} · Touched: ${
              name.touched() && port.touched() ? 'all' : name.touched() ? 'name' : port.touched() ? 'port' : 'none'
            }`,
        ),
        0,
        4,
        62,
        1,
      ),
    );
    this.add(
      at(
        new Text(
          () =>
            `Errors: ${
              [name, port]
                .filter((field) => field.touched() && field.error() !== null)
                .map((field) => field.error()?.message)
                .join(' · ') || 'none'
            }`,
        ),
        0,
        5,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Submit: ${this.submitState()}`), 0, 6, 62, 1));
    this.add(
      at(
        new Text(() => {
          this.counterVersion();
          return `Accepted: ${this.validSubmissions} · Rejected: ${this.invalidSubmissions} · Resets: ${this.resetCount}`;
        }),
        0,
        7,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 8, 62, 1));
    this.onMount(() => this.onCleanup(() => this.form.dispose()));
  }

  /** Submit through the real store and publish only its settled callback result. */
  public submit(source: Exclude<FormStateActionSource, 'ready'>): void {
    this.actionSource.set(source);
    if (!this.form.isValid()) {
      this.invalidSubmissions += 1;
      this.counterVersion.update((current) => current + 1);
      this.submitState.set('invalid · focus first invalid field');
      void this.form.submit(() => {});
      return;
    }
    this.submitState.set('pending');
    void this.form.submit((values) => {
      this.validSubmissions += 1;
      this.counterVersion.update((current) => current + 1);
      this.submitState.set(`success · coerced port is ${typeof values.port}`);
    });
  }

  /** Fill both raw editing fields with values that coerce to a valid typed record. */
  public fillValid(source: Exclude<FormStateActionSource, 'ready'>): void {
    batch(() => {
      this.form.field('name').value.set('db');
      this.form.field('port').value.set('9090');
      this.actionSource.set(source);
      this.submitState.set('none');
    });
  }

  /** Make one post-submit edit so dirty state becomes observable. */
  public edit(source: Exclude<FormStateActionSource, 'ready'>): void {
    this.form.field('name').value.set('db-edited');
    this.actionSource.set(source);
  }

  /** Restore the initial raw baseline and clear touched and dirty state. */
  public reset(source: Exclude<FormStateActionSource, 'ready'>): void {
    this.form.reset();
    this.resetCount += 1;
    this.counterVersion.update((current) => current + 1);
    this.submitState.set('reset to baseline');
    this.actionSource.set(source);
  }
}
