// Hand-written declarations for plugin-sync-request.mjs.
//
// TypeScript test files import this plain ESM script directly, so it needs a companion .d.mts to
// resolve under NodeNext. Only the surface the tests actually import is declared here — types are
// transcribed from the implementation's own JSDoc, not invented.

export declare const NEEDS_CATEGORISATION: string;

export declare function readWidgetDoc(name: string): { lead: string; example: string };

export declare function buildCatalogEntryRequest(name: string): {
  system: string;
  user: string;
  target: { file: string; afterHeading: string };
};

export declare function applyCatalogEntry(mdText: string, bullet: string, heading: string): string;
