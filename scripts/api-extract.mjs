// Public-API extractor for the jsvision Claude Code plugin's generated API reference.
//
// Walks a package barrel with the TypeScript checker (the same mechanism as barrel-exports.mjs and
// check-plugin.mjs) and returns a compact, agent-optimized digest of every public export: its kind,
// its lead JSDoc sentence, and its call surface — a class's constructor + own public members, an
// interface's fields, a type alias's definition, or a function/const signature. Type text is read
// from the source declaration (not the checker's resolved form) so annotations stay exactly as
// written (`Signal<string>` stays `Signal<string>`), which is what a caller needs to see.
//
// Plain ESM so the `node` generator + gate scripts and the vitest specs share one implementation.

import ts from 'typescript';

const COMPILER_OPTIONS = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ESNext,
  allowJs: true,
  noEmit: true,
  skipLibCheck: true,
};

/** A symbol's whole JSDoc body collapsed to one line (for a compact member comment). */
function fullComment(sym, checker) {
  return ts.displayPartsToString(sym.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
}

/** Collapse a JSDoc body to a single lead sentence — but never break on a mid-sentence abbreviation. */
function leadSentence(sym, checker) {
  const full = fullComment(sym, checker);
  if (full === '') return '';
  // Split on the first sentence-ending period followed by whitespace + a capital (or end of string),
  // so "e.g." / "i.e." inside a sentence do not clip it early.
  const m = full.match(/\.(\s+[A-Z(`]|\s*$)/);
  return (m ? full.slice(0, m.index + 1) : full).trim();
}

/** Full one-line JSDoc for a member declaration node (kept whole — member docs are already concise). */
function memberDoc(node, checker) {
  const nameNode = node.name;
  if (nameNode === undefined) return '';
  const sym = checker.getSymbolAtLocation(nameNode);
  return sym === undefined ? '' : fullComment(sym, checker);
}

/** Render a declaration's type parameters as `<A, B>` (empty string when there are none). */
function typeParams(node) {
  const tps = node.typeParameters;
  return tps === undefined || tps.length === 0 ? '' : `<${tps.map((t) => t.getText()).join(', ')}>`;
}

// The View/Group/Window lifecycle + authoring protocol. A caller who USES a widget never calls these
// (they belong to widget authoring, documented separately), so they are dropped from the usage-facing
// member list — leaving each class's own widget-specific API (`sortBy`, `getText`, `setRange`, …).
const PROTOCOL_MEMBERS = new Set([
  'draw',
  'onEvent',
  'measure',
  'preProcess',
  'postProcess',
  'onMount',
  'onCleanup',
  'bind',
  'invalidate',
  'invalidateLayout',
  'mount',
  'unmount',
  'accelerators',
  'desiredCaret',
  'focusable',
  'handleCommand',
]);

/** True when a class/interface member is part of the documented public *usage* surface. */
function isPublicMember(node) {
  const mods = ts.getCombinedModifierFlags(node);
  if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) return false;
  const name = node.name?.getText() ?? '';
  if (name.startsWith('#') || name.startsWith('_')) return false; // ES-private or convention-private
  if (PROTOCOL_MEMBERS.has(name)) return false; // authoring/lifecycle protocol, not usage API
  if (ts.getJSDocTags(node).some((t) => t.tagName.getText() === 'internal')) return false;
  return true;
}

/** A method/getter/property signature line for a class member (no body, no JSDoc). */
function classMemberSig(node) {
  const name = node.name.getText();
  if (ts.isMethodDeclaration(node)) {
    const params = node.parameters.map((p) => p.getText()).join(', ');
    const ret = node.type?.getText();
    return `${name}(${params})${ret ? `: ${ret}` : ''}`;
  }
  if (ts.isGetAccessorDeclaration(node)) {
    const ret = node.type?.getText();
    return `${name}${ret ? `: ${ret}` : ''}`;
  }
  if (ts.isPropertyDeclaration(node)) {
    const t = node.type?.getText();
    return `${name}${node.questionToken ? '?' : ''}${t ? `: ${t}` : ''}`;
  }
  return null;
}

/** The base class a class `extends` (with type args), or `null` — so a caller can find inherited API. */
function baseClass(decl) {
  const clause = decl.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
  const first = clause?.types[0];
  return first === undefined ? null : first.getText();
}

/** Extract a class's constructor signature + its own public members + its base class. */
function extractClass(decl, name) {
  const ctor = decl.members.find((m) => ts.isConstructorDeclaration(m) && m.body !== undefined);
  const params = ctor ? ctor.parameters.map((p) => p.getText()).join(', ') : '';
  const construct = `new ${name}${typeParams(decl)}(${params})`;

  const members = [];
  for (const m of decl.members) {
    if (ts.isConstructorDeclaration(m)) continue;
    if (!(ts.isMethodDeclaration(m) || ts.isGetAccessorDeclaration(m) || ts.isPropertyDeclaration(m))) continue;
    if (!isPublicMember(m)) continue;
    const sig = classMemberSig(m);
    if (sig !== null && !members.includes(sig)) members.push(sig);
  }
  return { kind: 'class', construct, extends: baseClass(decl), members };
}

/** Extract an interface's fields as `{ sig, doc }` rows. `title` carries the generic-decorated name. */
function extractInterface(decl, name, checker) {
  const fields = [];
  for (const m of decl.members) {
    if (ts.isPropertySignature(m)) {
      const t = m.type?.getText();
      fields.push({
        sig: `${m.name.getText()}${m.questionToken ? '?' : ''}${t ? `: ${t}` : ''}`,
        doc: memberDoc(m, checker),
      });
    } else if (ts.isMethodSignature(m)) {
      const params = m.parameters.map((p) => p.getText()).join(', ');
      const ret = m.type?.getText();
      fields.push({ sig: `${m.name.getText()}(${params})${ret ? `: ${ret}` : ''}`, doc: memberDoc(m, checker) });
    }
  }
  return { kind: 'interface', title: `${name}${typeParams(decl)}`, fields };
}

/** Repo-relative source path of a declaration (e.g. `packages/ui/src/table/columns.ts`), for categorizing. */
function declFile(decl, rootDir) {
  const abs = decl.getSourceFile().fileName;
  const rel = abs.startsWith(rootDir) ? abs.slice(rootDir.length).replace(/^\/+/, '') : abs;
  return rel;
}

/** Build a single export's digest from its (alias-resolved) declaration. `.name` is always plain. */
function digestExport(exportName, sym, checker, rootDir) {
  const lead = leadSentence(sym, checker);
  const decl = sym.getDeclarations()?.[0];
  if (decl === undefined) return { name: exportName, kind: 'unknown', lead, file: '' };
  const base = { name: exportName, lead, file: declFile(decl, rootDir) };

  if (ts.isClassDeclaration(decl)) return { ...base, ...extractClass(decl, exportName) };
  if (ts.isInterfaceDeclaration(decl)) return { ...base, ...extractInterface(decl, exportName, checker) };
  if (ts.isTypeAliasDeclaration(decl)) {
    return { ...base, kind: 'type', def: `${exportName}${typeParams(decl)} = ${decl.type.getText()}` };
  }
  if (ts.isFunctionDeclaration(decl)) {
    const params = decl.parameters.map((p) => p.getText()).join(', ');
    const ret = decl.type?.getText();
    return { ...base, kind: 'function', sig: `${exportName}${typeParams(decl)}(${params})${ret ? `: ${ret}` : ''}` };
  }
  if (ts.isVariableDeclaration(decl)) {
    const t =
      decl.type?.getText() ??
      checker
        .typeToString(checker.getTypeOfSymbolAtLocation(sym, decl), decl, ts.TypeFormatFlags.NoTruncation)
        .replace(/\s+/g, ' ');
    return { ...base, kind: 'const', sig: `${exportName}: ${t}` };
  }
  if (ts.isEnumDeclaration(decl)) {
    return { ...base, kind: 'enum', members: decl.members.map((m) => m.name.getText()) };
  }
  return { ...base, kind: 'unknown' };
}

/**
 * Extract a compact digest of every public export a package barrel exposes.
 *
 * @param {string} entryFilePath Absolute path to a package's public entry `.ts` (e.g. ui/src/index.ts).
 * @param {string} [rootDir] Repo root, so each digest's `file` is repo-relative (default: cwd).
 * @returns {{ name: string, kind: string, lead: string, file: string }[]} One digest per export, sorted by name.
 * @example
 * const api = extractPackageApi('/repo/packages/ui/src/index.ts', '/repo');
 * // → [{ name: 'Button', kind: 'class', construct: 'new Button(...)', members: [...], file: 'packages/ui/...' }, …]
 */
export function extractPackageApi(entryFilePath, rootDir = process.cwd()) {
  const program = ts.createProgram([entryFilePath], COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryFilePath);
  if (!sourceFile) throw new Error(`extractPackageApi: cannot load entry point ${entryFilePath}`);
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return [];

  const out = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    // Resolve the barrel re-export alias to its defining symbol first, then honour `@internal` on the
    // target — matching barrel-exports.mjs exactly, so the two enumerations of the public surface agree.
    const sym = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    if (sym.getJsDocTags(checker).some((t) => t.name === 'internal')) continue;
    out.push(digestExport(exported.getName(), sym, checker, rootDir));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
