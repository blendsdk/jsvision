/**
 * The pure, view-free stack model behind the navigation router: a LIFO list of screen entries plus
 * the navigation reducers (push/back/replace/reset). Each reducer returns a fresh array, so the
 * router can drive a signal from them and keep the reactive update clean. This module has no
 * dependency on views or the event loop, which makes the navigation semantics easy to unit-test.
 */
import { TuiError } from '@jsvision/core';

/** One screen on the stack: the route name plus the params it was entered with. */
export interface StackEntry {
  /** The route name. */
  readonly name: string;
  /** The params the route was entered with (`undefined` for a param-less route). */
  readonly params: unknown;
}

/** Whether there is a screen to go back to (more than one frame on the stack). */
export function canGoBack(stack: readonly StackEntry[]): boolean {
  return stack.length > 1;
}

/**
 * The top (current) entry. The stack is never empty in normal use — the router seeds it with the
 * initial route and never pops below one — so this throws if it somehow is, surfacing the bug.
 *
 * @param stack The current stack.
 * @returns The top entry.
 */
export function topEntry(stack: readonly StackEntry[]): StackEntry {
  const top = stack[stack.length - 1];
  if (top === undefined) throw new TuiError('router stack is empty');
  return top;
}

/** Push a new screen on top. Returns a fresh stack. */
export function pushEntry(stack: readonly StackEntry[], name: string, params: unknown): StackEntry[] {
  return [...stack, { name, params }];
}

/** Pop the top screen, unless it is the only one (back at root is a no-op). Returns a fresh stack. */
export function backEntry(stack: readonly StackEntry[]): StackEntry[] {
  return stack.length > 1 ? stack.slice(0, -1) : [...stack];
}

/** Replace the top screen in place — depth is unchanged. Returns a fresh stack. */
export function replaceEntry(stack: readonly StackEntry[], name: string, params: unknown): StackEntry[] {
  return [...stack.slice(0, -1), { name, params }];
}

/** Collapse the whole stack to a single fresh screen. */
export function resetEntry(name: string, params: unknown): StackEntry[] {
  return [{ name, params }];
}
