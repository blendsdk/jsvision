import { createForm } from '@jsvision/forms';
import type { Signal } from '@jsvision/ui';
import { z } from 'zod';

import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidEditorSchemaError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import type { KanbanCellAddress } from '../source/types.js';
import { invokeKanbanEditorCallback } from './registry.js';
import { createStandardKanbanEditorSchema, STANDARD_KANBAN_EDITOR_FIELDS } from './standard-schema.js';
import type {
  StandardKanbanEditableCard,
  StandardKanbanEditorDraft,
  StandardKanbanEditorFieldId,
} from './standard-schema.js';
import type {
  KanbanCardEditorAdapter,
  KanbanCardEditorField,
  KanbanCardEditorSection,
  KanbanEditorControlRegistry,
} from './types.js';

/** Minimal parse result required from a configured standard editor schema. */
export interface StandardKanbanFormParseResult {
  /** Whether the supplied value satisfies the schema. */
  readonly success: boolean;
}

/** Zod-compatible field contract kept structural so generic package types do not load Zod declarations. */
export interface StandardKanbanFormFieldSchema {
  /** Validates one field value without throwing. */
  safeParse(value: unknown): StandardKanbanFormParseResult;
}

/** Zod-object-compatible contract used at the configured-field boundary. */
export interface StandardKanbanFormSchema {
  /** Field schemas keyed by configured editor field identity. */
  readonly shape: Readonly<Record<string, StandardKanbanFormFieldSchema>>;
  /** Validates the complete raw form record without throwing. */
  safeParse(value: unknown): StandardKanbanFormParseResult;
}

/** Raw Forms record keyed by validated editor field identities. */
export type StandardKanbanFormValues = Record<string, unknown>;

/** Zod-free field handle exposed by the standard editor's Forms store. */
export interface StandardKanbanEditorFormField {
  /** Stable field identity. */
  readonly name: string;
  /** Reactive raw editing value. */
  readonly value: Signal<unknown>;
  /** First synchronous validation issue, or `null` when clean. */
  error(): unknown | null;
  /** Whether the field has been interacted with. */
  touched(): boolean;
  /** Whether the field differs from its baseline. */
  dirty(): boolean;
  /** Whether asynchronous validation is currently running. */
  validating(): boolean;
  /** Latest asynchronous validation message. */
  asyncError(): string | null;
}

/** Disposable Zod-free view of the Forms store owned by one mounted standard editor. */
export interface StandardKanbanEditorForm {
  /** Returns the stable handle for one configured field. */
  field(name: string): StandardKanbanEditorFormField;
  /** Returns validated values, or `null` while the form is invalid. */
  values(): StandardKanbanFormValues | null;
  /** Returns the live raw editing snapshot. */
  rawValues(): StandardKanbanFormValues;
  /** Returns form-level validation issues without exposing a Zod-owned public type. */
  errors(): readonly unknown[];
  /** Reports whether synchronous and completed asynchronous validation pass. */
  isValid(): boolean;
  /** Reports whether any field differs from its baseline. */
  dirty(): boolean;
  /** Reports whether asynchronous field validation is running. */
  validating(): boolean;
  /** Reports whether form submission is running. */
  submitting(): boolean;
  /** Reports whether an asynchronous record load is running. */
  loading(): boolean;
  /** Loads and rebases a complete raw editing record. */
  load(loader: (context: { readonly signal: AbortSignal }) => Promise<StandardKanbanFormValues>): Promise<boolean>;
  /** Validates and submits the current complete form values. */
  submit(handler: (values: StandardKanbanFormValues) => void | Promise<void>): Promise<boolean>;
  /** Restores the current baseline and clears interaction state. */
  reset(): void;
  /** Releases the form's reactive and asynchronous resources. */
  dispose(): void;
}

type RuntimeStandardKanbanFormSchema = z.ZodObject<Record<string, z.ZodType>>;

