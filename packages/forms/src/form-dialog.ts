/**
 * `formDialog()` — run a headless {@link createForm} store inside a modal dialog and resolve to its
 * result. It is the bridge from `@jsvision/forms` into a `@jsvision/ui` `Dialog`: the dialog creates,
 * owns, and disposes the form; the caller only supplies a `body(form)` that binds widgets to the
 * form's fields.
 *
 * The load-bearing design fact: a `Dialog`'s close-gate `valid()` is **synchronous**, but
 * `form.submit()` is **asynchronous** (it force-runs async validators), so OK cannot simply gate on
 * `submit()`. Instead a small `Dialog` subclass **intercepts** the `ok` command, `await`s
 * `form.submit(onSubmit)` out of band, and drives `endModal(ok)` itself on success — while the dialog
 * is **sealed** for the duration of the submit (Cancel, Esc, the close-box, and an app-quit are all
 * inert) so no concurrent close can pop the modal mid-await. The sync `valid()` is repurposed to an
 * optimistic `form.isValid()` app-quit veto.
 */
import { Dialog, Button, cancelButton, Commands } from '@jsvision/ui';
import type { View, Rect, DispatchEvent, ModalDialogHost } from '@jsvision/ui';
import type { z } from 'zod';
import type { AsyncValidator, Form } from './types.js';
import { createForm } from './create-form.js';

/**
 * Options for {@link formDialog}.
 *
 * @typeParam S - the Zod object schema type.
 * @typeParam I - the raw initial value shape (keys constrained to the schema).
 */
export interface FormDialogOptions<S extends z.ZodObject<z.ZodRawShape>, I> {
  /** A Zod object schema (a non-string field edited as text must use `z.coerce.*`). */
  schema: S;
  /** The raw initial editing values (e.g. a coerced-number field is initialised as a string). */
  initial: I;
  /** Opt-in per-field async validators; each force-runs as part of the OK submit gate. */
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };
  /** Debounce, in milliseconds, before an async validator runs after a change. Defaults to `300`. */
  asyncDebounceMs?: number;
  /** Title centered in the dialog's top border. */
  title?: string;
  /** Build the dialog body — bind widgets to `form.field(name).value`. Runs once, when the dialog opens. */
  body: (form: Form<S, I>) => View;
  /**
   * Optional save callback run **inside** the submit gate with the coerced values. If it rejects, the
   * dialog stays open and OK re-enables; surface the failure through your own body UI (none is minted).
   */
  onSubmit?: (values: z.output<S>) => void | Promise<void>;
  /** OK button label (tilde-marked hotkey, e.g. `'~S~ave'`). Defaults to `'~O~K'`. */
  okText?: string;
  /** Dialog width in cells. Required — the body is opaque, so the dialog cannot size itself. */
  width: number;
  /** Dialog height in cells. Required (a placement rect is applied only when both width and height are given). */
  height: number;
}

/** Standard dialog-button cell size and the centered layout of the OK + Cancel pair. */
const BUTTON = { width: 10, height: 2 } as const;
const GAP = 2;
const PAIR_WIDTH = BUTTON.width + GAP + BUTTON.width;

/** Place `view` at an absolute rect and return it (chainable). */
function place<T extends View>(view: T, rect: Rect): T {
  view.layout = { ...view.layout, position: 'absolute', rect };
  return view;
}

/** The OK/Cancel rects: a centered pair on the second-to-last row (above the bottom frame). */
function buttonRects(width: number, height: number): { ok: Rect; cancel: Rect } {
  const startX = Math.max(2, Math.trunc((width - PAIR_WIDTH) / 2));
  const y = Math.max(2, height - BUTTON.height - 1);
  return {
    ok: { x: startX, y, ...BUTTON },
    cancel: { x: startX + BUTTON.width + GAP, y, ...BUTTON },
  };
}

