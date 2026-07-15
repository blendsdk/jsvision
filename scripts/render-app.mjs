// render-app — a headless "screenshot" for jsvision apps.
//
// Mounts a jsvision Application (or a single View/Group) into an offscreen buffer at a chosen size,
// optionally drives a key sequence, and prints the composed screen as framed ASCII — so an agent can
// SEE its layout (clipping, overlap, wrong position) without an interactive terminal. It is the
// visual half of the write → see → fix loop that `paintedCells > 0` cannot give you.
//
// Run through tsx so it can import a TypeScript app module:
//   yarn exec tsx scripts/render-app.mjs <module> [--export buildApp] [--pick root] [--size 80x24] [--keys "tab enter"]
//
// `bufferToText` is pure and exported for spec-testing; `renderModule` does the import + mount.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Frame a composed screen (a `Cell[][]`) as ASCII with a titled border showing its dimensions. */
export function bufferToText(rows, width, title) {
  const top = `┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 1))}┐`;
  const body = rows.map((row) => {
    const line = row
      .map((c) => c.char)
      .join('')
      .replace(/\s+$/, '');
    return `│${line}${' '.repeat(Math.max(0, width - [...line].length))}│`;
  });
  const bottom = `└${'─'.repeat(width + 1)}┘`;
  return [top, ...body, bottom].join('\n');
}

/** Parse a `"ctrl+s tab enter"` key spec into dispatchable key events. */
export function parseKeys(spec) {
  if (!spec) return [];
  return spec
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const parts = token.toLowerCase().split('+');
      const key = parts.pop();
      return {
        type: 'key',
        key,
        ctrl: parts.includes('ctrl'),
        alt: parts.includes('alt'),
        shift: parts.includes('shift'),
      };
    });
}

/** Pick the first export that exists among the candidates, or throw listing what is available. */
function resolveExport(mod, requested) {
  const candidates = requested ? [requested] : ['buildApp', 'build', 'default'];
  for (const name of candidates) {
    if (mod[name] !== undefined) return mod[name];
  }
  const available = Object.keys(mod).join(', ') || '(none)';
  throw new Error(
    `no export ${requested ? `'${requested}'` : `among buildApp/build/default`} found. Exports: ${available}`,
  );
}

/**
 * Import a module, build its app/view, mount it headlessly at `width × height`, optionally dispatch a
 * key sequence, and return the framed ASCII screen.
 *
 * @param {object} opts
 * @param {string} opts.module Path to the app module (relative to `cwd`).
 * @param {string} [opts.exportName] The export to render (default: buildApp | build | default).
 * @param {string} [opts.pick] A property to read off the built object (e.g. `root` for a recipe handle).
 * @param {number} [opts.width] Columns (default 80).
 * @param {number} [opts.height] Rows (default 24).
 * @param {string} [opts.keys] A key sequence to dispatch before the screenshot (e.g. `"tab enter"`).
 * @param {string} [opts.cwd] Base for resolving `module` (default `process.cwd()`).
 * @returns {Promise<string>} The framed ASCII screen.
 * @example
 * const screen = await renderModule({ module: './packages/examples/recipes/data-grid.ts', exportName: 'buildPeopleGrid', pick: 'root', width: 40, height: 12 });
 */
export async function renderModule(opts) {
  const { module: modulePath, exportName, pick, width = 80, height = 24, keys, cwd = process.cwd() } = opts;
  const { createEventLoop, resolveCapabilities } = await import('@jsvision/ui');

  const caps = resolveCapabilities({
    env: { LANG: 'en_US.UTF-8' },
    platform: 'linux',
    override: { colorDepth: 'truecolor' },
  }).profile;
  const mod = await import(pathToFileURL(resolve(cwd, modulePath)).href);

  let obj = resolveExport(mod, exportName);
  if (typeof obj === 'function') obj = obj();
  if (obj && typeof obj.then === 'function') obj = await obj;
  if (pick) obj = obj?.[pick];
  if (obj === undefined || obj === null)
    throw new Error('the export produced nothing to render (check --export/--pick)');

  const keyEvents = parseKeys(keys);
  let buffer;
  let label;
  if (obj.loop && typeof obj.loop.resize === 'function') {
    // An Application: it already owns a mounted loop; resize reflows + flushes the first frame.
    obj.loop.resize({ width, height });
    for (const ev of keyEvents) obj.loop.dispatch(ev);
    obj.loop.renderRoot.flush();
    buffer = obj.loop.renderRoot.buffer();
    label = 'app';
  } else {
    // A bare View/Group: mount it into a fresh loop.
    const loop = createEventLoop({ width, height }, { caps });
    loop.mount(obj);
    for (const ev of keyEvents) loop.dispatch(ev);
    loop.renderRoot.flush();
    buffer = loop.renderRoot.buffer();
    label = pick ?? exportName ?? 'view';
  }

  const meta = `${label} ${width}×${height}${keyEvents.length ? ` keys:${keyEvents.map((k) => k.key).join(',')}` : ''}`;
  return bufferToText(buffer.rows(), width, meta);
}

/** Parse `--flag value` / positional args into an options object. */
function parseArgs(argv) {
  const opts = { module: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--export') opts.exportName = argv[++i];
    else if (a === '--pick') opts.pick = argv[++i];
    else if (a === '--keys') opts.keys = argv[++i];
    else if (a === '--size') {
      const [w, h] = (argv[++i] ?? '').split('x').map(Number);
      if (w) opts.width = w;
      if (h) opts.height = h;
    } else if (!a.startsWith('--') && opts.module === undefined) opts.module = a;
  }
  return opts;
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (!opts.module) {
    process.stderr.write(
      'usage: tsx scripts/render-app.mjs <module> [--export name] [--pick prop] [--size WxH] [--keys "tab enter"]\n',
    );
    process.exitCode = 1;
    return;
  }
  try {
    process.stdout.write((await renderModule(opts)) + '\n');
  } catch (err) {
    process.stderr.write(`render-app failed: ${err?.message ?? err}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
