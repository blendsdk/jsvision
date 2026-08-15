import type { I18n } from '@jsvision/i18n';
import { CheckGroup, Input, Memo, RadioGroup, Switch, Text, signal, stringWidth } from '@jsvision/ui';
import type { Signal, View } from '@jsvision/ui';

import { canonicalizeKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type {
  KanbanCardEditorField,
  KanbanEditorControlContext,
  KanbanEditorControlMeasurement,
  KanbanEditorControlRegistry,
  KanbanEditorDiagnostic,
  KanbanEditorFieldState,
  KanbanEditorSession,
  KanbanEditorSetValueResult,
} from './types.js';
import { resolveKanbanEditorMessage } from './presentation-text.js';

/** Immutable empty diagnostic collection shared by successful standard bindings. */
const NO_DIAGNOSTICS: readonly KanbanEditorDiagnostic[] = Object.freeze([]);
/** Conservative width used by ordinary single-line fields. */
const SINGLE_LINE_PREFERRED_WIDTH = 32;
/** Conservative height used by the standard multiline editor. */
const MULTILINE_ROWS = 5;

/** Options used to create one standard or registered custom field binding. */
export interface KanbanEditorControlBindingOptions<TCard, TDraft> {
  /** Validated field descriptor whose value is owned by `session`. */
  readonly field: KanbanCardEditorField<TDraft, unknown, TCard>;
  /** Session that remains the sole parser, validation, focus, and mutation authority. */
  readonly session: KanbanEditorSession;
  /** Optional validated registry that owns application custom-control factories. */
  readonly controls?: KanbanEditorControlRegistry;
  /** Optional application translation service used for choice labels and safe fallback text. */
  readonly i18n?: I18n;
}

/** One disposable view binding consumed by the responsive editor dialog. */
export interface KanbanEditorControlBinding {
  /** Stable schema field identity represented by this binding. */
  readonly fieldId: KanbanEditorFieldState['fieldId'];
  /** Mounted field view. */
  readonly view: View;
  /** Returns terminal-cell geometry for the current available width. */
  readonly measure: (availableWidth: number) => KanbanEditorControlMeasurement;
  /** Returns safe package diagnostics produced while constructing the binding. */
  readonly diagnostics: () => readonly KanbanEditorDiagnostic[];
  /** Releases the session subscription, custom control, and cancellation signal idempotently. */
  readonly dispose: () => void;
}

/** Internal lifecycle shared by standard and application-owned controls. */
interface BindingLifetime {
  readonly controller: AbortController;
  readonly disposed: () => boolean;
  readonly dispose: () => void;
}

/** Narrow field shape required by choice mapping and standard measurement. */
type MeasurableField = Pick<KanbanCardEditorField<unknown, unknown, unknown>, 'choices' | 'kind'>;

/** A control-facing signal plus a package-only synchronization write that bypasses session mutation. */
interface SessionSignal<T> {
  readonly value: Signal<T>;
  readonly synchronize: (value: T, force?: boolean) => void;
}

/** Creates one abortable, idempotent binding lifetime. */
function createBindingLifetime(): BindingLifetime {
  const controller = new AbortController();
  let isDisposed = false;
  return {
    controller,
    disposed: () => isDisposed,
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      controller.abort();
    },
  };
}

/** Resolves one label without retaining or evaluating arbitrary application objects. */
function translate(i18n: I18n | undefined, messageId: string, defaultMessage = messageId): string {
  return resolveKanbanEditorMessage(i18n, messageId, defaultMessage);
}

/** Produces canonical equality without allowing an invalid application value to escape. */
function semanticEqual(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeKanbanSemanticValue(left) === canonicalizeKanbanSemanticValue(right);
  } catch {
    return false;
  }
}

/** Maps the current semantic field value to one registered choice index. */
function selectedChoiceIndex(value: KanbanSemanticValue | undefined, field: MeasurableField): number {
  if (value === undefined) return -1;
  return field.choices?.findIndex((choice) => semanticEqual(choice.value, value)) ?? -1;
}

/** Maps a semantic selected-value array to choice flags in schema order. */
function selectedChoiceFlags(value: KanbanSemanticValue | undefined, field: MeasurableField): boolean[] {
  const selected = Array.isArray(value) ? value : [];
  return (field.choices ?? []).map((choice) => selected.some((item) => semanticEqual(item, choice.value)));
}