/**
 * The internal `Dialog` subclass that gates OK on the async `form.submit()` and seals itself for the
 * gate's duration. Not exported — `formDialog` is the only public entry point.
 */
class FormDialog<S extends z.ZodObject<z.ZodRawShape>, I> extends Dialog {
  private readonly form: Form<S, I>;
  private readonly onSubmit?: (values: z.output<S>) => void | Promise<void>;
  /** The coerced values captured inside the gate, before the factory disposes the form. */
  private captured: z.output<S> | null = null;

  constructor(
    opts: { title?: string; width: number; height: number },
    form: Form<S, I>,
    onSubmit?: (values: z.output<S>) => void | Promise<void>,
  ) {
    super(opts);
    this.form = form;
    this.onSubmit = onSubmit;
    // Place children with explicit frame offsets (as the message-box helpers do), not inside a padded box.
    this.layout = { ...this.layout, padding: 0 };
  }

  /** The values captured on a successful OK, or `null` if the dialog closed any other way. */
  result(): z.output<S> | null {
    return this.captured;
  }

  /**
   * Intercept `ok` to run the async submit gate; seal every terminating command while a submit is in
   * flight. On `ok` the base `endModal` path is never taken — the gate drives `endModal` itself.
   */
  protected override handleTerminating(command: string, ev: DispatchEvent): void {
    if (command === Commands.ok) {
      if (this.form.submitting()) return; // sealed: drop a re-fired OK while a submit runs
      ev.handled = true;
      void this.runOkGate(); // fire-and-forget: the sync event turn does not await the gate
      return;
    }
    // cancel / yes / no: inert while sealed, otherwise the inherited close path.
    if (this.form.submitting()) return;
    super.handleTerminating(command, ev);
  }

  /** Seal Esc and the frame close-box while a submit is in flight; otherwise the inherited cancel path. */
  protected override resolveCancel(ev: DispatchEvent): void {
    if (this.form.submitting()) return;
    super.resolveCancel(ev);
  }

  /**
   * The app-quit veto (consulted synchronously by the loop's quit cascade, NOT the OK path). Vetoes
   * while sealed; otherwise `cancel` always closes and any other command closes only if the form is
   * sync-valid. Optimistic: this sync hook cannot force-run async validators.
   */
  override valid(command: string): boolean {
    if (this.form.submitting()) return false; // sealed → veto app-quit
    return command === Commands.cancel || this.form.isValid();
  }

  /**
   * The async OK gate, run off the sync event turn. `submitting()` flips true synchronously at
   * `submit()` entry, so the dialog is already sealed by the time this awaits.
   */
  private async runOkGate(): Promise<void> {
    try {
      const ok = await this.form.submit((values) => {
        this.captured = values; // capture before the factory disposes the form
        return this.onSubmit?.(values); // optional in-modal save, inside the gate
      });
      if (ok) this.modalHost?.endModal(Commands.ok); // success → end the modal ourselves
      // ok === false → stay open; errors are already revealed by submit().
    } catch {
      // onSubmit rejected → submit() re-throws (it does not try/catch onValid). Stay open; submit()'s
      // own finally already cleared submitting(), so the seal lifts and OK re-enables. No error UI is
      // minted — the app surfaces the failure through its own body.
    }
  }
}

