/**
 * Specification test (immutable oracle) — `@jsvision/datagrid` ships no dynamic-code-execution sink:
 * the package source contains no `eval(`, `new Function(`, or dynamic `require(` call. There is no
 * user-supplied-code path in the grid, so a static source scan is a sufficient guarantee.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// No dynamic-code-execution sink anywhere in the package source.
test('should contain no eval / new Function / dynamic require in package source', () => {
  const forbidden = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\brequire\s*\(/];
  const files = tsFiles(srcDir);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const re of forbidden) {
      expect(re.test(text), `${file} must not match ${re}`).toBe(false);
    }
  }
});
