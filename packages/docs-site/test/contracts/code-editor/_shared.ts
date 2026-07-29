import { defineBehaviorContract } from '../_contract.js';
import type {
  ExampleAction,
  ExampleBehaviorContract,
  InteractionCase,
  ProbeExpectation,
  StandardProbe,
} from '../_contract.js';

/** Target-owned values exposed by the Code Editor documentation laboratories. */
export type CodeEditorProbe =
  | StandardProbe
  | 'scenario'
  | 'surface-kind'
  | 'document-revision'
  | 'language'
  | 'read-only'
  | 'selection-size'
  | 'caret-offset'
  | 'fold-count'
  | 'invisible-warning-count'
  | 'search-query'
  | 'service-state'
  | 'diagnostic-count'
  | 'completion-count'
  | 'intelligence-kinds'
  | 'syntax-state'
  | 'host-effects'
  | 'host-callback-state'
  | 'large-tier'
  | 'theme-name'
  | 'theme-rejection-count'
  | 'terminal-safe'
  | 'status-text';

/** Short alias for one Code Editor probe expectation. */
export type CodeEditorExpectation = ProbeExpectation<CodeEditorProbe>;

/**
 * Build one independently resettable Code Editor interaction case.
 *
 * @param capability Stable learning objective proven by the case.
 * @param initial Target-owned state before the documented action.
 * @param expected Target-owned state after the documented action.
 * @returns A complete behavior-contract case.
 */
export function editorCase<const Capability extends string>(
  capability: Capability,
  initial: readonly CodeEditorExpectation[],
  expected: readonly CodeEditorExpectation[],
): InteractionCase<Capability, CodeEditorProbe> {
  return {
    id: 'run-focused-check',
    covers: [capability],
    initial,
    actions: [{ kind: 'key', key: 'r', modifiers: ['Alt'] }],
    expected,
    reset: 'rebuild-example',
    dispose: 'after-case',
  };
}

/**
 * Preserve one Code Editor example contract with literal capability types.
 *
 * @param exampleId Registered documentation example identifier.
 * @param capability Complete learning objective for the focused example.
 * @param initial Target-owned state before interaction.
 * @param expected Target-owned state after interaction.
 * @returns The validated contract shape consumed by the hub specifications.
 */
export function codeEditorContract<const Capability extends string>(
  exampleId: `code-editor/${string}`,
  capability: Capability,
  initial: readonly CodeEditorExpectation[],
  expected: readonly CodeEditorExpectation[],
): ExampleBehaviorContract<Capability, CodeEditorProbe> {
  return defineBehaviorContract({
    exampleId,
    capabilities: [capability],
    cases: [editorCase(capability, initial, expected)],
  });
}

/** The real keyboard action used by every focused laboratory's visible Run check control. */
export const RUN_CHECK_ACTION: ExampleAction = {
  kind: 'key',
  key: 'r',
  modifiers: ['Alt'],
};
