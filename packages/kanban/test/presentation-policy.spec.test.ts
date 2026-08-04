import { describe, expect, it, vi } from 'vitest';
import {
  KANBAN_LIMITS,
  KanbanInvalidPresentationError,
  fingerprintKanbanSemanticValue,
  resolveKanbanCardPresentationSelection,
  resolveKanbanPresentation,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanCardPresentationMaximum,
  KanbanCardPresentationSelection,
  KanbanCustomPresentation,
} from '../src/index.js';
import type { ResolvedKanbanCardPresentationSelection } from '../src/index.js';
import type { KanbanResolvedLimits, ResolvedKanbanPresentationBudget } from '../src/index.js';

/** One valid custom view maximum with room for every optional section family. */
function customPresentation(replacement: Partial<KanbanCustomPresentation> = {}): KanbanCustomPresentation {
  return {
    revision: 'custom-presentation-v1',
    cardRows: 8,
    cardGap: 1,
    metadataFields: 3,
    labelRows: 2,
    summarySections: 2,
    checklistMode: 'preview',
    checklistPreviewItems: 2,
    ...replacement,
  };
}

/** Fingerprints every normalized field without requiring a policy-specific fingerprint export. */
function presentationFingerprint(budget: ResolvedKanbanPresentationBudget): string {
  return fingerprintKanbanSemanticValue({
    ...budget,
    degradationOrder: [...budget.degradationOrder],
  });
}
function presentationMaximum(
  budget: ResolvedKanbanPresentationBudget,
  replacement: Partial<KanbanCardPresentationMaximum> = {},
  limits: KanbanResolvedLimits = validateKanbanLimitOptions({ class: 'standard' }),
): KanbanCardPresentationMaximum {
  return {
    budget,
    limits,
    availableFieldIds: ['priority', 'type', 'assignee'],
    availableSummaryIds: ['points', 'risk'],
    availableChecklistIds: ['acceptance', 'quality', 'release'],
    ...replacement,
  };
}
function expectBoundedFrozenBudget(budget: ResolvedKanbanPresentationBudget): void {
  expect(Object.isFrozen(budget)).toBe(true);
  expect(Object.isFrozen(budget.degradationOrder)).toBe(true);
  expect(budget.cardRows).toBeGreaterThan(0);
  expect(budget.cardRows).toBeLessThanOrEqual(KANBAN_LIMITS.descriptorRows.standard);
  expect(budget.cardGap).toBeGreaterThanOrEqual(0);
  expect(budget.metadataFields).toBeLessThanOrEqual(KANBAN_LIMITS.cardFields.standard);
  expect(budget.summarySections).toBeLessThanOrEqual(KANBAN_LIMITS.summarySections.standard);
  expect(budget.checklistPreviewItems).toBeLessThanOrEqual(KANBAN_LIMITS.checklistItemsPerGroup.standard);
}
function expectSelectionRejected(
  selection: KanbanCardPresentationSelection | undefined,
  maximum: KanbanCardPresentationMaximum,
  previous: ResolvedKanbanCardPresentationSelection,
  forbiddenText?: string,
): void {
  const before = [...previous.fieldIds];
  let thrown: unknown;
  try {
    resolveKanbanCardPresentationSelection(selection, maximum);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(KanbanInvalidPresentationError);
  if (forbiddenText !== undefined) expect(String(thrown)).not.toContain(forbiddenText);
  expect(previous.fieldIds).toEqual(before);
  expect(Object.isFrozen(previous)).toBe(true);
}
describe('Kanban presentation policy contract', () => {
  it('should resolve deterministic bounded presets with comfortable as the immutable default', () => {
    const compact = resolveKanbanPresentation('compact');
    const comfortable = resolveKanbanPresentation('comfortable');
    const spacious = resolveKanbanPresentation('spacious');
    const defaultPresentation = resolveKanbanPresentation();

    expect(defaultPresentation).toEqual(comfortable);
    expect([compact.preset, comfortable.preset, spacious.preset]).toEqual(['compact', 'comfortable', 'spacious']);
    expect(compact.cardRows).toBeLessThanOrEqual(KANBAN_LIMITS.cardRowsCompact.standard);
    expect(comfortable.cardRows).toBeLessThanOrEqual(KANBAN_LIMITS.cardRowsComfortable.standard);
    expect(spacious.cardRows).toBeLessThanOrEqual(KANBAN_LIMITS.cardRowsSpacious.standard);
    for (const budget of [compact, comfortable, spacious, defaultPresentation]) {
      expectBoundedFrozenBudget(budget);
    }
  });

  it('should normalize equal custom policies into equal frozen values and stable fingerprints', () => {
    const firstInput = customPresentation();
    const secondInput: KanbanCustomPresentation = {
      checklistPreviewItems: 2,
      checklistMode: 'preview',
      summarySections: 2,
      labelRows: 2,
      metadataFields: 3,
      cardGap: 1,
      cardRows: 8,
      revision: 'custom-presentation-v1',
    };
    const first = resolveKanbanPresentation(firstInput);
    const second = resolveKanbanPresentation(secondInput);
    expect(first).toEqual(second);
    expect(first).not.toBe(firstInput);
    expect(first).toMatchObject({ preset: 'custom', revision: 'custom-presentation-v1' });
    expectBoundedFrozenBudget(first);
    expect(presentationFingerprint(first)).toBe(presentationFingerprint(second));
  });

  it('should accept validated standard and absolute custom ceilings', () => {
    const standard = validateKanbanLimitOptions({ class: 'standard' });
    const absolute = validateKanbanLimitOptions({ class: 'advanced' });
    for (const limits of [standard, absolute]) {
      const resolved = resolveKanbanPresentation(
        customPresentation({
          cardRows: limits.descriptorRows,
          metadataFields: limits.cardFields,
          summarySections: limits.summarySections,
          checklistPreviewItems: limits.checklistItemsPerGroup,
        }),
        limits,
      );
      expect(resolved).toMatchObject({
        cardRows: limits.descriptorRows,
        metadataFields: limits.cardFields,
        summarySections: limits.summarySections,
        checklistPreviewItems: limits.checklistItemsPerGroup,
      });
    }
  });

  it('should intersect known IDs before caps while preserving requested order and numeric maxima', () => {
    const budget = resolveKanbanPresentation(
      customPresentation({ metadataFields: 2, summarySections: 1, checklistPreviewItems: 1 }),
    );
    const maximum = presentationMaximum(budget);
    const selection: KanbanCardPresentationSelection = {
      fieldIds: ['absent', 'assignee', 'priority', 'type'],
      summaryIds: ['absent', 'risk', 'points'],
      checklistIds: ['absent', 'quality', 'acceptance', 'release'],
    };
    const resolved = resolveKanbanCardPresentationSelection(selection, maximum);
    expect(resolved).toMatchObject({
      fieldIds: ['assignee', 'priority'],
      summaryIds: ['risk'],
      checklistIds: ['quality', 'acceptance', 'release'],
    });
    expect(resolved.budget).toBe(budget);
    expect(resolved.budget.checklistPreviewItems).toBe(1);
  });

  it('should distinguish omitted categories, explicit empties, and hidden checklist mode', () => {
    const budget = resolveKanbanPresentation(
      customPresentation({ metadataFields: 2, summarySections: 1, checklistPreviewItems: 1 }),
    );
    const maximum = presentationMaximum(budget);
    expect(resolveKanbanCardPresentationSelection(undefined, maximum)).toMatchObject({
      fieldIds: ['priority', 'type'],
      summaryIds: ['points'],
      checklistIds: ['acceptance', 'quality', 'release'],
    });
    expect(
      resolveKanbanCardPresentationSelection({ fieldIds: [], summaryIds: [], checklistIds: [] }, maximum),
    ).toMatchObject({ fieldIds: [], summaryIds: [], checklistIds: [] });
    expect(resolveKanbanCardPresentationSelection({ fieldIds: [] }, maximum)).toMatchObject({
      fieldIds: [],
      summaryIds: ['points'],
      checklistIds: ['acceptance', 'quality', 'release'],
    });

    const hiddenBudget = resolveKanbanPresentation(customPresentation({ checklistMode: 'hidden' }));
    const hiddenMaximum = presentationMaximum(hiddenBudget);
    expect(resolveKanbanCardPresentationSelection(undefined, hiddenMaximum).checklistIds).toEqual([]);
    expect(resolveKanbanCardPresentationSelection({ checklistIds: ['quality'] }, hiddenMaximum).checklistIds).toEqual(
      [],
    );
  });

  it('should freeze detached selected arrays and retain the identical budget object', () => {
    const budget = resolveKanbanPresentation(customPresentation());
    const availableFieldIds = ['priority', 'type', 'assignee'] as const;
    const selection: KanbanCardPresentationSelection = { fieldIds: ['type', 'priority'] };
    const resolved = resolveKanbanCardPresentationSelection(
      selection,
      presentationMaximum(budget, { availableFieldIds }),
    );
    expect(resolved.budget).toBe(budget);
    expect(Object.isFrozen(resolved)).toBe(true);
    for (const ids of [resolved.fieldIds, resolved.summaryIds, resolved.checklistIds]) {
      expect(Object.isFrozen(ids)).toBe(true);
    }
    expect(resolved.fieldIds).not.toBe(selection.fieldIds);
    expect(resolved.fieldIds).not.toBe(availableFieldIds);
    expect(presentationFingerprint(resolved.budget)).toBe(presentationFingerprint(budget));
  });

  it('should reject duplicate, malformed, accessor, and unknown-key selection data atomically', () => {
    const budget = resolveKanbanPresentation(customPresentation());
    const maximum = presentationMaximum(budget);
    const previous = resolveKanbanCardPresentationSelection(undefined, maximum);
    const duplicate: KanbanCardPresentationSelection = { fieldIds: ['priority', 'priority'] };
    const malformed: KanbanCardPresentationSelection = { summaryIds: ['safe', '\u001b[31munsafe'] };
    const unknownSelection = { fieldIds: ['priority'] as const, unexpected: true };
    const duplicateMaximum = presentationMaximum(budget, {
      availableChecklistIds: ['acceptance', 'acceptance'],
    });
    const unknownMaximum = { ...maximum, unexpected: true };
    const callback = vi.fn(() => {
      throw new Error('selection-secret');
    });
    const accessor: KanbanCardPresentationSelection = {
      get fieldIds() {
        return callback();
      },
    };

    expectSelectionRejected(duplicate, maximum, previous);
    expectSelectionRejected(malformed, maximum, previous, 'unsafe');
    expectSelectionRejected(unknownSelection, maximum, previous);
    expectSelectionRejected(undefined, duplicateMaximum, previous);
    expectSelectionRejected(undefined, unknownMaximum, previous);
    expectSelectionRejected(accessor, maximum, previous, 'selection-secret');
    expect(callback).not.toHaveBeenCalled();
    expect(previous.budget).toBe(budget);
  });

  it('should reject a configured checklist universe above active lowered limits', () => {
    const limits = validateKanbanLimitOptions({ class: 'standard', values: { checklistGroups: 2 } });
    const budget = resolveKanbanPresentation(customPresentation(), limits);
    const maximum = presentationMaximum(budget, {}, limits);
    const validMaximum = { ...maximum, availableChecklistIds: ['acceptance', 'quality'] };
    const previous = resolveKanbanCardPresentationSelection(undefined, validMaximum);
    expectSelectionRejected(undefined, maximum, previous);
    expect(previous.limits).toBe(limits);
    expect(Object.isFrozen(previous.limits)).toBe(true);
  });

  it('should reject invalid custom values and caller-lowered ceiling overflow atomically', () => {
    const invalidPolicies = [
      ['negative rows', { cardRows: -1 }],
      ['fractional gap', { cardGap: 1.5 }],
      ['non-finite fields', { metadataFields: Number.POSITIVE_INFINITY }],
      ['oversized rows', { cardRows: KANBAN_LIMITS.descriptorRows.absolute + 1 }],
      ['oversized summaries', { summarySections: KANBAN_LIMITS.summarySections.absolute + 1 }],
      ['oversized preview', { checklistPreviewItems: KANBAN_LIMITS.checklistItemsPerGroup.absolute + 1 }],
      ['invalid revision', { revision: '' }],
      ['duplicate degradation', { degradationOrder: ['checklist', 'checklist'] }],
      ['mandatory degradation', { degradationOrder: ['title'] }],
    ] satisfies readonly (readonly [string, Partial<KanbanCustomPresentation>])[];
    const previous = resolveKanbanPresentation('comfortable');
    const before = presentationFingerprint(previous);
    for (const [, replacement] of invalidPolicies) {
      expect(() => resolveKanbanPresentation(customPresentation(replacement))).toThrow();
    }

    const lowered = validateKanbanLimitOptions({
      class: 'standard',
      values: { descriptorRows: 7, cardFields: 2, summarySections: 1, checklistItemsPerGroup: 1 },
    });
    expect(() => resolveKanbanPresentation(customPresentation(), lowered)).toThrow();
    expect(presentationFingerprint(previous)).toBe(before);
    expect(Object.isFrozen(previous)).toBe(true);
  });

  it('should reject accessor-backed presentation data without execution or payload leakage', () => {
    const secret = 'customer-token-should-not-leak';
    const callback = vi.fn(() => {
      throw new Error(secret);
    });
    const malicious: KanbanCustomPresentation = {
      ...customPresentation(),
      get cardRows() {
        return callback();
      },
    };
    let thrown: unknown;
    try {
      resolveKanbanPresentation(malicious);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();
    expect(thrown).not.toBeInstanceOf(TypeError);
    expect(callback).not.toHaveBeenCalled();
    expect(String(thrown)).not.toContain(secret);
  });
});
