/** Primitive values that behavior probes may compare without implementation-specific objects. */
export type ObservableValue = string | number | boolean | null;

/** Canonical keyboard modifiers accepted by docs behavior contracts. */
export type ExampleModifier = 'Alt' | 'Ctrl' | 'Shift';

/** One keyboard or mouse primitive dispatched through the real application loop. */
export type ExampleAction =
  | {
      readonly kind: 'key';
      readonly key: string;
      readonly modifiers: readonly ExampleModifier[];
    }
  | {
      readonly kind: 'mouse';
      readonly gesture: 'click' | 'double-click' | 'drag' | 'wheel';
      readonly at: { readonly x: number; readonly y: number };
      readonly button?: 'left' | 'middle' | 'right';
      readonly to?: { readonly x: number; readonly y: number };
      readonly delta?: number;
    };

/** Executable comparison against a named observable probe. */
export interface ProbeExpectation<Probe extends string> {
  readonly probe: Probe;
  readonly operator: 'equals' | 'contains' | 'excludes' | 'greater-than' | 'less-than';
  readonly value: ObservableValue;
}

/** One independently rebuilt and disposed interaction path. */
export interface InteractionCase<Capability extends string, Probe extends string> {
  readonly id: string;
  readonly covers: readonly Capability[];
  readonly initial: readonly ProbeExpectation<Probe>[];
  readonly actions: readonly ExampleAction[];
  readonly expected: readonly ProbeExpectation<Probe>[];
  readonly reset: 'rebuild-example';
  readonly dispose: 'after-case';
}

/** Requirement-owned behavior oracle for one coherent live example. */
export interface ExampleBehaviorContract<Capability extends string, Probe extends string> {
  readonly exampleId: string;
  readonly capabilities: readonly Capability[];
  readonly cases: readonly InteractionCase<Capability, Probe>[];
}

/** Probe names implemented by the shared reference-example runner. */
export type StandardProbe =
  'rendered-text' | 'dialog-width' | 'dialog-height' | 'focused-view' | 'menu-background' | 'dialog-background';

/**
 * Preserve a behavior contract's literal capability, probe, and case types.
 *
 * @param contract Immutable contract authored before family implementation.
 * @returns The same contract without widening its literals.
 */
export function defineBehaviorContract<const Capability extends string, const Probe extends string>(
  contract: ExampleBehaviorContract<Capability, Probe>,
): ExampleBehaviorContract<Capability, Probe> {
  return contract;
}

/**
 * Validate the cross-cutting invariants shared by every behavior contract.
 *
 * @param contract Contract to validate.
 * @throws Error when IDs, capability coverage, actions, or lifecycle rules are invalid.
 */
export function validateBehaviorContract(contract: ExampleBehaviorContract<string, string>): void {
  if (contract.exampleId.trim() === '') throw new Error('exampleId must be non-empty');
  if (contract.capabilities.length === 0) throw new Error(`${contract.exampleId}: capabilities must be non-empty`);
  if (new Set(contract.capabilities).size !== contract.capabilities.length) {
    throw new Error(`${contract.exampleId}: duplicate capability`);
  }
  if (contract.cases.length === 0) throw new Error(`${contract.exampleId}: cases must be non-empty`);
  if (new Set(contract.cases.map((interaction) => interaction.id)).size !== contract.cases.length) {
    throw new Error(`${contract.exampleId}: duplicate case id`);
  }

  const covered = new Set<string>();
  for (const interaction of contract.cases) {
    if (interaction.covers.length === 0) throw new Error(`${interaction.id}: covers must be non-empty`);
    if (new Set(interaction.covers).size !== interaction.covers.length) {
      throw new Error(`${interaction.id}: duplicate covered capability`);
    }
    if (interaction.initial.length === 0 || interaction.expected.length === 0) {
      throw new Error(`${interaction.id}: probes must be non-empty`);
    }
    if (interaction.actions.length < 1 || interaction.actions.length > 6) {
      throw new Error(`${interaction.id}: actions must contain one to six primitives`);
    }
    if (interaction.reset !== 'rebuild-example' || interaction.dispose !== 'after-case') {
      throw new Error(`${interaction.id}: invalid lifecycle`);
    }
    for (const capability of interaction.covers) covered.add(capability);
    for (const expectation of [...interaction.initial, ...interaction.expected]) {
      validateExpectation(expectation, interaction.id);
    }
    for (const action of interaction.actions) validateAction(action, interaction.id);
  }

  expectSameSet(covered, new Set(contract.capabilities), `${contract.exampleId}: capability coverage`);
}

