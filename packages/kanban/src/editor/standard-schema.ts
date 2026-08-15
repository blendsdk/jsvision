import { KanbanInvalidEditorSchemaError } from '../contract/error.js';
import type { KanbanFieldId } from '../contract/identity.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { StandardCard } from '../card/standard-card.js';
import { createKanbanEditorControlRegistry } from './registry.js';
import { createStandardChecklistControl, createStandardSummaryControl } from './standard-collection-controls.js';
import { createKanbanCardEditorSchema } from './schema.js';
import type {
  KanbanCardEditorField,
  KanbanCardEditorSchema,
  KanbanCardEditorSection,
  KanbanEditorControlRegistry,
  KanbanEditorFieldCallbackInput,
} from './types.js';

/** Closed set of mainstream fields supplied by the standard card adapter. */
export type StandardKanbanEditorFieldId =
  | 'title'
  | 'status'
  | 'description'
  | 'type'
  | 'priority'
  | 'assignees'
  | 'labels'
  | 'startDate'
  | 'dueDate'
  | 'estimate'
  | 'checklists';

/** Detached standard draft; dynamic application fields remain explicitly unknown until snapshotted. */
export interface StandardKanbanEditorDraft {
  /** Allows registered additional fields to retain typed values at the heterogeneous boundary. */
  readonly [fieldId: string]: unknown;
  /** Existing application-owned identity used by update proposals. */
  readonly key: string | number;
  /** Required primary label. */
  readonly title: string;
  /** Required application workflow status. */
  readonly status: string;
  /** Optional long-form description represented as editable text. */
  readonly description: string;
  /** Optional application-formatted work-item type. */
  readonly type: string;
  /** Optional application-formatted priority. */
  readonly priority: string;
  /** Ordered detached assignee summaries. */
  readonly assignees: readonly KanbanSemanticValue[];
  /** Ordered detached card labels. */
  readonly labels: readonly KanbanSemanticValue[];
  /** Optional ISO/application date text. */
  readonly startDate: string;
  /** Optional ISO/application date text. */
  readonly dueDate: string;
  /** Optional application-formatted estimate. */
  readonly estimate: string;
  /** Ordered detached checklist groups and stable item identities. */
  readonly checklists: readonly KanbanSemanticValue[];
  /** Bounded application-specific values consumed by additional field descriptors. */
  readonly custom: KanbanSemanticValue;
}

/** Standard editor record accepted at the public convenience-model boundary. */
export type StandardKanbanEditableCard = StandardCard;

/** Payload-free validator shared between Zod and the generic session protocol. */
export type StandardKanbanFieldValidator = (
  fieldId: StandardKanbanEditorFieldId | KanbanFieldId,
  value: unknown,
) => boolean;

/** Internal inputs used to assemble one configured standard schema. */
export interface StandardKanbanSchemaOptions {
  /** Ordered unique standard field selection. */
  readonly fields: readonly StandardKanbanEditorFieldId[];
  /** Optional application sections appended after standard sections. */
  readonly additionalSections?: readonly KanbanCardEditorSection[];
  /** Optional application fields over the same detached standard draft. */
  readonly additionalFields?: readonly KanbanCardEditorField<
    StandardKanbanEditorDraft,
    unknown,
    StandardKanbanEditableCard
  >[];
  /** Optional application custom-control registrations. */
  readonly controls?: KanbanEditorControlRegistry;
  /** Field-level Zod validity callback that never exposes issue payloads. */
  readonly valid: StandardKanbanFieldValidator;
}

/** Mainstream field order used when callers omit explicit configuration. */
export const STANDARD_KANBAN_EDITOR_FIELDS: readonly StandardKanbanEditorFieldId[] = Object.freeze([
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
  'checklists',
]);

/** Package control identities reserved for collection-oriented standard fields. */
const CONTROL_IDS = Object.freeze({
  assignees: 'jsvision.kanban.editor.assignees',
  labels: 'jsvision.kanban.editor.labels',
  checklists: 'jsvision.kanban.editor.checklists',
});

/** Returns the stable standard section for one mainstream field. */
function sectionOf(fieldId: StandardKanbanEditorFieldId): string {
  if (fieldId === 'assignees' || fieldId === 'labels') return 'people';
  if (fieldId === 'checklists') return 'checklists';
  if (fieldId === 'title' || fieldId === 'status' || fieldId === 'description') return 'main';
  return 'details';
}

/** Returns the generic control kind for one standard value. */
function kindOf(fieldId: StandardKanbanEditorFieldId): KanbanCardEditorField<StandardKanbanEditorDraft>['kind'] {
  if (fieldId === 'description') return 'multiline';
  if (fieldId === 'startDate' || fieldId === 'dueDate') return 'date';
  if (fieldId === 'assignees' || fieldId === 'labels' || fieldId === 'checklists') return 'custom';
  return 'text';
}

