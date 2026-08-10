#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIG_PATH = join(ROOT, 'tools', 'i18n-locale-exports.json');
const SAFE_NAME = /^[a-z][a-z0-9-]*$/u;
const SAFE_SYMBOL = /^[a-z][A-Za-z0-9]*$/u;
const SAFE_LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/u;

/** Convert a locale tag into the suffix used by checked catalog constants. */
function localeSuffix(locale) {
  return locale
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

/** Parse and validate the bounded generator manifest before using any configured path segment. */
async function loadConfig() {
  const value = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  if (
    value?.version !== 1 ||
    !Array.isArray(value.locales) ||
    value.locales.length !== 10 ||
    new Set(value.locales).size !== value.locales.length ||
    value.locales.some((locale) => typeof locale !== 'string' || !SAFE_LOCALE.test(locale)) ||
    !Array.isArray(value.packages) ||
    value.packages.length === 0
  ) {
    throw new Error('Invalid i18n locale export configuration.');
  }
  for (const entry of value.packages) {
    if (
      typeof entry?.name !== 'string' ||
      !SAFE_NAME.test(entry.name) ||
      typeof entry.symbolPrefix !== 'string' ||
      !SAFE_SYMBOL.test(entry.symbolPrefix) ||
      (entry.overlaySymbolPrefix !== undefined &&
        (typeof entry.overlaySymbolPrefix !== 'string' || !SAFE_SYMBOL.test(entry.overlaySymbolPrefix)))
    ) {
      throw new Error('Invalid i18n package export configuration.');
    }
  }
  if (
    new Set(value.packages.map((entry) => entry.name)).size !== value.packages.length ||
    new Set(value.packages.flatMap((entry) => [entry.symbolPrefix, entry.overlaySymbolPrefix].filter(Boolean))).size !==
      value.packages.reduce((count, entry) => count + (entry.overlaySymbolPrefix === undefined ? 1 : 2), 0)
  ) {
    throw new Error('Duplicate i18n package export configuration.');
  }
  return value;
}

/** Canonical checked source for one explicit locale subpath. */
function localeModule(packageName, symbolPrefix, overlaySymbolPrefix, locale) {
  const symbols = [symbolPrefix, overlaySymbolPrefix]
    .filter((prefix) => prefix !== undefined)
    .map((prefix) => `${prefix}${localeSuffix(locale)}`);
  const noun = overlaySymbolPrefix === undefined ? 'catalog' : 'catalogs';
  return `/** Official ${locale} ${noun} for the @jsvision/${packageName} locale subpath. */\nexport { ${symbols.join(', ')} } from '../i18n/locales.js';\n`;
}

/** Return a package manifest with exactly the configured explicit locale exports. */
function withLocaleExports(manifest, locales) {
  const exportsMap = Object.fromEntries(
    Object.entries(manifest.exports ?? {}).filter(([key]) => !key.startsWith('./locales/')),
  );
  for (const locale of locales) {
    exportsMap[`./locales/${locale}`] = {
      types: `./dist/locales/${locale}.d.ts`,
      import: `./dist/locales/${locale}.js`,
    };
  }
  return { ...manifest, exports: exportsMap };
}

/** Compare generated content in check mode, or write it during an update. */
async function publish(path, content, check, drift) {
  let current;
  try {
    current = await readFile(path, 'utf8');
  } catch {
    current = undefined;
  }
  if (current === content) return;
  if (check) {
    drift.push(path);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/** Generate or verify locale entry modules and package export maps. */
async function main() {
  const check = process.argv.includes('--check');
  if (process.argv.length > 3 || (process.argv[2] !== undefined && process.argv[2] !== '--check')) {
    throw new Error('Usage: update-i18n-locales.mjs [--check]');
  }
  const config = await loadConfig();
  const drift = [];
  for (const entry of config.packages) {
    const packageRoot = resolve(ROOT, 'packages', entry.name);
    const localeRoot = join(packageRoot, 'src', 'locales');
    const expectedNames = new Set(config.locales.map((locale) => `${locale}.ts`));
    let existingNames = [];
    try {
      existingNames = await readdir(localeRoot);
    } catch {
      existingNames = [];
    }
    for (const name of existingNames) {
      if (expectedNames.has(name)) continue;
      const path = join(localeRoot, name);
      if (check) drift.push(path);
      else await rm(path, { recursive: true, force: true });
    }
    for (const locale of config.locales) {
      await publish(
        join(localeRoot, `${locale}.ts`),
        localeModule(entry.name, entry.symbolPrefix, entry.overlaySymbolPrefix, locale),
        check,
        drift,
      );
    }
    const manifestPath = join(packageRoot, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const generatedManifest = `${JSON.stringify(withLocaleExports(manifest, config.locales), null, 2)}\n`;
    await publish(manifestPath, generatedManifest, check, drift);
  }
  if (drift.length > 0) {
    for (const path of drift) process.stderr.write(`i18n locale drift: ${path}\n`);
    process.exitCode = 1;
    return;
  }
  const entryCount = config.packages.length * config.locales.length;
  process.stdout.write(`${check ? 'Verified' : 'Updated'} ${entryCount} explicit locale entry points.\n`);
}

await main();