function expectExactFields(value: object, allowed: readonly string[], label: string): void {
  const unexpected = Object.keys(value).find((field) => !allowed.includes(field));
  if (unexpected !== undefined) throw new Error(`${label}: inapplicable field ${unexpected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPoint(value: unknown): value is { readonly x: number; readonly y: number } {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    Number.isInteger(value.x) &&
    Number.isInteger(value.y) &&
    value.x >= 0 &&
    value.y >= 0
  );
}

function validateExpectation(expectation: unknown, caseId: string): void {
  if (!isRecord(expectation)) throw new Error(`${caseId}: expectation must be an object`);
  expectExactFields(expectation, ['probe', 'operator', 'value'], caseId);
  if (typeof expectation.probe !== 'string' || expectation.probe.trim() === '') {
    throw new Error(`${caseId}: probe must be non-empty`);
  }
  const value = expectation.value;
  if (
    value !== null &&
    typeof value !== 'string' &&
    typeof value !== 'boolean' &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    throw new Error(`${caseId}: value must be an observable primitive`);
  }
  if (expectation.operator === 'equals') return;
  if (expectation.operator === 'contains' || expectation.operator === 'excludes') {
    if (typeof expectation.value !== 'string') {
      throw new Error(`${caseId}: ${expectation.operator} requires a string value`);
    }
    return;
  }
  if (expectation.operator === 'greater-than' || expectation.operator === 'less-than') {
    if (typeof expectation.value !== 'number' || !Number.isFinite(expectation.value)) {
      throw new Error(`${caseId}: ${expectation.operator} requires a finite number value`);
    }
    return;
  }
  throw new Error(`${caseId}: unknown probe operator ${String(expectation.operator)}`);
}

function validateAction(action: unknown, caseId: string): void {
  if (!isRecord(action)) throw new Error(`${caseId}: action must be an object`);
  if (action.kind === 'key') {
    expectExactFields(action, ['kind', 'key', 'modifiers'], caseId);
    if (typeof action.key !== 'string' || action.key.trim() === '') throw new Error(`${caseId}: key must be non-empty`);
    if (!Array.isArray(action.modifiers)) throw new Error(`${caseId}: modifiers must be an array`);
    if (
      action.modifiers.some((modifier) => typeof modifier !== 'string' || !['Alt', 'Ctrl', 'Shift'].includes(modifier))
    ) {
      throw new Error(`${caseId}: unknown modifier`);
    }
    if (new Set(action.modifiers).size !== action.modifiers.length) {
      throw new Error(`${caseId}: duplicate modifier`);
    }
    return;
  }
  if (action.kind !== 'mouse') throw new Error(`${caseId}: unknown action kind ${String(action.kind)}`);
  if (!isPoint(action.at)) throw new Error(`${caseId}: mouse coordinates must be non-negative integers`);
  if (action.gesture === 'click' || action.gesture === 'double-click') {
    expectExactFields(action, ['kind', 'gesture', 'at', 'button'], caseId);
  } else if (action.gesture === 'drag') {
    expectExactFields(action, ['kind', 'gesture', 'at', 'button', 'to'], caseId);
    if (action.button === undefined || action.to === undefined) {
      throw new Error(`${caseId}: drag requires a button and destination`);
    }
    if (!isPoint(action.to)) throw new Error(`${caseId}: drag destination must be non-negative integers`);
  } else if (action.gesture === 'wheel') {
    expectExactFields(action, ['kind', 'gesture', 'at', 'delta'], caseId);
    if (typeof action.delta !== 'number' || !Number.isInteger(action.delta) || action.delta === 0) {
      throw new Error(`${caseId}: wheel requires a non-zero integer delta`);
    }
  } else {
    throw new Error(`${caseId}: unknown mouse gesture ${String(action.gesture)}`);
  }
  if (
    action.button !== undefined &&
    (typeof action.button !== 'string' || !['left', 'middle', 'right'].includes(action.button))
  ) {
    throw new Error(`${caseId}: unknown mouse button`);
  }
}

function expectSameSet(actual: ReadonlySet<string>, expected: ReadonlySet<string>, label: string): void {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`${label} mismatch; missing=${missing.join(',')} extra=${extra.join(',')}`);
  }
}
