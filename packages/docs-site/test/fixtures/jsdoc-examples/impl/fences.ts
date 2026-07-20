// Fixture: the four fence shapes an `@example` body appears in across the repo.
// All four must reduce to the same fence-free body.

/**
 * Bare triple-backtick fence.
 *
 * @example
 * ```
 * const bare = 1;
 * ```
 */
export function bareFence(): void {}

/**
 * `ts`-tagged fence.
 *
 * @example
 * ```ts
 * const bare = 1;
 * ```
 */
export function tsFence(): void {}

/**
 * `typescript`-tagged fence.
 *
 * @example
 * ```typescript
 * const bare = 1;
 * ```
 */
export function typescriptFence(): void {}

/**
 * No fence at all.
 *
 * @example
 * const bare = 1;
 */
export function noFence(): void {}
