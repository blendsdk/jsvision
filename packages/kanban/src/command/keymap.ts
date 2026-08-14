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

/** Atomic runtime replacement request. */
export interface KanbanActionKeymapReplacement {
  /** Routes to add or replace after validation. */
  readonly bindings: readonly KanbanActionKeymapReplacementBinding[];
  /** Exact displacement approvals for conflicting existing routes. */
  readonly overrides?: readonly KanbanActionKeymapOverride[];
}

/** Options accepted by the conflict-validating action keymap. */
export interface KanbanActionKeymapOptions {
  /** Stable package-plus-application action inventory. */
  readonly registry: KanbanActionRegistry;
  /** Host facts used to resolve semantic `Primary`. */
  readonly host: KanbanActionKeymapHost;
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

/** Maximum routes and overrides accepted by one atomic replacement. */
const MAX_KEYMAP_ENTRIES = 512;
/** Maximum observers retained by one action keymap. */
const MAX_KEYMAP_SUBSCRIBERS = 256;
/** Allowed members of one replacement envelope. */
const REPLACEMENT_KEYS = new Set(['bindings', 'overrides']);
/** Allowed members of one proposed route. */
const BINDING_KEYS = new Set(['chord', 'actionId']);
/** Allowed members of one exact override. */
const OVERRIDE_KEYS = new Set(['chord', 'replaceActionId']);

/** Internal compiled state published only after complete validation. */
interface CompiledKeymapState {
  readonly snapshot: KanbanActionKeymapSnapshot;
  readonly lookup: Keymap;
  readonly helpByAction: ReadonlyMap<string, string>;
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
  if (typeof properties.chord !== 'string') throw new KanbanInvalidSemanticValueError();
  return Object.freeze({
    chord: normalizeKanbanActionChord(properties.chord, primary),
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
  if (typeof properties.chord !== 'string') throw new KanbanInvalidSemanticValueError();
  return Object.freeze({
    chord: normalizeKanbanActionChord(properties.chord, primary),
    replaceActionId: registeredActionId(registry, properties.replaceActionId),
  });
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
  const initialBindings = new Map<string, KanbanActionKeyBinding>();
  for (const action of options.registry.actions()) {
    for (const chord of action.bindings) {
      addUniqueBinding(
        initialBindings,
        Object.freeze({ chord: normalizeKanbanActionChord(chord, primary), actionId: action.id }),
      );
    }
  }

  const defaultOrder = new Map(
    KANBAN_DEFAULT_ACTION_CHORDS.map((chord, index) => [normalizeKanbanActionChord(chord, primary), index]),
  );
  const orderedInitialBindings = [...initialBindings.values()].sort(
    (left, right) =>
      (defaultOrder.get(left.chord) ?? Number.MAX_SAFE_INTEGER) -
      (defaultOrder.get(right.chord) ?? Number.MAX_SAFE_INTEGER),
  );

  let state = compile(orderedInitialBindings, primary, 1);
  const subscribers = new Set<(snapshot: KanbanActionKeymapSnapshot) => void>();

  const keymap: KanbanActionKeymap = {
    resolve: (event: KanbanActionKeyEvent) => state.lookup.lookup(event),
    help: (actionId: string) => state.helpByAction.get(actionId),
    snapshot: () => state.snapshot,
    replace: (replacement: KanbanActionKeymapReplacement) => {
      const properties = snapshotKanbanDataProperties(replacement, REPLACEMENT_KEYS.size);
      validateKanbanDataKeys(properties, REPLACEMENT_KEYS);
      const proposed = snapshotKanbanDataArray(properties.bindings, MAX_KEYMAP_ENTRIES).map((entry) =>
        replacementBinding(options.registry, primary, entry),
      );
      const overrides = snapshotKanbanDataArray(properties.overrides ?? [], MAX_KEYMAP_ENTRIES).map((entry) =>
        replacementOverride(options.registry, primary, entry),
      );
      const overrideByChord = new Map(overrides.map((override) => [override.chord, override]));
      if (overrideByChord.size !== overrides.length) throw new KanbanInvalidSemanticValueError();

      const candidate = new Map(state.snapshot.bindings.map((binding) => [binding.chord, binding]));
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

      const next = compile([...candidate.values()], primary, state.snapshot.revision + 1);
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
