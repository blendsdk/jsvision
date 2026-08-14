import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidEditorSchemaError } from '../contract/error.js';
import { createKanbanFieldId } from '../contract/identity.js';
import type { KanbanFieldId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import { isKanbanEditorControlRegistry } from './registry.js';
import type {
  KanbanCardEditorChoice,
  KanbanCardEditorField,
  KanbanCardEditorFieldKind,
  KanbanCardEditorSchema,
  KanbanCardEditorSection,
  KanbanEditorControlRegistry,
  KanbanEditorSectionId,
} from './types.js';

/** Input accepted by the exact generic editor-schema constructor. */
export interface KanbanCardEditorSchemaOptions<TCard, TDraft> {
  /** Equality-only application schema revision. */
  readonly revision: unknown;
  /** Finite ordered section metadata. */
  readonly sections: readonly KanbanCardEditorSection[];
  /** Finite typed heterogeneous field descriptors. */
  readonly fields: readonly KanbanCardEditorField<TDraft, unknown, TCard>[];
  /** Optional prevalidated custom-control registry. */
  readonly controls?: KanbanEditorControlRegistry;
}

/** Exact allowed schema-envelope members. */
const SCHEMA_KEYS = new Set(['revision', 'sections', 'fields', 'controls']);
/** Exact allowed section members. */
const SECTION_KEYS = new Set(['sectionId', 'labelId', 'order', 'presentation', 'initialCollapsed', 'secondaryDense']);
/** Exact allowed field members. */
const FIELD_KEYS = new Set([
  'fieldId',
  'sectionId',
  'kind',
  'labelId',
  'helpId',
  'order',
  'dependencies',
  'read',
  'write',
  'parse',
  'format',
  'validate',
  'validateAsync',
  'visible',
  'readOnly',
  'choices',
  'controlId',
]);
/** Exact allowed static-choice members. */
const CHOICE_KEYS = new Set(['choiceId', 'labelId', 'value']);
/** Conservative localization identity grammar shared by schema labels and help. */
const MESSAGE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/u;
/** Namespaced custom-control identities cannot name modules or host paths. */
const CONTROL_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/u;
/** Closed generic field-kind set. */
const FIELD_KINDS = new Set<KanbanCardEditorFieldKind>([
  'text',
  'multiline',
  'number',
  'boolean',
  'date',
  'single-choice',
  'multiple-choice',
  'custom',
]);

/** Converts every unsafe schema boundary failure into one payload-free public error. */
function invalidSchema(): never {
  throw new KanbanInvalidEditorSchemaError();
}

/** Returns true only for a bounded localization identity. */
function isMessageId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    MESSAGE_ID.test(value) &&
    new TextEncoder().encode(value).byteLength <= KANBAN_LIMITS.idBytes.safe
  );
}

/** Validates one non-negative deterministic schema order. */
function order(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    typeof value !== 'number' ||
    value < 0 ||
    value > KANBAN_LIMITS.cardFields.absolute
  ) {
    return invalidSchema();
  }
  return value;
}

/** Snapshots one function list without invoking application behavior. */
function callbacks(value: unknown, maximum: number): readonly ((...args: never[]) => unknown)[] | undefined {
  if (value === undefined) return undefined;
  const entries = snapshotKanbanDataArray(value, maximum);
  if (entries.some((entry) => typeof entry !== 'function')) return invalidSchema();
  return Object.freeze(entries as readonly ((...args: never[]) => unknown)[]);
}

/** Snapshots one section before field references are resolved. */
function snapshotSection(value: unknown): KanbanCardEditorSection {
  const properties = snapshotKanbanDataProperties(value, SECTION_KEYS.size);
  if (Object.keys(properties).some((key) => !SECTION_KEYS.has(key)) || !isMessageId(properties.labelId)) {
    return invalidSchema();
  }
  if (typeof properties.sectionId !== 'string') return invalidSchema();
  const sectionId = createKanbanFieldId(properties.sectionId);
  const presentation = properties.presentation;
  if (
    presentation !== undefined &&
    presentation !== 'section' &&
    presentation !== 'tab' &&
    presentation !== 'collapsible'
  ) {
    return invalidSchema();
  }
  if (
    (properties.initialCollapsed !== undefined && typeof properties.initialCollapsed !== 'boolean') ||
    (properties.secondaryDense !== undefined && typeof properties.secondaryDense !== 'boolean')
  ) {
    return invalidSchema();
  }
  return Object.freeze({
    sectionId,
    labelId: properties.labelId,
    order: order(properties.order),
    ...(presentation === undefined ? {} : { presentation }),
    ...(properties.initialCollapsed === undefined ? {} : { initialCollapsed: properties.initialCollapsed }),
    ...(properties.secondaryDense === undefined ? {} : { secondaryDense: properties.secondaryDense }),
  });
}

