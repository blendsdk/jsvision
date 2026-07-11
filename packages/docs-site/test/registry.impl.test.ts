/**
 * Implementation tests for the example registry + the SSR/headless-safety
 * contract every example module must honour.
 *
 *  - Each `load()` resolves to a module with a `default` `ExampleDefinition`.
 *  - Static scan: no example module imports `@xterm/*` (browser-only, CommonJS-
 *    default — would break the VitePress SSR build and the headless smoke), and
 *    none reaches for a DOM global. The one sanctioned `@jsvision/web` import is
 *    the pure in-memory `createBrowserFileSystem`; the impure host surface
 *    (`mountApp`/`createBrowserHost`/`attachKeyReclaim`/`setClipboard`) is the
 *    Play component's job and must never appear in an example module.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { EXAMPLES } from '../examples/index.js';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES_DIR = join(PKG_ROOT, 'examples');
const NON_EXAMPLE_FILES = new Set(['_contract.ts', 'index.ts']);

/** Only the pure, `node:`/DOM-free `@jsvision/web` surface may be imported by an example. */
const ALLOWED_WEB_IMPORTS = new Set(['createBrowserFileSystem', 'FileTree', 'BrowserFileSystemOptions']);

/** Every example module file, as { absolute path, package-relative path, text }. */
function exampleModules(dir: string = EXAMPLES_DIR): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...exampleModules(abs));
    } else if (dirent.name.endsWith('.ts') && !NON_EXAMPLE_FILES.has(relative(EXAMPLES_DIR, abs))) {
      out.push({ rel: relative(PKG_ROOT, abs).split(sep).join('/'), text: readFileSync(abs, 'utf8') });
    }
  }
  return out;
}

/** Every module specifier imported (static `from '…'`, re-export, or dynamic `import('…')`). */
function importSpecifiers(text: string): string[] {
  const specs: string[] = [];
  for (const re of [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) specs.push(m[1]);
  }
  return specs;
}

/** The named bindings of every `import … from '@jsvision/web'` statement. */
function webImportBindings(text: string): string[] {
  const bindings: string[] = [];
  const re = /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]@jsvision\/web['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const clause = m[2];
    if (clause.startsWith('{')) {
      for (const raw of clause.slice(1, -1).split(',')) {
        const name = raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim();
        if (name) bindings.push(name);
      }
    } else {
      // A default or namespace import of @jsvision/web reaches the impure host surface — flag it.
      bindings.push(clause.trim());
    }
  }
  return bindings;
}

const MODULES = exampleModules();

// Each entry is a first-time dynamic import that vite compiles on demand; the
// full set can exceed the suite's default floor on a cold, slow CI runner
// (Windows first-compile), so this one test gets extra headroom.
test('every registry entry loads to a module with a default ExampleDefinition', async () => {
  for (const entry of EXAMPLES) {
    const mod = await entry.load();
    expect(mod.default, `${entry.id} default export`).toBeTruthy();
    expect(typeof mod.default.build, `${entry.id} build()`).toBe('function');
    expect(typeof mod.default.title).toBe('string');
    expect(typeof mod.default.blurb).toBe('string');
  }
}, 60_000);

test('no example module imports @xterm/*', () => {
  for (const mod of MODULES) {
    for (const spec of importSpecifiers(mod.text)) {
      expect(spec.startsWith('@xterm/'), `${mod.rel} imports ${spec}`).toBe(false);
    }
  }
});

test('an example module imports only the pure @jsvision/web FileSystem surface', () => {
  for (const mod of MODULES) {
    for (const binding of webImportBindings(mod.text)) {
      expect(
        ALLOWED_WEB_IMPORTS.has(binding),
        `${mod.rel} imports the impure @jsvision/web binding "${binding}" — keep the host surface in the Play component`,
      ).toBe(true);
    }
  }
});

test('no example module reaches for a DOM global (document./window.)', () => {
  for (const mod of MODULES) {
    expect(/\bdocument\s*\./.test(mod.text), `${mod.rel} uses document.*`).toBe(false);
    expect(/\bwindow\s*\./.test(mod.text), `${mod.rel} uses window.*`).toBe(false);
  }
});