const ADAPTER_OPTION_KEYS = new Set([
  'fields',
  'schema',
  'additionalSections',
  'additionalFields',
  'controls',
  'formatDate',
  'create',
]);
const STANDARD_CARD_KEYS = new Set([
  'key',
  'columnId',
  'swimlaneId',
  'rank',
  'presentationRevision',
  'title',
  'status',
  'description',
  'type',
  'priority',
  'assignees',
  'labels',
  'startDate',
  'dueDate',
  'estimate',
  'value',
  'checklists',
  'summaries',
  'custom',
]);
const SUMMARY_KEYS = new Set(['id', 'label']);
const CHECKLIST_KEYS = new Set(['checklistId', 'title', 'items']);
const CHECKLIST_ITEM_KEYS = new Set(['itemId', 'text', 'completed']);

/** Configuration accepted by the mainstream standard card adapter. */
export interface StandardKanbanEditorAdapterOptions {
  /** Ordered unique mainstream fields; all standard fields are used when omitted. */
  readonly fields?: readonly StandardKanbanEditorFieldId[];
  /** Optional consumer Zod 4 schema used by the standard Forms store. */
  readonly schema?: StandardKanbanFormSchema;
  /** Optional application sections appended to the standard section sequence. */
  readonly additionalSections?: readonly KanbanCardEditorSection[];
  /** Optional application fields operating on the same detached draft. */
  readonly additionalFields?: readonly KanbanCardEditorField<
    StandardKanbanEditorDraft,
    unknown,
    StandardKanbanEditableCard
  >[];
  /** Optional application custom-control registry used by additional fields. */
  readonly controls?: KanbanEditorControlRegistry;
  /** Optional formatter that converts opaque StandardCard dates into editable text. */
  readonly formatDate?: (value: unknown) => string;
  /** Explicit defaults and semantic destination required when this adapter serves create mode. */
  readonly create?: StandardKanbanEditorCreateOptions;
}

/** Safe scalar defaults used to initialize one standard create draft. */
export interface StandardKanbanEditorCreateDefaults {
  /** Required initial card title. */
  readonly title: string;
  /** Required initial workflow status. */
  readonly status: string;
  /** Optional initial description. */
  readonly description?: string;
  /** Optional initial work-item type. */
  readonly type?: string;
  /** Optional initial priority. */
  readonly priority?: string;
  /** Optional initial start-date text. */
  readonly startDate?: string;
  /** Optional initial due-date text. */
  readonly dueDate?: string;
  /** Optional initial estimate text. */
  readonly estimate?: string;
}

/** Standard-card creation configuration with an application-owned semantic destination. */
export interface StandardKanbanEditorCreateOptions {
  /** Column and optional swimlane that receive the new card. */
  readonly target: KanbanCellAddress;
  /** Detached scalar defaults; collection fields start empty and remain editable. */
  readonly defaults: StandardKanbanEditorCreateDefaults;
}

/** Standard adapter with an explicit disposable Forms factory for dialog composition. */
export interface StandardKanbanEditorAdapter extends KanbanCardEditorAdapter<
  StandardKanbanEditableCard,
  StandardKanbanEditorDraft
> {
  /** Consumer or package Zod schema used by every created form. */
  readonly formSchema: StandardKanbanFormSchema;
  /** Creates one disposable headless Forms owner from the current detached draft. */
  createForm(draft: StandardKanbanEditorDraft): StandardKanbanEditorForm;
}