/** Returns the package custom-control identity for a collection field. */
function controlIdOf(fieldId: StandardKanbanEditorFieldId): string | undefined {
  switch (fieldId) {
    case 'assignees':
      return CONTROL_IDS.assignees;
    case 'labels':
      return CONTROL_IDS.labels;
    case 'checklists':
      return CONTROL_IDS.checklists;
    default:
      return undefined;
  }
}

/** Converts camel-cased standard field identities to the catalog's lowercase dotted-key grammar. */
function fieldLabelId(fieldId: StandardKanbanEditorFieldId): string {
  if (fieldId === 'startDate') return 'kanban.editor.field.start-date';
  if (fieldId === 'dueDate') return 'kanban.editor.field.due-date';
  return `kanban.editor.field.${fieldId}`;
}

/** Builds one package custom-control registration for a collection-oriented standard field. */
function collectionControl(fieldId: keyof typeof CONTROL_IDS) {
  return Object.freeze({
    controlId: CONTROL_IDS[fieldId],
    create: (context?: Parameters<typeof createStandardChecklistControl>[0]) => {
      if (context === undefined) throw new KanbanInvalidEditorSchemaError();
      return fieldId === 'checklists' ? createStandardChecklistControl(context) : createStandardSummaryControl(context);
    },
  });
}

/** Merges package collection controls with an optional application registry. */
function standardControls(options: StandardKanbanSchemaOptions): KanbanEditorControlRegistry | undefined {
  const required = options.fields.filter(
    (fieldId): fieldId is keyof typeof CONTROL_IDS =>
      fieldId === 'assignees' || fieldId === 'labels' || fieldId === 'checklists',
  );
  const registrations = [...required.map(collectionControl), ...(options.controls?.controls ?? [])];
  return registrations.length === 0 ? undefined : createKanbanEditorControlRegistry({ controls: registrations });
}

/** Creates one generic field descriptor backed by a property in the detached standard draft. */
function standardField(
  fieldId: StandardKanbanEditorFieldId,
  order: number,
  valid: StandardKanbanFieldValidator,
): KanbanCardEditorField<StandardKanbanEditorDraft, unknown, StandardKanbanEditableCard> {
  const controlId = controlIdOf(fieldId);
  return Object.freeze({
    fieldId,
    sectionId: sectionOf(fieldId),
    kind: kindOf(fieldId),
    labelId: fieldLabelId(fieldId),
    order,
    read: (draft: StandardKanbanEditorDraft) => draft[fieldId],
    write: (draft: StandardKanbanEditorDraft, value: unknown) => Object.freeze({ ...draft, [fieldId]: value }),
    validate: [
      ({ value }: KanbanEditorFieldCallbackInput<StandardKanbanEditableCard, StandardKanbanEditorDraft, unknown>) =>
        valid(fieldId, value) ? undefined : Object.freeze({ code: 'invalid-standard-field' }),
    ],
    ...(controlId === undefined ? {} : { controlId }),
  });
}

/** Returns standard section metadata, retaining only sections needed by selected fields. */
function standardSections(fields: readonly StandardKanbanEditorFieldId[]): readonly KanbanCardEditorSection[] {
  const selected = new Set(fields.map(sectionOf));
  return Object.freeze(
    [
      { sectionId: 'main', labelId: 'kanban.editor.section.main', order: 0 },
      { sectionId: 'details', labelId: 'kanban.editor.section.details', order: 1 },
      { sectionId: 'people', labelId: 'kanban.editor.section.people', order: 2 },
      {
        sectionId: 'checklists',
        labelId: 'kanban.editor.section.checklists',
        order: 3,
        presentation: 'collapsible' as const,
        initialCollapsed: true,
        secondaryDense: true,
      },
    ].filter(({ sectionId }) => selected.has(sectionId)),
  );
}

/**
 * Builds the generic schema used by the standard adapter and later standard dialog.
 *
 * @throws {KanbanInvalidEditorSchemaError} When configured field identities are duplicate or unknown.
 *
 * @example
 * ```ts
 * const schema = createStandardKanbanEditorSchema({ fields: ['title', 'status'] });
 * ```
 */
export function createStandardKanbanEditorSchema(
  options: StandardKanbanSchemaOptions,
): KanbanCardEditorSchema<StandardKanbanEditableCard, StandardKanbanEditorDraft> {
  if (new Set(options.fields).size !== options.fields.length) throw new KanbanInvalidEditorSchemaError();
  if (options.fields.some((fieldId) => !STANDARD_KANBAN_EDITOR_FIELDS.includes(fieldId))) {
    throw new KanbanInvalidEditorSchemaError();
  }
  const sections = Object.freeze([...standardSections(options.fields), ...(options.additionalSections ?? [])]);
  const fields = Object.freeze([
    ...options.fields.map((fieldId, order) => standardField(fieldId, order, options.valid)),
    ...(options.additionalFields ?? []),
  ]);
  const controls = standardControls(options);
  return createKanbanCardEditorSchema({
    revision: 'standard-editor-v1',
    sections,
    fields,
    ...(controls === undefined ? {} : { controls }),
  });
}
