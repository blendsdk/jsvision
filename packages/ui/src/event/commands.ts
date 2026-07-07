/**
 * The command registry backing the event loop's `emitCommand`/`enableCommand`/`isCommandEnabled`.
 *
 * A command is a named intent (e.g. `'quit'`, `'save'`) that any view can raise and any view can
 * handle. Commands are **enabled by default**: enablement is tracked as a set of explicit overrides,
 * so a command you never registered is still enabled, and only `enable(name, false)` disables it.
 * Emitting a disabled command is silently dropped. This module is internal to the loop — callers use
 * it indirectly through the {@link EventLoop} methods.
 */
import type { CommandEvent, DispatchEvent } from '../view/index.js';

/** Raise/enable/query commands, gated by an enable-override map. */
export interface CommandRegistry {
  /** Raise a command onto the current dispatch tick, unless it is disabled. */
  emit(name: string, arg?: unknown): void;
  /** Enable or disable a command. */
  enable(name: string, on: boolean): void;
  /** Whether a command is enabled. Commands are enabled by default until explicitly disabled. */
  isEnabled(name: string): boolean;
}

/** Options for {@link createCommandRegistry}. */
export interface CommandRegistryOptions {
  /** Command names to pre-register as enabled. Purely an introspection hint — unlisted commands are enabled too. */
  seed?: Iterable<string>;
  /** Sink that queues a built command event onto the active dispatch tick, so it routes like any other event. */
  enqueue: (ev: DispatchEvent) => void;
}

/**
 * Create a command registry.
 *
 * @param opts `seed` (optional up-front command names) plus the `enqueue` sink that pushes a raised
 *             command onto the active dispatch tick.
 * @returns A {@link CommandRegistry}.
 */
export function createCommandRegistry(opts: CommandRegistryOptions): CommandRegistry {
  const overrides = new Map<string, boolean>();
  if (opts.seed !== undefined) {
    for (const name of opts.seed) overrides.set(name, true);
  }

  // Absence from the map means "enabled": only an explicit enable(name, false) can disable a command.
  const isEnabled = (name: string): boolean => {
    const override = overrides.get(name);
    return override === undefined ? true : override;
  };

  const emit = (name: string, arg?: unknown): void => {
    if (!isEnabled(name)) return; // drop a disabled command before it ever reaches a view
    const command: CommandEvent =
      arg === undefined ? { type: 'command', command: name } : { type: 'command', command: name, arg };
    opts.enqueue({ event: command, handled: false });
  };

  const enable = (name: string, on: boolean): void => {
    overrides.set(name, on);
  };

  return { emit, enable, isEnabled };
}
