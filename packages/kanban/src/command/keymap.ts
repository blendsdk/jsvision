import { createKeymap } from '@jsvision/core';
import type { Keymap } from '@jsvision/core';

import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import {
  formatKanbanActionChord,
  KANBAN_DEFAULT_ACTION_CHORDS,
  normalizeKanbanActionChord,
  resolveKanbanPrimaryModifier,
} from './defaults.js';
import type { KanbanActionKeymapHost, KanbanPrimaryModifier } from './defaults.js';
import type { KanbanActionKeyEvent, KanbanActionRegistry } from './types.js';

/** One immutable concrete chord route. */
export interface KanbanActionKeyBinding {
  /** Host-resolved canonical chord. */
  readonly chord: string;
  /** Exact registered action identity. */
  readonly actionId: string;
}

/** Immutable observable keymap state. */
export interface KanbanActionKeymapSnapshot {
  /** Monotonic replacement revision, beginning at one. */
  readonly revision: number;
  /** Complete ordered concrete routes. */
  readonly bindings: readonly KanbanActionKeyBinding[];
}

/** One proposed runtime binding. */
export interface KanbanActionKeymapReplacementBinding {
  /** Semantic or concrete chord. */
  readonly chord: string;
  /** Exact registered destination action. */
  readonly actionId: string;
}

/** Exact existing route that a runtime replacement is allowed to displace. */
export interface KanbanActionKeymapOverride {
  /** Semantic or concrete chord being replaced. */
  readonly chord: string;
  /** Exact currently bound action expected at that chord. */
  readonly replaceActionId: string;
}

/** Exact route removed as part of one atomic remap. */
export interface KanbanActionKeymapUnbind {
  /** Semantic or concrete chord currently owned by the action. */
  readonly chord: string;
  /** Exact action that must currently own the chord. */
  readonly actionId: string;
}

/** Atomic runtime replacement request. */
export interface KanbanActionKeymapReplacement {
  /** Routes to add or replace after validation. */
  readonly bindings: readonly KanbanActionKeymapReplacementBinding[];
  /** Exact displacement approvals for conflicting existing routes. */
  readonly overrides?: readonly KanbanActionKeymapOverride[];
  /** Exact current routes to remove before adding replacement bindings. */
  readonly unbind?: readonly KanbanActionKeymapUnbind[];
}

/** Options accepted by the conflict-validating action keymap. */
export interface KanbanActionKeymapOptions {
  /** Stable package-plus-application action inventory. */
  readonly registry: KanbanActionRegistry;
  /** Host facts used to resolve semantic `Primary`. */
  readonly host: KanbanActionKeymapHost;
  /** Optional atomic remap applied before host-unavailable defaults are validated. */
  readonly initial?: KanbanActionKeymapReplacement;
}

/** Public action-keymap surface used by routing and visible help. */
export interface KanbanActionKeymap {
  /** Returns the exact action for one normalized event, if bound. */
  readonly resolve: (event: KanbanActionKeyEvent) => string | undefined;
  /** Returns the resolved visible chord for one action, if bound. */
  readonly help: (actionId: string) => string | undefined;
  /** Returns the current immutable routing/help snapshot. */
  readonly snapshot: () => KanbanActionKeymapSnapshot;
  /** Atomically applies a validated runtime binding patch. */
  readonly replace: (replacement: KanbanActionKeymapReplacement) => boolean;
  /** Observes successful replacements; failed replacements publish nothing. */
  readonly subscribe: (listener: (snapshot: KanbanActionKeymapSnapshot) => void) => () => void;
}

/** Structured conflict evidence returned without retaining event or record data. */
export interface KanbanActionKeymapConflict {
  /** Concrete host-resolved chord. */
  readonly chord: string;
  /** Exact actions competing for the chord. */
  readonly actionIds: readonly string[];
}

/** Raised when exact chord ownership is ambiguous or an override does not match it. */
export class KanbanActionKeymapConflictError extends Error {
  /** Detached immutable conflict evidence. */
  readonly conflict: KanbanActionKeymapConflict;

