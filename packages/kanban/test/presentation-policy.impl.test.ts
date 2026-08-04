import { describe, expect, it } from 'vitest';

import {
  KANBAN_PRESENTATION_PRESETS,
  KanbanInvalidPresentationError,
  fingerprintKanbanSemanticValue,
  resolveKanbanCardPresentationSelection,
  resolveKanbanPresentation,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanCardPresentationMaximum,
  KanbanCustomPresentation,
  KanbanResolvedLimits,
  ResolvedKanbanPresentationBudget,
} from '../src/index.js';

/** Creates a complete valid custom input while allowing one boundary dimension to vary. */
function custom(replacement: Partial<KanbanCustomPresentation> = {}): KanbanCustomPresentation {
  return {
    revision: 'policy-v1',
    cardRows: 8,
    cardGap: 1,
    metadataFields: 3,
    labelRows: 2,
    summarySections: 2,
    checklistMode: 'preview',
    checklistPreviewItems: 3,
    ...replacement,
  };
}

/** Produces a semantic fingerprint without depending on object identity or frozen array prototypes. */
function fingerprint(value: ResolvedKanbanPresentationBudget): string {
  return fingerprintKanbanSemanticValue({ ...value, degradationOrder: [...value.degradationOrder] });
}

/** Creates one maximum whose mutable inputs can be changed after resolution. */
function maximum(
  budget: ResolvedKanbanPresentationBudget,
  limits: KanbanResolvedLimits,
  availableFieldIds: string[],
  availableSummaryIds: string[],
  availableChecklistIds: string[],
): KanbanCardPresentationMaximum {
  return { budget, limits, availableFieldIds, availableSummaryIds, availableChecklistIds };
}

describe('Kanban presentation policy implementation', () => {
  it('keeps named presets canonical and deeply immutable across repeated resolution', () => {
    for (const preset of ['compact', 'comfortable', 'spacious'] as const) {
      const first = resolveKanbanPresentation(preset);
      const second = resolveKanbanPresentation(preset);

      expect(first).toBe(KANBAN_PRESENTATION_PRESETS[preset]);
      expect(second).toBe(first);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.degradationOrder)).toBe(true);
      expect(fingerprint(first)).toBe(fingerprint(second));
    }
  });

  it('normalizes every valid degradation prefix into the same complete unique family order', () => {
    const expectedKinds = ['custom', 'checklist-preview', 'checklist-progress', 'summary', 'labels', 'metadata'];

    for (let prefixLength = 0; prefixLength <= expectedKinds.length; prefixLength += 1) {
      const prefix = expectedKinds.slice(0, prefixLength);
      const resolved = resolveKanbanPresentation(custom({ degradationOrder: prefix }));

      expect(resolved.degradationOrder).toEqual(expectedKinds);
      expect(new Set(resolved.degradationOrder).size).toBe(expectedKinds.length);
      expect(Object.isFrozen(resolved.degradationOrder)).toBe(true);
    }

    const reordered = resolveKanbanPresentation(
      custom({ degradationOrder: ['summary', 'metadata', 'checklist-progress'] }),
    );
    expect(reordered.degradationOrder).toEqual([
      'summary',
      'metadata',
      'checklist-progress',
      'custom',
      'checklist-preview',
      'labels',
    ]);
  });

  it('accepts exact active numeric boundaries and rejects the adjacent invalid values', () => {
    const limits = validateKanbanLimitOptions({
      class: 'standard',
      values: {
        descriptorRows: 10,
        cardFields: 4,
        summarySections: 3,
        checklistItemsPerGroup: 5,
      },
    });
    const valid = resolveKanbanPresentation(
      custom({
        cardRows: 10,
        cardGap: 10,
        metadataFields: 4,
        labelRows: 10,
        summarySections: 3,
        checklistPreviewItems: 5,
      }),
      limits,
    );
    expect(valid).toMatchObject({
      cardRows: 10,
      cardGap: 10,
      metadataFields: 4,
      labelRows: 10,
      summarySections: 3,
      checklistPreviewItems: 5,
    });

    const invalidInputs = [
      custom({ cardRows: 0 }),
      custom({ cardRows: 11 }),
      custom({ cardGap: 11 }),
      custom({ metadataFields: 5 }),
      custom({ labelRows: 11 }),
      custom({ summarySections: 4 }),
      custom({ checklistPreviewItems: 6 }),
    ];
    for (const input of invalidInputs) {
      expect(() => resolveKanbanPresentation(input, limits)).toThrow(KanbanInvalidPresentationError);
    }
  });

  it('changes semantic fingerprints for every presentation-affecting dimension', () => {
    const baseline = resolveKanbanPresentation(custom());
    const variants = [
      custom({ revision: 'policy-v2' }),
      custom({ cardRows: 9 }),
      custom({ cardGap: 2 }),
      custom({ metadataFields: 4 }),
      custom({ labelRows: 3 }),
      custom({ summarySections: 3 }),
      custom({ checklistMode: 'progress' }),
      custom({ checklistPreviewItems: 4 }),
      custom({ degradationOrder: ['metadata'] }),
    ];

    for (const variant of variants) {
      expect(fingerprint(resolveKanbanPresentation(variant))).not.toBe(fingerprint(baseline));
    }
  });

  it('detaches selection and availability arrays before caller mutation', () => {
    const limits = validateKanbanLimitOptions({ class: 'standard' });
    const budget = resolveKanbanPresentation(custom(), limits);
    const availableFields = ['priority', 'owner', 'type'];
    const availableSummaries = ['points', 'risk'];
    const availableChecklists = ['acceptance', 'quality'];
    const selectedFields = ['type', 'priority'];
    const selectedSummaries = ['risk'];
    const selectedChecklists = ['quality'];
    const resolved = resolveKanbanCardPresentationSelection(
      {
        fieldIds: selectedFields,
        summaryIds: selectedSummaries,
        checklistIds: selectedChecklists,
      },
      maximum(budget, limits, availableFields, availableSummaries, availableChecklists),
    );

    selectedFields[0] = 'owner';
    selectedSummaries[0] = 'points';
    selectedChecklists[0] = 'acceptance';
    availableFields.length = 0;
    availableSummaries.length = 0;
    availableChecklists.length = 0;

    expect(resolved.fieldIds).toEqual(['type', 'priority']);
    expect(resolved.summaryIds).toEqual(['risk']);
    expect(resolved.checklistIds).toEqual(['quality']);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.fieldIds)).toBe(true);
    expect(Object.isFrozen(resolved.summaryIds)).toBe(true);
    expect(Object.isFrozen(resolved.checklistIds)).toBe(true);
  });

  it('rejects mutable resolved-limit lookalikes and unknown policy members without leaking values', () => {
    const resolvedLimits = validateKanbanLimitOptions({ class: 'standard' });
    const mutableLimits: KanbanResolvedLimits = { ...resolvedLimits };
    const secret = 'private-policy-field';
    const withUnknownMember = { ...custom(), [secret]: true };

    expect(() => resolveKanbanPresentation(custom(), mutableLimits)).toThrow(KanbanInvalidPresentationError);
    let thrown: unknown;
    try {
      resolveKanbanPresentation(withUnknownMember);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(KanbanInvalidPresentationError);
    expect(String(thrown)).not.toContain(secret);
  });
});
