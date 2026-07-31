import { defineBehaviorContract } from '../_contract.js';
import type {
  ExampleAction,
  ExampleBehaviorContract,
  InteractionCase,
  ProbeExpectation,
  StandardProbe,
} from '../_contract.js';

/** Target-owned values exposed by the Data Grid documentation runner. */
export type DataGridProbe =
  | StandardProbe
  | 'grid-kind'
  | 'row-count'
  | 'column-order'
  | 'frozen-columns'
  | 'cell-text'
  | 'sort-state'
  | 'filter-state'
  | 'visible-row-keys'
  | 'selected-row-keys'
  | 'cursor-cell'
  | 'editing-state'
  | 'editor-kind'
  | 'dirty-cell-count'
  | 'validation-status'
  | 'lifecycle-state'
  | 'footer-text'
  | 'detail-key'
  | 'source-read-count'
  | 'source-full-array-read'
  | 'export-text'
  | 'variant-name'
  | 'personalize-state'
  | 'theme-role'
  | 'focus-owner'
  | 'performance-note'
  | 'status-text';

/** Short alias for one Data Grid probe expectation. */
export type DataGridExpectation = ProbeExpectation<DataGridProbe>;

/**
 * Build one independently resettable Data Grid interaction case.
 *
 * @param id Stable case identifier.
 * @param covers Capabilities proven by the case.
 * @param initial Target-owned state before input.
 * @param actions Bounded real key/mouse input.
 * @param expected Target-owned state after input.
 * @returns A complete behavior-contract case.
 */
export function gridCase<const Capability extends string>(
  id: string,
  covers: readonly Capability[],
  initial: readonly DataGridExpectation[],
  actions: readonly ExampleAction[],
  expected: readonly DataGridExpectation[],
): InteractionCase<Capability, DataGridProbe> {
  return {
    id,
    covers,
    initial,
    actions,
    expected,
    reset: 'rebuild-example',
    dispose: 'after-case',
  };
}

/**
 * Preserve one Data Grid example contract while keeping its capability literals explicit.
 *
 * @param exampleId Registered documentation example identifier.
 * @param capabilities Complete learning-objective capability set.
 * @param cases Independently resettable cases covering that set exactly.
 * @returns The validated contract shape consumed by hub specifications.
 */
export function dataGridContract<const Capability extends string>(
  exampleId: `data-grid/${string}`,
  capabilities: readonly Capability[],
  cases: readonly InteractionCase<Capability, DataGridProbe>[],
): ExampleBehaviorContract<Capability, DataGridProbe> {
  return defineBehaviorContract({ exampleId, capabilities, cases });
}

/** Common no-modifier key action used by the contract fixtures. */
export const key = (name: string): ExampleAction => ({ kind: 'key', key: name, modifiers: [] });

/** Common Alt-key action used by the contract fixtures. */
export const alt = (name: string): ExampleAction => ({ kind: 'key', key: name, modifiers: ['Alt'] });