  /** Creates a payload-bounded conflict error. */
  constructor(chord: string, actionIds: readonly string[]) {
    super('Conflicting Kanban action key binding.');
    this.name = 'KanbanActionKeymapConflictError';
    this.conflict = Object.freeze({ chord, actionIds: Object.freeze([...actionIds]) });
  }
}

/** Raised when a route is known to be unavailable on the current host. */
export class KanbanActionKeymapUnavailableError extends Error {
  /** Detached immutable unavailable-route evidence. */
  readonly route: KanbanActionKeyBinding;

  /** Creates a payload-bounded unavailable-route error. */
  constructor(chord: string, actionId: string) {
    super('Kanban action key binding is unavailable on this host.');
    this.name = 'KanbanActionKeymapUnavailableError';
    this.route = Object.freeze({ chord, actionId });
  }
}

/** Maximum routes, removals, overrides, or host exclusions accepted at one boundary. */
const MAX_KEYMAP_ENTRIES = 512;
/** Maximum UTF-8 bytes accepted for one external chord. */
const MAX_CHORD_BYTES = 256;
/** Maximum observers retained by one action keymap. */
const MAX_KEYMAP_SUBSCRIBERS = 256;
/** Allowed members of one replacement envelope. */
const REPLACEMENT_KEYS = new Set(['bindings', 'overrides', 'unbind']);
/** Allowed members of one proposed route. */
const BINDING_KEYS = new Set(['chord', 'actionId']);
/** Allowed members of one exact override. */
const OVERRIDE_KEYS = new Set(['chord', 'replaceActionId']);
/** Allowed members of one exact removal. */
const UNBIND_KEYS = new Set(['chord', 'actionId']);
/** Terminal control characters forbidden in external chords. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

/** Internal compiled state published only after complete validation. */
interface CompiledKeymapState {
  readonly snapshot: KanbanActionKeymapSnapshot;
  readonly lookup: Keymap;
  readonly helpByAction: ReadonlyMap<string, string>;
}