/** Snapshots one static choice without retaining caller-owned data containers. */
function snapshotChoice(value: unknown): KanbanCardEditorChoice {
  const properties = snapshotKanbanDataProperties(value, CHOICE_KEYS.size);
  if (
    Object.keys(properties).some((key) => !CHOICE_KEYS.has(key)) ||
    typeof properties.choiceId !== 'string' ||
    !isMessageId(properties.labelId)
  ) {
    return invalidSchema();
  }
  return Object.freeze({
    choiceId: createKanbanFieldId(properties.choiceId),
    labelId: properties.labelId,
    value: snapshotKanbanSemanticValue(properties.value),
  });
}

/** Snapshots stable dependency identities and rejects duplicates before graph traversal. */
function snapshotDependencies(value: unknown): readonly KanbanFieldId[] | undefined {
  if (value === undefined) return undefined;
  const dependencies = snapshotKanbanDataArray(value, KANBAN_LIMITS.cardFields.safe).map((entry) => {
    if (typeof entry !== 'string') return invalidSchema();
    return createKanbanFieldId(entry);
  });
  if (new Set(dependencies).size !== dependencies.length) return invalidSchema();
  return Object.freeze(dependencies);
}

/** Snapshots one heterogeneous field while retaining only explicitly registered callbacks. */
function snapshotField<TCard, TDraft>(
  value: unknown,
  controls: KanbanEditorControlRegistry | undefined,
): KanbanCardEditorField<TDraft, unknown, TCard> {
  const properties = snapshotKanbanDataProperties(value, FIELD_KEYS.size);
  if (Object.keys(properties).some((key) => !FIELD_KEYS.has(key))) return invalidSchema();
  if (
    typeof properties.fieldId !== 'string' ||
    typeof properties.sectionId !== 'string' ||
    typeof properties.kind !== 'string' ||
    !FIELD_KINDS.has(properties.kind as KanbanCardEditorFieldKind) ||
    !isMessageId(properties.labelId) ||
    (properties.helpId !== undefined && !isMessageId(properties.helpId)) ||
    typeof properties.read !== 'function' ||
    typeof properties.write !== 'function'
  ) {
    return invalidSchema();
  }
  const kind = properties.kind as KanbanCardEditorFieldKind;
  for (const callback of ['parse', 'format', 'visible', 'readOnly'] as const) {
    if (properties[callback] !== undefined && typeof properties[callback] !== 'function') return invalidSchema();
  }
  const validate = callbacks(properties.validate, KANBAN_LIMITS.cardFields.safe);
  const validateAsync = callbacks(properties.validateAsync, KANBAN_LIMITS.concurrentValidators.absolute);
  const dependencies = snapshotDependencies(properties.dependencies);
  const choices =
    properties.choices === undefined
      ? undefined
      : Object.freeze(
          snapshotKanbanDataArray(properties.choices, KANBAN_LIMITS.semanticArrayEntries.safe).map(snapshotChoice),
        );
  if ((kind === 'single-choice' || kind === 'multiple-choice') !== (choices !== undefined)) return invalidSchema();
  const controlId = properties.controlId;
  if (kind === 'custom') {
    if (typeof controlId !== 'string' || !CONTROL_ID.test(controlId) || controls?.control(controlId) === undefined) {
      return invalidSchema();
    }
  } else if (controlId !== undefined) return invalidSchema();

  return Object.freeze({
    fieldId: createKanbanFieldId(properties.fieldId),
    sectionId: createKanbanFieldId(properties.sectionId),
    kind,
    labelId: properties.labelId,
    order: order(properties.order),
    read: properties.read as KanbanCardEditorField<TDraft, unknown, TCard>['read'],
    write: properties.write as KanbanCardEditorField<TDraft, unknown, TCard>['write'],
    ...(properties.helpId === undefined ? {} : { helpId: properties.helpId }),
    ...(dependencies === undefined ? {} : { dependencies }),
    ...(properties.parse === undefined
      ? {}
      : { parse: properties.parse as KanbanCardEditorField<TDraft, unknown, TCard>['parse'] }),
    ...(properties.format === undefined
      ? {}
      : { format: properties.format as KanbanCardEditorField<TDraft, unknown, TCard>['format'] }),
    ...(validate === undefined
      ? {}
      : { validate: validate as KanbanCardEditorField<TDraft, unknown, TCard>['validate'] }),
    ...(validateAsync === undefined
      ? {}
      : { validateAsync: validateAsync as KanbanCardEditorField<TDraft, unknown, TCard>['validateAsync'] }),
    ...(properties.visible === undefined
      ? {}
      : { visible: properties.visible as KanbanCardEditorField<TDraft, unknown, TCard>['visible'] }),
    ...(properties.readOnly === undefined
      ? {}
      : { readOnly: properties.readOnly as KanbanCardEditorField<TDraft, unknown, TCard>['readOnly'] }),
    ...(choices === undefined ? {} : { choices }),
    ...(controlId === undefined ? {} : { controlId }),
  });
}