/**
 * Run a form in a modal dialog and resolve to the coerced values on OK, or `null` on Cancel / Esc /
 * close-box / a quit-close.
 *
 * The dialog creates the form (via {@link createForm}), hands it to `body(form)` to bind widgets, then
 * runs modally. OK marks every field touched, validates (force-running any async validators), runs the
 * optional `onSubmit` inside the gate, and — only if all of that passes — closes and resolves the
 * coerced `z.output<S>`. An invalid OK keeps the dialog open with errors revealed. The dialog is
 * **sealed** while a submit is in flight (Cancel / Esc / quit are inert). The form is always disposed
 * on close, on every path (including a `body` or `onSubmit` that throws).
 *
 * @param host  A modal host — the `createApplication` result satisfies it directly (or `{ loop, desktop }`).
 * @param options  The schema, raw initial values, the `body(form)` builder, and optional `onSubmit` / `okText` / async options; `width` and `height` are required.
 * @returns The coerced values on OK, or `null` on any other close.
 * @example
 * import { formDialog } from '@jsvision/forms';
 * import { Group, Input, Label } from '@jsvision/ui';
 * import { z } from 'zod';
 *
 * const schema = z.object({ name: z.string().min(1, 'Required'), port: z.coerce.number().int().min(1) });
 *
 * const values = await formDialog(app, {
 *   schema,
 *   initial: { name: '', port: '8080' }, // RAW editing values (port edited as a string)
 *   title: ' Edit server ',
 *   width: 44,
 *   height: 9,
 *   body: (form) => {
 *     const g = new Group();
 *     const input = new Input({ value: form.field('name').value });
 *     const label = new Label('~N~ame', input);
 *     label.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 10, height: 1 } };
 *     input.layout = { position: 'absolute', rect: { x: 13, y: 1, width: 24, height: 1 } };
 *     g.add(label);
 *     g.add(input);
 *     return g;
 *   },
 *   onSubmit: async (v) => { await api.save(v); }, // runs INSIDE the gate; reject → the dialog stays open
 * });
 * if (values) console.log('saved', values.name, values.port); // null on Cancel/Esc
 */
export function formDialog<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(
  host: ModalDialogHost,
  options: FormDialogOptions<S, I>,
): Promise<z.output<S> | null> {
  // An async IIFE: the prelude (form creation, body build, addWindow) runs synchronously up to the
  // first await, so the dialog is mounted by the time the pending promise is returned — and a
  // synchronous body(form) throw still reaches the finally, which disposes the form on every path.
  return (async () => {
    const form = createForm<S, I>({
      schema: options.schema,
      initial: options.initial,
      asyncValidators: options.asyncValidators,
      asyncDebounceMs: options.asyncDebounceMs,
    });
    const dlg = new FormDialog<S, I>(
      { title: options.title, width: options.width, height: options.height },
      form,
      options.onSubmit,
    );
    const ok = new Button(options.okText ?? '~O~K', {
      command: Commands.ok,
      default: true,
      disabled: () => form.submitting(), // greyed + inert while a submit runs
    });
    const rects = buttonRects(options.width, options.height);
    let mounted = false;
    try {
      const body = options.body(form); // caller-built — may throw synchronously (e.g. form.field('typo'))
      // Pin the body to a `fill` overlay so it always spans the dialog's content box. A body whose
      // children are all absolutely-positioned (the common case — `Label`/`Input` at fixed rects) has
      // no in-flow content, so without this its `auto` width would resolve to zero, collapsing the
      // group and clipping every child away — the dialog would show only its frame + buttons (and the
      // focused field's caret). `fill` needs no rect and re-solves if the dialog is ever resized.
      body.layout = { ...body.layout, position: 'fill' };
      dlg.add(body);
      dlg.add(place(ok, rects.ok));
      // Cancel must not steal focus from the body on click: a click-to-focus would blur the field
      // being edited, and a blur-driven error reveal (bindField / an Input validator) would flash the
      // validation red for one frame before the dialog closes. Cancel stays Tab-reachable + Esc works.
      const cancel = cancelButton();
      cancel.grabsFocus = false;
      dlg.add(place(cancel, rects.cancel));
      host.desktop.addWindow(dlg);
      mounted = true;
      const command = await host.loop.execView<string>(dlg);
      return command === Commands.ok ? dlg.result() : null; // coerced values on OK, null otherwise
    } finally {
      if (mounted) host.desktop.removeWindow(dlg); // guard: a pre-addWindow throw never mounted it
      form.dispose(); // dispose on EVERY path (OK / cancel / body-throw / execView-throw); idempotent
    }
  })();
}