/** Creates a signal lens that sends control writes through the session before mirroring them locally. */
function sessionSignal<T>(options: {
  readonly initial: T;
  readonly lifetime: BindingLifetime;
  readonly write: (value: T) => KanbanEditorSetValueResult;
  readonly authoritative: () => T;
}): SessionSignal<T> {
  const local = signal(options.initial);
  let writing = false;
  let correctableInvalid = false;
  const set = (value: T): void => {
    if (options.lifetime.disposed()) return;
    // Suppress the synchronous session notification until the mutation outcome tells us whether the
    // local value is a correctable parse error or must be restored from authoritative state.
    writing = true;
    local.set(value);
    const result = options.write(value);
    writing = false;
    correctableInvalid = result.kind === 'invalid-value';
    if (result.kind !== 'accepted' && result.kind !== 'invalid-value') local.set(options.authoritative());
  };
  const value = Object.assign(() => local(), {
    peek: () => local.peek(),
    set,
    update: (update: (previous: T) => T) => set(update(local.peek())),
  });
  return {
    value,
    synchronize: (next, force = false) => {
      if (writing || (correctableInvalid && !force)) return;
      correctableInvalid = false;
      local.set(next);
    },
  };
}

/** Validates the public measurement input used by both standard and custom bindings. */
function availableWidth(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

/** Returns a bounded measurement for one standard field. */
function standardMeasurement(field: MeasurableField, width: number): KanbanEditorControlMeasurement {
  const choices = field.choices ?? [];
  const longestChoice = choices.reduce((longest, choice) => Math.max(longest, stringWidth(choice.labelId)), 0);
  const rows =
    field.kind === 'multiline' ? MULTILINE_ROWS : field.kind.includes('choice') ? Math.max(1, choices.length) : 1;
  const minimumWidth = field.kind.includes('choice') ? Math.max(8, Math.min(24, longestChoice + 5)) : 8;
  const preferredWidth = Math.max(
    minimumWidth,
    Math.min(48, field.kind === 'multiline' ? 48 : SINGLE_LINE_PREFERRED_WIDTH),
  );
  return Object.freeze({ minimumWidth: Math.min(minimumWidth, availableWidth(width)), preferredWidth, rows });
}

/** Applies the latest visibility and read-only state to one standard control. */
function synchronizeView(view: View, state: KanbanEditorFieldState): void {
  const visibilityChanged = view.state.visible !== state.visible;
  const disabledChanged = view.state.disabled !== state.readOnly;
  view.state.visible = state.visible;
  view.state.disabled = state.readOnly;
  if (visibilityChanged) view.invalidateLayout();
  else if (disabledChanged) view.invalidate();
}

/** Mirrors UI focus into the stable session field identity after the view is mounted. */
function bindFocusIdentity(view: View, session: KanbanEditorSession, fieldId: KanbanEditorFieldState['fieldId']): void {
  view.onMount(() =>
    view.bind(
      () => view.focusSignal()(),
      () => {
        if (view.state.focused) session.focusField(fieldId);
      },
    ),
  );
}

/** Creates a safe non-interactive replacement when a custom factory cannot be mounted. */
function failedCustomBinding(
  fieldId: KanbanEditorFieldState['fieldId'],
  i18n: I18n | undefined,
): KanbanEditorControlBinding {
  const diagnostic = Object.freeze({ code: 'custom-control-failed', messageId: 'kanban.editor.control-unavailable' });
  const diagnostics = Object.freeze([diagnostic]);
  return Object.freeze({
    fieldId,
    view: new Text(translate(i18n, diagnostic.messageId, 'Control unavailable'), { severity: 'error' }),
    measure: (width: number) => Object.freeze({ minimumWidth: 8, preferredWidth: 24, rows: width < 16 ? 2 : 1 }),
    diagnostics: () => diagnostics,
    dispose: () => undefined,
  });
}

/** Creates and owns one registered application control through the bounded field context. */
function createCustomBinding<TCard, TDraft>(
  options: KanbanEditorControlBindingOptions<TCard, TDraft>,
): KanbanEditorControlBinding {
  const { field, session } = options;
  const registration = field.controlId === undefined ? undefined : options.controls?.control(field.controlId);
  if (registration === undefined) return failedCustomBinding(field.fieldId, options.i18n);
  const lifetime = createBindingLifetime();
  const context: KanbanEditorControlContext = Object.freeze({
    fieldId: field.fieldId,
    mode: session.snapshot().mode,
    value: () => session.fieldValue(field.fieldId),
    state: () => session.fieldState(field.fieldId),
    setValue: (value: unknown) => session.setValue(field.fieldId, value),
    focus: () => session.focusField(field.fieldId),
    signal: lifetime.controller.signal,
  });
  let instance: ReturnType<typeof registration.create> | undefined;
  let unsubscribe: (() => void) | undefined;
  try {
    instance = registration.create(context);
    const mountedInstance = instance;
    bindFocusIdentity(mountedInstance.view, session, field.fieldId);
    synchronizeView(mountedInstance.view, session.fieldState(field.fieldId));
    unsubscribe = session.subscribe(() => {
      if (!lifetime.disposed()) {
        synchronizeView(mountedInstance.view, session.fieldState(field.fieldId));
        mountedInstance.view.invalidate();
      }
    });
    let disposed = false;
    return Object.freeze({
      fieldId: field.fieldId,
      view: mountedInstance.view,
      measure: mountedInstance.measure,
      diagnostics: () => NO_DIAGNOSTICS,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        try {
          unsubscribe?.();
        } catch {
          // Cleanup continues independently when an application unsubscriber throws.
        }
        try {
          lifetime.dispose();
        } finally {
          try {
            mountedInstance.dispose();
          } catch {
            // A hostile custom disposer cannot retain the package-owned cancellation lifetime.
          }
        }
      },
    });
  } catch {
    try {
      unsubscribe?.();
    } catch {
      // Cleanup continues independently when an application unsubscriber throws.
    }
    lifetime.dispose();
    try {
      instance?.dispose();
    } catch {
      // A hostile custom disposer cannot prevent the payload-free fallback from mounting.
    }
    return failedCustomBinding(field.fieldId, options.i18n);
  }
}

