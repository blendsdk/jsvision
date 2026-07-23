#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function usage(message) {
  if (message) console.error(message);
  console.error(
    'Usage: audit-theme-contrast.mjs [--project DIR] (--preset NAME | --module FILE [--export NAME]) [--strict]',
  );
  process.exit(2);
}

const options = { project: process.cwd(), exportName: 'default', strict: false };
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--strict') options.strict = true;
  else if (arg === '--project') options.project = process.argv[++i];
  else if (arg === '--preset') options.preset = process.argv[++i];
  else if (arg === '--module') options.module = process.argv[++i];
  else if (arg === '--export') options.exportName = process.argv[++i];
  else usage(`Unknown argument: ${arg}`);
}

if (!options.project || (options.preset === undefined) === (options.module === undefined)) usage();

const project = resolve(options.project);
let searchDir = project;
let coreEntry;
while (true) {
  const packageDir = join(searchDir, 'node_modules', '@jsvision', 'core');
  const packageJson = join(packageDir, 'package.json');
  if (existsSync(packageJson)) {
    const manifest = JSON.parse(readFileSync(packageJson, 'utf8'));
    const entry = manifest.exports?.['.']?.import ?? manifest.module ?? manifest.main;
    if (typeof entry !== 'string') usage('@jsvision/core has no public ESM root export');
    coreEntry = resolve(packageDir, entry);
    break;
  }
  const parent = dirname(searchDir);
  if (parent === searchDir) usage(`Cannot find @jsvision/core from ${project}`);
  searchDir = parent;
}
const core = await import(pathToFileURL(coreEntry).href);
let theme;
let themeName;

if (options.preset !== undefined) {
  theme = core[options.preset];
  themeName = options.preset;
} else {
  const modulePath = isAbsolute(options.module) ? options.module : resolve(project, options.module);
  const loaded = await import(pathToFileURL(modulePath).href);
  theme = loaded[options.exportName];
  themeName = `${modulePath}#${options.exportName}`;
}

if (theme === undefined || theme === null || typeof theme !== 'object') {
  usage(`Theme not found: ${themeName}`);
}

const decorative = new Set(['desktop', 'shadow', 'buttonShadow']);
const disabled = new Set(['buttonDisabled', 'clusterDisabled', 'tabDisabled', 'calendarDisabled', 'windowInactive']);
const nonText = new Set([
  'scrollBarPage',
  'scrollBarControls',
  'listDivider',
  'historyButtonSides',
  'inputArrows',
  'progressFill',
  'progressTrack',
  'sliderTrack',
  'sliderThumb',
  'splitter',
  'splitterDragging',
  'gridDirty',
]);

const findings = [];
for (const [roleName, role] of Object.entries(theme)) {
  if (!role || typeof role !== 'object' || decorative.has(roleName) || disabled.has(roleName)) continue;
  const pairs = [
    ['fg', role.fg, role.bg, nonText.has(roleName) ? 3 : 4.5],
    ['hotkey', role.hotkey, role.bg, 4.5],
    ['border', role.border, role.bg, 3],
    ['title', role.title, role.bg, 4.5],
    ['icon', role.icon, role.bg, 3],
  ];
  for (const [field, foreground, background, target] of pairs) {
    if (foreground === undefined || background === undefined) continue;
    const ratio = core.contrastRatio(foreground, background);
    if (Number.isFinite(ratio) && ratio < target) {
      findings.push({ role: `${roleName}.${field}`, foreground, background, ratio, target });
    }
  }
}

console.log(`Theme contrast audit: ${themeName}`);
if (findings.length === 0) {
  console.log('PASS: no functional role pairs fell below their target.');
} else {
  for (const finding of findings) {
    console.log(
      `${finding.role}: ${finding.foreground} on ${finding.background} = ${finding.ratio.toFixed(2)}:1 (target ${finding.target}:1)`,
    );
  }
  console.log(`${findings.length} functional role pair(s) below target.`);
}

if (options.strict && findings.length > 0) process.exitCode = 1;
