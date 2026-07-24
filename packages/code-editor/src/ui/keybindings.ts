import { canonicalCodeEditorKeyName, codeEditorKeyToken, type CodeEditorCommand } from './input.js';

const COMMANDS: ReadonlySet<string> = new Set([
  'cursor.documentEnd',
  'search.open',
  'search.next',
  'fold.toggle',
  'fold.collapse',
  'fold.expand',
  'fold.collapseAll',
  'fold.expandAll',
  'assist',
  'navigate',
  'format',
  'save',
  'close',
]);

/**
 * Describes an unsafe canonical binding collision without hiding either command.
 *
 * @example
 * ```ts
 * if (error instanceof CodeEditorKeyBindingConflictError) console.error(error.binding);
 * ```
 */
export class CodeEditorKeyBindingConflictError extends Error {
  /** Canonical key token shared by both commands. */
  public readonly binding: string;
  /** Command already registered for the canonical token. */
  public readonly existingCommand: CodeEditorCommand;
  /** Command that attempted to claim the same canonical token. */
  public readonly incomingCommand: CodeEditorCommand;

  /**
   * Creates a descriptive collision error.
   *
   * @param binding - Canonical key token that collided.
   * @param existingCommand - Command already registered.
   * @param incomingCommand - Command rejected by the registry.
   */
  public constructor(binding: string, existingCommand: CodeEditorCommand, incomingCommand: CodeEditorCommand) {
    super(
      `Key binding ${binding} is already registered for ${existingCommand}; ` +
        `the incoming command is ${incomingCommand}.`,
    );
    this.name = 'CodeEditorKeyBindingConflictError';
    this.binding = binding;
    this.existingCommand = existingCommand;
    this.incomingCommand = incomingCommand;
  }
}

/**
 * Builds one immutable canonical binding map with expected-command override protection.
 *
 * An override names the command the host expects to replace. This prevents a stale customization
 * from silently displacing a different default after an application or package upgrade.
 *
 * @param defaults - Package-provided bindings registered first.
 * @param custom - Optional host bindings to add or replace explicitly.
 * @param overrides - Expected default command for every intentional replacement.
 * @returns A frozen record keyed by canonical binding names.
 * @throws {CodeEditorKeyBindingConflictError} When canonical bindings conflict or an override is stale.
 * @throws {TypeError} When any record, binding, or command is unsafe.
 *
 * @example
 * ```ts
 * registerCodeEditorKeyBindings(defaults, { 'Ctrl+F': 'assist' }, { 'Ctrl+F': 'search.open' });
 * ```
 */
export function registerCodeEditorKeyBindings(
  defaults: Readonly<Record<string, CodeEditorCommand>>,
  custom: Readonly<Record<string, CodeEditorCommand>> | undefined,
  overrides: Readonly<Record<string, CodeEditorCommand>> | undefined,
): Readonly<Record<string, CodeEditorCommand>> {
  const registered = uniqueBindings(defaults);
  const expectedOverrides = uniqueBindings(overrides);
  const consumedOverrides = new Set<string>();
  const customBindings = uniqueBindings(custom);

  for (const [binding, command] of customBindings) {
    const existing = registered.get(binding);
    if (existing === undefined || existing === command) {
      registered.set(binding, command);
      continue;
    }
    const expected = expectedOverrides.get(binding);
    if (expected !== existing) throw new CodeEditorKeyBindingConflictError(binding, existing, command);
    consumedOverrides.add(binding);
    registered.set(binding, command);
  }

  for (const [binding, expected] of expectedOverrides) {
    if (!consumedOverrides.has(binding)) {
      const actual = registered.get(binding);
      throw new CodeEditorKeyBindingConflictError(binding, actual ?? expected, customBindings.get(binding) ?? expected);
    }
  }
  return Object.freeze(Object.fromEntries(registered));
}

function uniqueBindings(
  value: Readonly<Record<string, CodeEditorCommand>> | undefined,
): Map<string, CodeEditorCommand> {
  const result = new Map<string, CodeEditorCommand>();
  for (const entry of readBindingRecord(value)) {
    const duplicate = result.get(entry.binding);
    if (duplicate !== undefined && duplicate !== entry.command) {
      throw new CodeEditorKeyBindingConflictError(entry.binding, duplicate, entry.command);
    }
    result.set(entry.binding, entry.command);
  }
  return result;
}

function readBindingRecord(
  value: Readonly<Record<string, CodeEditorCommand>> | undefined,
): readonly { readonly binding: string; readonly command: CodeEditorCommand }[] {
  if (value === undefined) return Object.freeze([]);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Key binding records must use a plain or null prototype.');
    }
    const result: { readonly binding: string; readonly command: CodeEditorCommand }[] = [];
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !('value' in descriptor) || !isCodeEditorCommand(descriptor.value)) {
        throw new TypeError(`Key binding ${key} has an invalid command.`);
      }
      result.push(Object.freeze({ binding: canonicalBinding(key), command: descriptor.value }));
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof CodeEditorKeyBindingConflictError || error instanceof TypeError) throw error;
    throw new TypeError('Key binding configuration could not be read safely.');
  }
}

function canonicalBinding(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new TypeError('Key binding names must be non-empty bounded strings.');
  }
  const parts = value.split('+');
  const rawKey = parts.pop();
  if (rawKey === undefined || rawKey.length === 0) throw new TypeError(`Key binding ${value} has no key.`);
  const key: {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  } = { key: canonicalCodeEditorKeyName(rawKey) };
  for (const rawModifier of parts) {
    const modifier = rawModifier.toLowerCase();
    const property =
      modifier === 'ctrl' ? 'ctrl' : modifier === 'alt' ? 'alt' : modifier === 'shift' ? 'shift' : undefined;
    if (property === undefined || key[property] === true) throw new TypeError(`Key binding ${value} is malformed.`);
    key[property] = true;
  }
  return codeEditorKeyToken(key);
}

function isCodeEditorCommand(value: unknown): value is CodeEditorCommand {
  return typeof value === 'string' && COMMANDS.has(value);
}
