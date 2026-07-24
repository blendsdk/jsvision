import type { LanguageAdapter } from './contracts.js';

const plainFallback: LanguageAdapter = Object.freeze({
  contractVersion: 1,
  id: 'plain',
  extensions: [],
});

export interface LanguageSelection {
  readonly explicitId?: string;
  readonly filename?: string;
}

/**
 * Stores explicitly registered language adapters and resolves deterministic selections.
 * @example `new LanguageRegistry([adapter]).resolve({ filename: 'main.ts' })`
 */
export class LanguageRegistry {
  readonly #adapters = new Map<string, LanguageAdapter>();
  public constructor(adapters: readonly LanguageAdapter[]) {
    for (const adapter of adapters) {
      if (adapter.contractVersion !== 1 || !/^[a-z][a-z0-9-]{0,63}$/u.test(adapter.id)) {
        throw new TypeError('Language adapter has an incompatible contract or invalid identifier.');
      }
      this.#adapters.set(adapter.id, adapter);
    }
  }
  public get(id: string): LanguageAdapter {
    return this.#adapters.get(id) ?? this.#adapters.get('plain') ?? plainFallback;
  }
  public resolve(selection: LanguageSelection): LanguageAdapter {
    if (selection.explicitId !== undefined) return this.get(selection.explicitId);
    const filename = selection.filename?.toLowerCase() ?? '';
    for (const adapter of this.#adapters.values()) {
      if (adapter.extensions.some((extension) => filename.endsWith(extension))) return adapter;
    }
    return this.#adapters.get('plain') ?? plainFallback;
  }
}
