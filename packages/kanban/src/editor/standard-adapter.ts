import { createForm } from '@jsvision/forms';
import type { Form } from '@jsvision/forms';
import { z } from 'zod';

import { KanbanInvalidEditorSchemaError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
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

/** Dynamic Zod object used at the heterogeneous configured-field boundary. */
export type StandardKanbanFormSchema = z.ZodObject<Record<string, z.ZodType>>;
/** Raw Forms record keyed by validated editor field identities. */
export type StandardKanbanFormValues = Record<string, unknown>;
/** Disposable Forms store owned by one mounted standard editor. */
export type StandardKanbanEditorForm = Form<StandardKanbanFormSchema, StandardKanbanFormValues>;

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
): StandardKanbanFormSchema {
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
function validateFormSchema(schema: StandardKanbanFormSchema, fieldIds: readonly string[]): StandardKanbanFormSchema {
  if (fieldIds.some((fieldId) => schema.shape[fieldId] === undefined)) throw new KanbanInvalidEditorSchemaError();
  return schema;
}

/** Snapshots compact application summaries into semantic records. */
function snapshotSummaries(
  values: readonly { readonly id: string; readonly label: string }[],
): readonly KanbanSemanticValue[] {
  return Object.freeze(values.map((value) => snapshotKanbanSemanticValue({ id: value.id, label: value.label })));
}

/** Snapshots stable checklist identities, order, text, and completion values. */
function snapshotChecklists(card: StandardKanbanEditableCard): readonly KanbanSemanticValue[] {
  return Object.freeze(
    (card.checklists ?? []).map((group) =>
      snapshotKanbanSemanticValue({
        checklistId: group.checklistId,
        ...(group.title === undefined ? {} : { title: group.title }),
        items: group.items.map((item) => ({
          itemId: item.itemId,
          text: item.text,
          completed: item.completed,
        })),
      }),
    ),
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
): StandardKanbanEditorDraft {
  if (card === undefined) throw new KanbanInvalidEditorSchemaError();
  return Object.freeze({
    key: createKanbanCardKey(card.key),
    title: card.title,
    status: card.status,
    description: card.description ?? '',
    type: card.type ?? '',
    priority: card.priority ?? '',
    assignees: snapshotSummaries(card.assignees ?? []),
    labels: snapshotSummaries(card.labels ?? []),
    startDate: dateText(card.startDate, formatDate),
    dueDate: dateText(card.dueDate, formatDate),
    estimate: card.estimate ?? '',
    checklists: snapshotChecklists(card),
    custom: snapshotKanbanSemanticValue(card.custom ?? null),
  });
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
  const selected = Object.freeze([...(options.fields ?? STANDARD_KANBAN_EDITOR_FIELDS)]);
  const additionalFields = Object.freeze([...(options.additionalFields ?? [])]);
  const fieldIds = [...selected, ...additionalFields.map(({ fieldId }) => fieldId)];
  if (new Set(fieldIds).size !== fieldIds.length || fieldIds.length > KANBAN_LIMITS.cardFields.safe) {
    throw new KanbanInvalidEditorSchemaError();
  }
  const formSchema = validateFormSchema(options.schema ?? defaultFormSchema(selected, additionalFields), fieldIds);
  const schema = createStandardKanbanEditorSchema({
    fields: selected,
    additionalFields,
    ...(options.additionalSections === undefined ? {} : { additionalSections: options.additionalSections }),
    ...(options.controls === undefined ? {} : { controls: options.controls }),
    valid: (fieldId, value) => formSchema.shape[fieldId]?.safeParse(value).success === true,
  });
  const adapter: StandardKanbanEditorAdapter = {
    schema,
    formSchema,
    create: (card: StandardKanbanEditableCard | undefined) => createDraft(card, options.formatDate),
    snapshot: (draft: StandardKanbanEditorDraft) => snapshotFormValues(rawFormValues(draft, schema.fields)),
    proposal: (result) => ({ kind: 'card-update', cardKey: result.draft.key, patch: result.snapshot }),
    createForm: (draft: StandardKanbanEditorDraft) =>
      createForm({ schema: formSchema, initial: rawFormValues(draft, schema.fields) }),
  };
  return Object.freeze(adapter);
}
