// Hand-written declarations for plugin-sync.mjs.
//
// TypeScript test files import this plain ESM script directly, so it needs a companion .d.mts to
// resolve under NodeNext. Only the surface the tests actually import is declared here — types are
// transcribed from the implementation's own JSDoc, not invented.

import type { DriftFinding, DriftRoots } from './check-plugin.mjs';

/** The grounded drafting request: the system prompt and the user prompt built from the widget's docs. */
export type DraftRequest = { system: string; user: string };

/**
 * The minimal shape `fixUndocumentedWidgets` calls on an injected drafting client: a `draft` method
 * taking the grounded request and resolving to the raw bullet text. The real Anthropic client and a
 * test's hand-rolled fake both satisfy this structurally.
 */
export type DraftClient = { draft: (request: DraftRequest) => Promise<string> };

export declare function replaceFencedBlock(mdText: string, region: string): string;

export declare function fixSnippetDrift(findings: DriftFinding[], roots?: DriftRoots): string[];

export declare function normalizeBullet(text: string): string;

export declare function fixUndocumentedWidgets(
  findings: DriftFinding[],
  client: DraftClient,
  roots?: DriftRoots,
): Promise<string[]>;