/** Creates the default Zod shape for one configured standard/application field set. */
function defaultFormSchema(
  fields: readonly StandardKanbanEditorFieldId[],
  additionalFields: readonly KanbanCardEditorField<StandardKanbanEditorDraft, unknown, StandardKanbanEditableCard>[],
): RuntimeStandardKanbanFormSchema {
  const shape: Record<string, z.ZodType> = {};
  for (const fieldId of fields) {
    switch (fieldId) {
      case 'title':
      case 'status':
        shape[fieldId] = z.string().min(1);
        break;
      case 'description':
      case 'type':
      case 'priority':
      case 'startDate':
      case 'dueDate':
      case 'estimate':
        shape[fieldId] = z.string();
        break;
      case 'assignees':
        shape[fieldId] = z.array(z.object({ id: z.string().min(1), label: z.string() }).strict());
        break;
      case 'labels':
        shape[fieldId] = z.array(z.object({ id: z.string().min(1), label: z.string() }).strict());
        break;
      case 'checklists':
        shape[fieldId] = z.array(
          z
            .object({
              checklistId: z.string().min(1),
              title: z.string().optional(),
              items: z.array(
                z.object({ itemId: z.string().min(1), text: z.string(), completed: z.boolean() }).strict(),
              ),
            })
            .strict(),
        );
        break;
    }
  }
  for (const field of additionalFields) shape[field.fieldId] = z.unknown();
  return z.object(shape).strict();
}

/** Validates that a consumer schema owns every configured field without inspecting its validators. */
function validateFormSchema(schema: unknown, fieldIds: readonly string[]): RuntimeStandardKanbanFormSchema {
  if (!(schema instanceof z.ZodObject) || fieldIds.some((fieldId) => schema.shape[fieldId] === undefined)) {
    throw new KanbanInvalidEditorSchemaError();
  }
  return schema;
}

/** Snapshots compact application summaries into semantic records. */
function snapshotSummaries(
  values: readonly { readonly id: string; readonly label: string }[],
): readonly KanbanSemanticValue[] {
  const bounded = snapshotKanbanDataArray(values, KANBAN_LIMITS.cardFields.safe);
  return Object.freeze(
    bounded.map((value) => {
      const properties = snapshotKanbanDataProperties(value, SUMMARY_KEYS.size);
      validateKanbanDataKeys(properties, SUMMARY_KEYS);
      return snapshotKanbanSemanticValue({ id: properties.id, label: properties.label });
    }),
  );
}

/** Snapshots stable checklist identities, order, text, and completion values. */
function snapshotChecklists(
  groups: readonly NonNullable<StandardKanbanEditableCard['checklists']>[number][],
): readonly KanbanSemanticValue[] {
  const boundedGroups = snapshotKanbanDataArray(groups, KANBAN_LIMITS.checklistGroups.safe);
  return Object.freeze(
    boundedGroups.map((group) => {
      const properties = snapshotKanbanDataProperties(group, CHECKLIST_KEYS.size);
      validateKanbanDataKeys(properties, CHECKLIST_KEYS);
      const items = snapshotKanbanDataArray(group.items, KANBAN_LIMITS.checklistItemsPerGroup.safe).map((item) => {
        const itemProperties = snapshotKanbanDataProperties(item, CHECKLIST_ITEM_KEYS.size);
        validateKanbanDataKeys(itemProperties, CHECKLIST_ITEM_KEYS);
        return {
          itemId: itemProperties.itemId,
          text: itemProperties.text,
          completed: itemProperties.completed,
        };
      });
      return snapshotKanbanSemanticValue({
        checklistId: properties.checklistId,
        ...(properties.title === undefined ? {} : { title: properties.title }),
        items,
      });
    }),
  );
}

/** Accepts optional standard date text without coercing application objects. */
function dateText(value: unknown, format: ((value: unknown) => string) | undefined): string {
  if (value === undefined) return '';
  if (format === undefined) {
    if (typeof value !== 'string') throw new KanbanInvalidEditorSchemaError();
    return value;
  }
  const formatted = invokeKanbanEditorCallback(format, [value]);
  if (formatted.kind === 'failure' || typeof formatted.value !== 'string') throw new KanbanInvalidEditorSchemaError();
  return formatted.value;
}