/**
 * Creates one reactive control binding for any validated editor field kind.
 *
 * Standard controls and application controls both mutate through the supplied session. The returned
 * binding owns its subscription and must be disposed when its dialog field is removed.
 *
 * @example
 * ```ts
 * const binding = createKanbanEditorControlBinding({ field, session, i18n });
 * fieldHost.add(binding.view);
 * // Later, when the field host is removed:
 * binding.dispose();
 * ```
 */
export function createKanbanEditorControlBinding<TCard, TDraft>(
  options: KanbanEditorControlBindingOptions<TCard, TDraft>,
): KanbanEditorControlBinding {
  if (options.field.kind === 'custom') return createCustomBinding(options);

  const { field, session } = options;
  const lifetime = createBindingLifetime();
  const state = session.fieldState(field.fieldId);
  let synchronizeValue: (force?: boolean) => void;
  let view: View;

  if (field.kind === 'boolean') {
    const binding = sessionSignal({
      initial: session.fieldValue(field.fieldId) === true,
      lifetime,
      write: (next) => session.setValue(field.fieldId, next),
      authoritative: () => session.fieldValue(field.fieldId) === true,
    });
    synchronizeValue = (force) => binding.synchronize(session.fieldValue(field.fieldId) === true, force);
    view = new Switch({ value: binding.value, i18n: options.i18n, onLabel: '', offLabel: '' });
  } else if (field.kind === 'single-choice') {
    const binding = sessionSignal({
      initial: selectedChoiceIndex(session.fieldValue(field.fieldId), field),
      lifetime,
      write: (index) => {
        const choice = field.choices?.[index];
        return choice === undefined
          ? session.setValue(field.fieldId, undefined)
          : session.setValue(field.fieldId, choice.value);
      },
      authoritative: () => selectedChoiceIndex(session.fieldValue(field.fieldId), field),
    });
    synchronizeValue = (force) =>
      binding.synchronize(selectedChoiceIndex(session.fieldValue(field.fieldId), field), force);
    view = new RadioGroup({
      labels: (field.choices ?? []).map((choice) => translate(options.i18n, choice.labelId)),
      value: binding.value,
    });
  } else if (field.kind === 'multiple-choice') {
    const binding = sessionSignal({
      initial: selectedChoiceFlags(session.fieldValue(field.fieldId), field),
      lifetime,
      write: (flags) =>
        session.setValue(
          field.fieldId,
          (field.choices ?? []).filter((_, index) => flags[index] === true).map((choice) => choice.value),
        ),
      authoritative: () => selectedChoiceFlags(session.fieldValue(field.fieldId), field),
    });
    synchronizeValue = (force) =>
      binding.synchronize(selectedChoiceFlags(session.fieldValue(field.fieldId), field), force);
    view = new CheckGroup({
      labels: (field.choices ?? []).map((choice) => translate(options.i18n, choice.labelId)),
      value: binding.value,
    });
  } else {
    const binding = sessionSignal({
      initial: state.displayValue,
      lifetime,
      write: (next) => session.setValue(field.fieldId, field.kind === 'number' && next !== '' ? Number(next) : next),
      authoritative: () => session.fieldState(field.fieldId).displayValue,
    });
    synchronizeValue = (force) => {
      const next = session.fieldState(field.fieldId).displayValue;
      if (next !== binding.value.peek()) binding.synchronize(next, force);
    };
    view = field.kind === 'multiline' ? new Memo({ value: binding.value }) : new Input({ value: binding.value });
  }

  synchronizeView(view, state);
  bindFocusIdentity(view, session, field.fieldId);
  const unsubscribe = session.subscribe(() => {
    if (lifetime.disposed()) return;
    const nextState = session.fieldState(field.fieldId);
    synchronizeValue(!nextState.touched && nextState.diagnostics.length === 0);
    synchronizeView(view, nextState);
  });
  let disposed = false;
  return Object.freeze({
    fieldId: field.fieldId,
    view,
    measure: (width: number) => standardMeasurement(field, width),
    diagnostics: () => NO_DIAGNOSTICS,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        unsubscribe();
      } finally {
        lifetime.dispose();
      }
    },
  });
}
