// Hand-written declaration for the JS headless "screenshot" tool (render-app.mjs). It has no
// build step of its own, so this file exists only to let TS test files import it without
// TS7016/TS7006. It declares just the surface the spec test consumes: the two pure helpers and
// the async mount-and-render entry point.

/** The minimal cell shape `bufferToText` reads off a composed screen row — just the glyph. */
export interface RenderedCell {
  readonly char: string;
}

/** Frame a composed screen (rows of cells) as ASCII with a titled border showing its dimensions. */
export declare function bufferToText(rows: readonly (readonly RenderedCell[])[], width: number, title: string): string;

/** One parsed chord from a `"ctrl+s tab enter"` key spec, ready to dispatch to an event loop. */
export interface ParsedKeyEvent {
  readonly type: 'key';
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

/** Parse a whitespace-separated key-chord spec (e.g. `"ctrl+s shift+tab"`) into key events. */
export declare function parseKeys(spec?: string): ParsedKeyEvent[];

/** Options accepted by `renderModule` — mirrors render-app.mjs's CLI flags one for one. */
export interface RenderModuleOptions {
  /** Path to the app module, resolved against `cwd`. */
  readonly module: string;
  /** The export to render (default: buildApp | build | default). */
  readonly exportName?: string;
  /** A property to read off the built object (e.g. `root` for a recipe handle). */
  readonly pick?: string;
  /** Columns (default 80). */
  readonly width?: number;
  /** Rows (default 24). */
  readonly height?: number;
  /** A key sequence to dispatch before the screenshot (e.g. `"tab enter"`). */
  readonly keys?: string;
  /** Base for resolving `module` (default `process.cwd()`). */
  readonly cwd?: string;
}

/**
 * Import a module, build its app/view, mount it headlessly at the requested size, optionally
 * dispatch a key sequence, and return the framed ASCII screen.
 */
export declare function renderModule(opts: RenderModuleOptions): Promise<string>;
