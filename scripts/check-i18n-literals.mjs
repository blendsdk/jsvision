import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'tools/i18n-literals.json');
const SOURCE_ROOTS = ['packages/ui/src', 'packages/forms/src', 'packages/files/src', 'packages/datagrid/src'];
const STRING_PROPERTIES = new Set(['defaultMessage', 'label', 'placeholder', 'title']);
const STRING_CONSTRUCTORS = new Set(['Button', 'Dialog', 'Label', 'Text', 'Window']);
const STRING_CALLS = new Set(['confirm', 'confirmBox', 'infoBox', 'messageBox']);
const TRANSLATED_LABEL_CALLS = new Set([
  'uiAcceleratorLabel',
  'formsAcceleratorLabel',
  'filesAcceleratorLabel',
  'datagridAcceleratorLabel',
]);

/** Recursively list TypeScript source files in deterministic path order. */
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(absolute)));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(absolute);
  }
  return files;
}

/** Return a simple identifier/property name for a call or constructor expression. */
function expressionName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

/** Return a literal's property name when it is the direct value of an object property. */
function propertyName(node) {
  const parent = node.parent;
  if (!ts.isPropertyAssignment(parent) || parent.initializer !== node) return undefined;
  if (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name)) return parent.name.text;
  return undefined;
}

/** Find the translation key paired with a `defaultMessage` property. */
function translationKey(node) {
  const directCall = node.parent;
  if (ts.isCallExpression(directCall) && directCall.arguments[2] === node) {
    const name = expressionName(directCall.expression);
    const key = directCall.arguments[1];
    if (name !== undefined && TRANSLATED_LABEL_CALLS.has(name) && key !== undefined && ts.isStringLiteral(key)) {
      return key.text;
    }
  }
  const property = node.parent;
  const object = property.parent;
  const call = object.parent;
  if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(object) || !ts.isCallExpression(call)) {
    return undefined;
  }
  if (call.arguments[1] !== object || expressionName(call.expression) !== 't') return undefined;
  const key = call.arguments[0];
  return key !== undefined && ts.isStringLiteral(key) ? key.text : undefined;
}

/** Classify obvious framework text seams while ignoring imports, type names, and technical keys. */
function candidateContext(node) {
  const property = propertyName(node);
  if (property !== undefined && STRING_PROPERTIES.has(property))
    return property === 'defaultMessage' ? 'default-message' : property;

  const parent = node.parent;
  if (ts.isCallExpression(parent) && parent.arguments[2] === node) {
    const name = expressionName(parent.expression);
    if (name !== undefined && TRANSLATED_LABEL_CALLS.has(name)) return 'default-message';
  }
  if (ts.isNewExpression(parent) && parent.arguments?.includes(node)) {
    const name = expressionName(parent.expression);
    if (name !== undefined && STRING_CONSTRUCTORS.has(name)) return `constructor:${name}`;
  }
  if (ts.isCallExpression(parent) && parent.arguments.includes(node)) {
    const name = expressionName(parent.expression);
    if (name !== undefined && STRING_CALLS.has(name)) return `call:${name}`;
  }
  if (
    ts.isArrayLiteralExpression(parent) &&
    ts.isVariableDeclaration(parent.parent) &&
    ts.isIdentifier(parent.parent.name) &&
    parent.parent.name.text === 'labels'
  ) {
    return 'labels-array';
  }
  return undefined;
}

/** Extract unique candidate identities from one source file. */
async function candidatesForFile(absolutePath) {
  const sourceText = await readFile(absolutePath, 'utf8');
  const source = ts.createSourceFile(absolutePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relativePath = path.relative(ROOT, absolutePath).split(path.sep).join('/');
  const candidates = [];

  function visit(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\p{L}]/u.test(node.text)) {
      const context = candidateContext(node);
      if (context !== undefined) {
        const start = source.getLineAndCharacterOfPosition(node.getStart(source));
        candidates.push({
          path: relativePath,
          context,
          literal: node.text,
          line: start.line + 1,
          ...(context === 'default-message' && translationKey(node) !== undefined
            ? { inferredKey: translationKey(node) }
            : {}),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return candidates;
}

/** Stable identity used by both extracted candidates and manifest entries. */
function identity(value) {
  return `${value.path}\u0000${value.context}\u0000${value.literal}`;
}

/** Validate the checked manifest before comparing it with source. */
function validateManifest(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Manifest must be an object.');
  if (value.schema !== 1 || !Array.isArray(value.entries))
    throw new TypeError('Manifest requires schema 1 and an entries array.');
  for (const entry of value.entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry))
      throw new TypeError('Each entry must be an object.');
    if (
      typeof entry.path !== 'string' ||
      typeof entry.context !== 'string' ||
      typeof entry.literal !== 'string' ||
      !['localized', 'non-localized'].includes(entry.disposition) ||
      !['framework', 'caller', 'technical'].includes(entry.owner)
    ) {
      throw new TypeError('Each entry requires path, context, literal, disposition, and owner.');
    }
    if (entry.disposition === 'localized' && typeof entry.key !== 'string') {
      throw new TypeError('Localized entries require a translation key.');
    }
  }
  return value;
}

const extracted = (
  await Promise.all(
    (await Promise.all(SOURCE_ROOTS.map((root) => sourceFiles(path.join(ROOT, root))))).flat().map(candidatesForFile),
  )
)
  .flat()
  .sort((left, right) => identity(left).localeCompare(identity(right)));

if (process.argv.includes('--list')) {
  process.stdout.write(`${JSON.stringify(extracted, null, 2)}\n`);
  process.exit(0);
}

const manifest = validateManifest(JSON.parse(await readFile(MANIFEST_PATH, 'utf8')));
const sourceByIdentity = new Map(extracted.map((candidate) => [identity(candidate), candidate]));
const manifestByIdentity = new Map(manifest.entries.map((entry) => [identity(entry), entry]));
const missing = extracted.filter((candidate) => !manifestByIdentity.has(identity(candidate)));
const stale = manifest.entries.filter((entry) => !sourceByIdentity.has(identity(entry)));
const keyMismatches = extracted.filter((candidate) => {
  if (candidate.inferredKey === undefined) return false;
  const entry = manifestByIdentity.get(identity(candidate));
  return entry?.disposition !== 'localized' || entry.key !== candidate.inferredKey;
});

if (missing.length > 0 || stale.length > 0 || keyMismatches.length > 0) {
  for (const candidate of missing) {
    process.stderr.write(
      `Unclassified i18n literal: ${candidate.path}:${candidate.line} ${JSON.stringify(candidate.literal)}\n`,
    );
  }
  for (const entry of stale) {
    process.stderr.write(`Stale i18n literal entry: ${entry.path} ${JSON.stringify(entry.literal)}\n`);
  }
  for (const candidate of keyMismatches) {
    process.stderr.write(
      `Incorrect localized key: ${candidate.path}:${candidate.line} expected ${candidate.inferredKey}\n`,
    );
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`i18n literal ownership: ${extracted.length} candidates classified\n`);
}