/** Creates a detached complete standard draft without retaining source-owned collections. */
function createDraft(
  card: StandardKanbanEditableCard | undefined,
  formatDate: ((value: unknown) => string) | undefined,
  create: StandardKanbanEditorCreateOptions | undefined,
): StandardKanbanEditorDraft {
  try {
    if (card === undefined) {
      if (create === undefined) throw new KanbanInvalidEditorSchemaError();
      const defaults = snapshotKanbanDataProperties(create.defaults, 8);
      const allowed = new Set([
        'title',
        'status',
        'description',
        'type',
        'priority',
        'startDate',
        'dueDate',
        'estimate',
      ]);
      validateKanbanDataKeys(defaults, allowed);
      if (typeof defaults.title !== 'string' || typeof defaults.status !== 'string') {
        throw new KanbanInvalidEditorSchemaError();
      }
      for (const key of allowed) {
        if (defaults[key] !== undefined && typeof defaults[key] !== 'string') {
          throw new KanbanInvalidEditorSchemaError();
        }
      }
      const optionalText = (key: string): string => {
        const value = defaults[key];
        return typeof value === 'string' ? value : '';
      };
      return Object.freeze({
        key: createKanbanCardKey('new-card'),
        title: defaults.title,
        status: defaults.status,
        description: optionalText('description'),
        type: optionalText('type'),
        priority: optionalText('priority'),
        assignees: Object.freeze([]),
        labels: Object.freeze([]),
        startDate: optionalText('startDate'),
        dueDate: optionalText('dueDate'),
        estimate: optionalText('estimate'),
        checklists: Object.freeze([]),
        custom: null,
      });
    }
    const properties = snapshotKanbanDataProperties(card, STANDARD_CARD_KEYS.size);
    validateKanbanDataKeys(properties, STANDARD_CARD_KEYS);
    if (typeof properties.title !== 'string' || typeof properties.status !== 'string') {
      throw new KanbanInvalidEditorSchemaError();
    }
    if (typeof properties.key !== 'string' && typeof properties.key !== 'number') {
      throw new KanbanInvalidEditorSchemaError();
    }
    return Object.freeze({
      key: createKanbanCardKey(properties.key),
      title: properties.title,
      status: properties.status,
      description: typeof properties.description === 'string' ? properties.description : '',
      type: typeof properties.type === 'string' ? properties.type : '',
      priority: typeof properties.priority === 'string' ? properties.priority : '',
      assignees: snapshotSummaries(card.assignees ?? []),
      labels: snapshotSummaries(card.labels ?? []),
      startDate: dateText(properties.startDate, formatDate),
      dueDate: dateText(properties.dueDate, formatDate),
      estimate: typeof properties.estimate === 'string' ? properties.estimate : '',
      checklists: snapshotChecklists(card.checklists ?? []),
      custom: snapshotKanbanSemanticValue(properties.custom ?? null),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidEditorSchemaError) throw error;
    throw new KanbanInvalidEditorSchemaError();
  }
}

/** Reads every configured field through the normalized generic schema. */
function rawFormValues(
  draft: StandardKanbanEditorDraft,
  fields: readonly KanbanCardEditorField<StandardKanbanEditorDraft, unknown, StandardKanbanEditableCard>[],
): StandardKanbanFormValues {
  if (fields.length > KANBAN_LIMITS.cardFields.safe) throw new KanbanInvalidEditorSchemaError();
  const values: StandardKanbanFormValues = {};
  for (const field of fields) {
    const value = invokeKanbanEditorCallback(field.read, [draft]);
    if (value.kind === 'failure') throw new KanbanInvalidEditorSchemaError();
    values[field.fieldId] = value.value;
  }
  return values;
}

/** Converts configured raw form values into one bounded immutable semantic draft. */
function snapshotFormValues(values: StandardKanbanFormValues): KanbanSemanticValue {
  return snapshotKanbanSemanticValue(values);
}

/** Reads additional field identities through descriptors before schema construction invokes no behavior. */
function additionalFieldIds(
  fields: readonly KanbanCardEditorField<StandardKanbanEditorDraft, unknown, StandardKanbanEditableCard>[],
): readonly string[] {
  return Object.freeze(
    fields.map((field) => {
      const properties = snapshotKanbanDataProperties(field, KANBAN_LIMITS.cardFields.safe);
      if (typeof properties.fieldId !== 'string') throw new KanbanInvalidEditorSchemaError();
      return properties.fieldId;
    }),
  );
}

/**
 * Creates the optional mainstream StandardCard editor adapter.
 *
 * @example
 * ```ts
 * const adapter = createStandardKanbanEditorAdapter({ fields: ['title', 'status', 'checklists'] });
 * ```
 */
export function createStandardKanbanEditorAdapter(
  options: StandardKanbanEditorAdapterOptions = {},
): StandardKanbanEditorAdapter {
  try {
    const properties = snapshotKanbanDataProperties(options, ADAPTER_OPTION_KEYS.size);
    validateKanbanDataKeys(properties, ADAPTER_OPTION_KEYS);
    const selected = snapshotKanbanDataArray(
      options.fields ?? STANDARD_KANBAN_EDITOR_FIELDS,
      KANBAN_LIMITS.cardFields.safe,
    );
    const additionalFields = snapshotKanbanDataArray(options.additionalFields ?? [], KANBAN_LIMITS.cardFields.safe);
    const additionalSections = snapshotKanbanDataArray(options.additionalSections ?? [], KANBAN_LIMITS.cardFields.safe);
    if (options.formatDate !== undefined && typeof options.formatDate !== 'function') {
      throw new KanbanInvalidEditorSchemaError();
    }
    const createProposal =
      options.create === undefined
        ? undefined
        : snapshotKanbanRequestProposal({ kind: 'card-create', target: options.create.target, draft: null });
    if (createProposal !== undefined && createProposal.kind !== 'card-create')
      throw new KanbanInvalidEditorSchemaError();
    const fieldIds = [...selected, ...additionalFieldIds(additionalFields)];
    if (new Set(fieldIds).size !== fieldIds.length || fieldIds.length > KANBAN_LIMITS.cardFields.safe) {
      throw new KanbanInvalidEditorSchemaError();
    }
    const formSchema = validateFormSchema(options.schema ?? defaultFormSchema(selected, additionalFields), fieldIds);
    const schema = createStandardKanbanEditorSchema({
      fields: selected,
      additionalFields,
      ...(additionalSections.length === 0 ? {} : { additionalSections }),
      ...(options.controls === undefined ? {} : { controls: options.controls }),
      valid: (fieldId, value) => formSchema.shape[fieldId]?.safeParse(value).success === true,
    });
    const adapter: StandardKanbanEditorAdapter = {
      schema,
      formSchema,
      create: (card: StandardKanbanEditableCard | undefined) => createDraft(card, options.formatDate, options.create),
      snapshot: (draft: StandardKanbanEditorDraft) => snapshotFormValues(rawFormValues(draft, schema.fields)),
      proposal: (result) =>
        result.mode === 'create' && createProposal?.kind === 'card-create'
          ? { kind: 'card-create', target: createProposal.target, draft: result.snapshot }
          : { kind: 'card-update', cardKey: result.draft.key, patch: result.snapshot },
      createForm: (draft: StandardKanbanEditorDraft) => {
        const form = createForm({ schema: formSchema, initial: rawFormValues(draft, schema.fields) });
        return Object.freeze({
          field: (name: string) => form.field(name),
          values: () => form.values(),
          rawValues: () => form.rawValues(),
          errors: () => form.errors(),
          isValid: () => form.isValid(),
          dirty: () => form.dirty(),
          validating: () => form.validating(),
          submitting: () => form.submitting(),
          loading: () => form.loading(),
          load: (loader: (context: { readonly signal: AbortSignal }) => Promise<StandardKanbanFormValues>) =>
            form.load(loader),
          submit: (handler: (values: StandardKanbanFormValues) => void | Promise<void>) => form.submit(handler),
          reset: () => form.reset(),
          dispose: () => form.dispose(),
        });
      },
    };
    return Object.freeze(adapter);
  } catch (error) {
    if (error instanceof KanbanInvalidEditorSchemaError) throw error;
    throw new KanbanInvalidEditorSchemaError();
  }
}