/** Bounds and normalizes one external chord without exposing rejected content in errors. */
function externalChord(value: unknown, primary: KanbanPrimaryModifier): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_CHORD_BYTES ||
    CONTROL_CHARACTERS.test(value) ||
    new TextEncoder().encode(value).byteLength > MAX_CHORD_BYTES
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  try {
    return normalizeKanbanActionChord(value, primary);
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Validates one exact registered action identity. */
function registeredActionId(registry: KanbanActionRegistry, value: unknown): string {
  if (typeof value !== 'string' || registry.action(value) === undefined) throw new KanbanInvalidSemanticValueError();
  return value;
}

/** Copies one proposed route through the descriptor-only input boundary. */
function replacementBinding(
  registry: KanbanActionRegistry,
  primary: KanbanPrimaryModifier,
  value: unknown,
): KanbanActionKeyBinding {
  const properties = snapshotKanbanDataProperties(value, BINDING_KEYS.size);
  validateKanbanDataKeys(properties, BINDING_KEYS);
  return Object.freeze({
    chord: externalChord(properties.chord, primary),
    actionId: registeredActionId(registry, properties.actionId),
  });
}

/** Copies one targeted displacement approval through the descriptor-only boundary. */
function replacementOverride(
  registry: KanbanActionRegistry,
  primary: KanbanPrimaryModifier,
  value: unknown,
): KanbanActionKeymapOverride {
  const properties = snapshotKanbanDataProperties(value, OVERRIDE_KEYS.size);
  validateKanbanDataKeys(properties, OVERRIDE_KEYS);
  return Object.freeze({
    chord: externalChord(properties.chord, primary),
    replaceActionId: registeredActionId(registry, properties.replaceActionId),
  });
}

/** Copies one exact removal through the descriptor-only boundary. */
function replacementUnbind(
  registry: KanbanActionRegistry,
  primary: KanbanPrimaryModifier,
  value: unknown,
): KanbanActionKeymapUnbind {
  const properties = snapshotKanbanDataProperties(value, UNBIND_KEYS.size);
  validateKanbanDataKeys(properties, UNBIND_KEYS);
  return Object.freeze({
    chord: externalChord(properties.chord, primary),
    actionId: registeredActionId(registry, properties.actionId),
  });
}

/** Rejects a route the host reports it cannot deliver. */
function validateAvailableBinding(unavailable: ReadonlySet<string>, binding: KanbanActionKeyBinding): void {
  if (unavailable.has(binding.chord)) {
    throw new KanbanActionKeymapUnavailableError(binding.chord, binding.actionId);
  }
}

/** Validates and applies one exact atomic patch to an existing binding snapshot. */
function applyReplacement(
  current: readonly KanbanActionKeyBinding[],
  replacement: KanbanActionKeymapReplacement,
  registry: KanbanActionRegistry,
  primary: KanbanPrimaryModifier,
  unavailable: ReadonlySet<string>,
): readonly KanbanActionKeyBinding[] {
  const properties = snapshotKanbanDataProperties(replacement, REPLACEMENT_KEYS.size);
  validateKanbanDataKeys(properties, REPLACEMENT_KEYS);
  const proposed = snapshotKanbanDataArray(properties.bindings, MAX_KEYMAP_ENTRIES).map((entry) =>
    replacementBinding(registry, primary, entry),
  );
  const overrides = snapshotKanbanDataArray(properties.overrides ?? [], MAX_KEYMAP_ENTRIES).map((entry) =>
    replacementOverride(registry, primary, entry),
  );
  const unbind = snapshotKanbanDataArray(properties.unbind ?? [], MAX_KEYMAP_ENTRIES).map((entry) =>
    replacementUnbind(registry, primary, entry),
  );
  const overrideByChord = new Map(overrides.map((override) => [override.chord, override]));
  if (overrideByChord.size !== overrides.length) throw new KanbanInvalidSemanticValueError();
  const unbindByChord = new Map(unbind.map((entry) => [entry.chord, entry]));
  if (unbindByChord.size !== unbind.length) throw new KanbanInvalidSemanticValueError();

  for (const binding of proposed) validateAvailableBinding(unavailable, binding);

  const candidate = new Map(current.map((binding) => [binding.chord, binding]));
  for (const removal of unbind) {
    const existing = candidate.get(removal.chord);
    if (existing?.actionId !== removal.actionId) {
      throw new KanbanActionKeymapConflictError(
        removal.chord,
        existing === undefined ? [removal.actionId] : [existing.actionId, removal.actionId],
      );
    }
    candidate.delete(removal.chord);
  }
  for (const binding of proposed) {
    const existing = candidate.get(binding.chord);
    if (existing !== undefined) {
      const override = overrideByChord.get(binding.chord);
      if (override?.replaceActionId !== existing.actionId) {
        throw new KanbanActionKeymapConflictError(binding.chord, [existing.actionId, binding.actionId]);
      }
      overrideByChord.delete(binding.chord);
      candidate.delete(binding.chord);
    }
    addUniqueBinding(candidate, binding);
  }
  if (overrideByChord.size !== 0) {
    const unmatched = overrideByChord.values().next().value;
    if (unmatched !== undefined) {
      throw new KanbanActionKeymapConflictError(unmatched.chord, [unmatched.replaceActionId]);
    }
  }
  return Object.freeze([...candidate.values()]);
}

/** Compiles immutable bindings into one Core lookup plus current help labels. */
function compile(
  bindings: readonly KanbanActionKeyBinding[],
  primary: KanbanPrimaryModifier,
  revision: number,
): CompiledKeymapState {
  const chordBindings: Record<string, string> = Object.create(null);
  const helpLists = new Map<string, string[]>();
  for (const binding of bindings) {
    chordBindings[binding.chord] = binding.actionId;
    const help = helpLists.get(binding.actionId) ?? [];
    help.push(formatKanbanActionChord(binding.chord));
    helpLists.set(binding.actionId, help);
  }
  const helpByAction = new Map<string, string>();
  for (const [actionId, labels] of helpLists) helpByAction.set(actionId, labels.join(' / '));
  return Object.freeze({
    snapshot: Object.freeze({ revision, bindings: Object.freeze([...bindings]) }),
    lookup: createKeymap(chordBindings, { primary }),
    helpByAction,
  });
}

/** Adds one route or reports the exact competing actions. */
function addUniqueBinding(bindings: Map<string, KanbanActionKeyBinding>, binding: KanbanActionKeyBinding): void {
  const existing = bindings.get(binding.chord);
  if (existing !== undefined) {
    throw new KanbanActionKeymapConflictError(binding.chord, [existing.actionId, binding.actionId]);
  }
  bindings.set(binding.chord, binding);
}

/**
 * Creates a host-resolved, conflict-validating action keymap with atomic replacement.
 *
 * @example
 * ```ts
 * const keymap = createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'linux' } });
 * keymap.help('kanban.search.focus'); // "Ctrl+F"
 * ```
 */
export function createKanbanActionKeymap(options: KanbanActionKeymapOptions): KanbanActionKeymap {
  const primary = resolveKanbanPrimaryModifier(options.host);
  const unavailableValues = snapshotKanbanDataArray(options.host.unavailableChords ?? [], MAX_KEYMAP_ENTRIES);
  const unavailable = new Set(
    unavailableValues.map((chord) => {
      return externalChord(chord, primary);
    }),
  );
  const initialBindings = new Map<string, KanbanActionKeyBinding>();
  for (const action of options.registry.actions()) {
    for (const chord of action.bindings) {
      const binding = Object.freeze({ chord: externalChord(chord, primary), actionId: action.id });
      addUniqueBinding(initialBindings, binding);
    }
  }

  const defaultOrder = new Map(
    KANBAN_DEFAULT_ACTION_CHORDS.map((chord, index) => [externalChord(chord, primary), index]),
  );
  let orderedInitialBindings: readonly KanbanActionKeyBinding[] = [...initialBindings.values()].sort(
    (left, right) =>
      (defaultOrder.get(left.chord) ?? Number.MAX_SAFE_INTEGER) -
      (defaultOrder.get(right.chord) ?? Number.MAX_SAFE_INTEGER),
  );
  if (options.initial !== undefined) {
    orderedInitialBindings = applyReplacement(
      orderedInitialBindings,
      options.initial,
      options.registry,
      primary,
      unavailable,
    );
  }
  for (const binding of orderedInitialBindings) validateAvailableBinding(unavailable, binding);

  let state = compile(orderedInitialBindings, primary, 1);
  const subscribers = new Set<(snapshot: KanbanActionKeymapSnapshot) => void>();

  const keymap: KanbanActionKeymap = {
    resolve: (event: KanbanActionKeyEvent) => state.lookup.lookup(event),
    help: (actionId: string) => state.helpByAction.get(actionId),
    snapshot: () => state.snapshot,
    replace: (replacement: KanbanActionKeymapReplacement) => {
      const nextBindings = applyReplacement(
        state.snapshot.bindings,
        replacement,
        options.registry,
        primary,
        unavailable,
      );
      const next = compile(nextBindings, primary, state.snapshot.revision + 1);
      state = next;
      for (const subscriber of [...subscribers]) {
        try {
          subscriber(next.snapshot);
        } catch {
          // One presentation subscriber cannot prevent other routing/help observers from updating.
        }
      }
      return true;
    },
    subscribe: (listener: (snapshot: KanbanActionKeymapSnapshot) => void) => {
      if (typeof listener !== 'function' || subscribers.size >= MAX_KEYMAP_SUBSCRIBERS) {
        throw new KanbanInvalidSemanticValueError();
      }
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
  };
  return Object.freeze(keymap);
}