/** Rejects unknown field references and cycles without invoking any application predicate. */
function validateDependencyGraph<TCard, TDraft>(
  fields: readonly KanbanCardEditorField<TDraft, unknown, TCard>[],
  byId: ReadonlyMap<KanbanFieldId, KanbanCardEditorField<TDraft, unknown, TCard>>,
): void {
  const visiting = new Set<KanbanFieldId>();
  const visited = new Set<KanbanFieldId>();
  const visit = (fieldId: KanbanFieldId): void => {
    if (visited.has(fieldId)) return;
    if (visiting.has(fieldId)) return invalidSchema();
    const field = byId.get(fieldId);
    if (field === undefined) return invalidSchema();
    visiting.add(fieldId);
    for (const dependency of field.dependencies ?? []) visit(dependency);
    visiting.delete(fieldId);
    visited.add(fieldId);
  };
  for (const field of fields) visit(field.fieldId);
}

/**
 * Validates and detaches one finite Zod-free editor schema without invoking application callbacks.
 *
 * @example
 * ```ts
 * const schema = createKanbanCardEditorSchema({
 *   revision: 'schema-v1',
 *   sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
 *   fields: [{
 *     fieldId: 'title', sectionId: 'main', kind: 'text', labelId: 'app.fields.title', order: 0,
 *     read: (draft: { title: string }) => draft.title,
 *     write: (draft, title) => ({ ...draft, title }),
 *   }],
 * });
 * ```
 */
export function createKanbanCardEditorSchema<TCard = unknown, TDraft = unknown>(
  options: KanbanCardEditorSchemaOptions<TCard, TDraft>,
): KanbanCardEditorSchema<TCard, TDraft> {
  try {
    const properties = snapshotKanbanDataProperties(options, SCHEMA_KEYS.size);
    if (Object.keys(properties).some((key) => !SCHEMA_KEYS.has(key))) return invalidSchema();
    const controls = properties.controls;
    if (controls !== undefined && !isKanbanEditorControlRegistry(controls)) return invalidSchema();
    const sections = Object.freeze(
      snapshotKanbanDataArray(properties.sections, KANBAN_LIMITS.cardFields.safe)
        .map(snapshotSection)
        .sort((left, right) => left.order - right.order),
    );
    const sectionById = new Map<KanbanEditorSectionId, KanbanCardEditorSection>();
    for (const section of sections) {
      if (sectionById.has(section.sectionId)) return invalidSchema();
      sectionById.set(section.sectionId, section);
    }
    const fields = Object.freeze(
      snapshotKanbanDataArray(properties.fields, KANBAN_LIMITS.cardFields.safe)
        .map((field) => snapshotField<TCard, TDraft>(field, controls))
        .sort((left, right) => {
          const sectionOrder =
            (sectionById.get(left.sectionId)?.order ?? 0) - (sectionById.get(right.sectionId)?.order ?? 0);
          return sectionOrder === 0 ? left.order - right.order : sectionOrder;
        }),
    );
    const fieldById = new Map<KanbanFieldId, KanbanCardEditorField<TDraft, unknown, TCard>>();
    for (const field of fields) {
      if (!sectionById.has(field.sectionId) || fieldById.has(field.fieldId)) return invalidSchema();
      fieldById.set(field.fieldId, field);
    }
    validateDependencyGraph(fields, fieldById);
    const secondaryOpen = sections.filter(
      (section) => section.secondaryDense === true && section.initialCollapsed !== true,
    ).length;
    if (secondaryOpen > 1) return invalidSchema();
    return Object.freeze({
      revision: snapshotKanbanRevision(properties.revision),
      sections,
      fields,
      ...(controls === undefined ? {} : { controls }),
      field: (fieldId: KanbanFieldId) => fieldById.get(createKanbanFieldId(fieldId)),
      section: (sectionId: KanbanEditorSectionId) => sectionById.get(createKanbanFieldId(sectionId)),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidEditorSchemaError) throw error;
    return invalidSchema();
  }
}
