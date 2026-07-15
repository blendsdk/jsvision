// jsvision-doctor — a static linter for the documented jsvision footguns.
//
// Turns the plugin's `gotchas.md` knowledge into an active guardrail: it parses a jsvision app's
// TypeScript with the compiler's SYNTAX tree (no type-checking, no build, no cross-file resolution —
// fast and dependency-light) and reports the common mistakes that make an app misbehave. Each finding
// cites the gotcha it maps to and how to fix it.
//
// The pure `lintText(source, fileName)` is exported so its behavior is spec-tested against good and
// broken inputs; `main()` is guarded so importing this module has no side effects.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/** Widget classes whose constructor produces a window/dialog whose OWN placement rect is legitimate. */
const WINDOW_LIKE = new Set(['Window', 'Dialog', 'EditWindow']);
/** Container widgets whose keyboard target is their inner `.rows` renderer, not the container. */
const CONTAINER_LIKE = new Set(['DataGrid', 'ListView', 'ListBox', 'Tree']);

/** Walk every node depth-first. */
function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** Walk depth-first but do not descend into any subtree for which `prune(node)` is true. */
function walkPruned(node, visit, prune) {
  if (prune(node)) return;
  visit(node);
  ts.forEachChild(node, (child) => walkPruned(child, visit, prune));
}

/** A call to `onMount(...)`/`onCleanup(...)` — its callback runs after mount, so binds inside it are correct. */
function isDeferralCall(node) {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
  return name === 'onMount' || name === 'onCleanup';
}

/** The 1-based line of a node's first token. */
function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/** The base identifier of an assignment target like `input.layout` or `win.layout.rect` → `input`/`win`. */
function baseIdentifier(expr) {
  let node = expr;
  while (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) node = node.expression;
  return ts.isIdentifier(node) ? node.text : null;
}

/** Collect the app's construction context: which vars are windows/dialogs, which are containers, etc. */
function collectContext(sourceFile) {
  const windowVars = new Set();
  const containerVars = new Set();
  let hasExecView = false;

  walk(sourceFile, (node) => {
    // `const x = new Window(...)` / `new DataGrid(...)` → remember x's widget family.
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isNewExpression(node.initializer)) {
      const ctor = node.initializer.expression;
      const ctorName = ts.isIdentifier(ctor) ? ctor.text : null;
      const varName = ts.isIdentifier(node.name) ? node.name.text : null;
      if (ctorName && varName) {
        if (WINDOW_LIKE.has(ctorName)) windowVars.add(varName);
        if (CONTAINER_LIKE.has(ctorName)) containerVars.add(varName);
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : '';
      if (name === 'execView') hasExecView = true;
    }
  });
  return { windowVars, containerVars, hasExecView };
}

/** A relative import specifier that omits the NodeNext `.js` extension (gotcha 11). */
function isExtensionlessRelative(spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return false;
  const last = spec.split('/').pop() ?? '';
  return !/\.(js|mjs|cjs|json|css)$/.test(last);
}

/**
 * Lint one jsvision source file's text for the documented footguns, returning structured findings.
 * Pure — no filesystem, no type-checking; it parses the syntax tree and applies heuristic checks.
 *
 * @param {string} source The TypeScript source text.
 * @param {string} [fileName] A label for the findings (default `'source.ts'`).
 * @returns {{ file: string, line: number, level: 'error'|'warn'|'info', rule: string, message: string }[]}
 * @example
 * const findings = lintText("import { View } from './view';", 'a.ts');
 * // → [{ rule: 'missing-js-extension', level: 'error', ... }]
 */
export function lintText(source, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const ctx = collectContext(sourceFile);
  const findings = [];
  const add = (node, level, rule, message) =>
    findings.push({ file: fileName, line: lineOf(sourceFile, node), level, rule, message });

  walk(sourceFile, (node) => {
    // gotcha 11 — a relative import/export without the `.js` extension breaks NodeNext ESM.
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const spec = node.moduleSpecifier;
      if (ts.isStringLiteral(spec) && isExtensionlessRelative(spec.text)) {
        add(
          spec,
          'error',
          'missing-js-extension',
          `relative import '${spec.text}' needs a '.js' extension (NodeNext ESM)`,
        );
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg) && isExtensionlessRelative(arg.text)) {
        add(
          arg,
          'error',
          'missing-js-extension',
          `dynamic import '${arg.text}' needs a '.js' extension (NodeNext ESM)`,
        );
      }
    }

    // gotcha 2 — `bind()`/`onCleanup()` DIRECTLY in a constructor runs before the reactive scope
    // exists. A bind nested inside `onMount(...)` is the correct pattern, so prune those subtrees.
    if (ts.isConstructorDeclaration(node) && node.body) {
      walkPruned(
        node.body,
        (inner) => {
          if (
            ts.isCallExpression(inner) &&
            ts.isPropertyAccessExpression(inner.expression) &&
            inner.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            (inner.expression.name.text === 'bind' || inner.expression.name.text === 'onCleanup')
          ) {
            add(
              inner,
              'warn',
              'bind-in-constructor',
              `move 'this.${inner.expression.name.text}(...)' into onMount — the reactive scope only exists after mount (gotcha 2)`,
            );
          }
        },
        (n) => n !== node.body && isDeferralCall(n),
      );
    }

    // gotcha 1 — a custom `View` subclass with no measure() collapses to {0,0} in an auto slot.
    if (ts.isClassDeclaration(node)) {
      const extendsView = node.heritageClauses?.some(
        (h) =>
          h.token === ts.SyntaxKind.ExtendsKeyword && h.types.some((t) => t.expression.getText(sourceFile) === 'View'),
      );
      const hasMeasure = node.members.some(
        (m) => (ts.isMethodDeclaration(m) || ts.isMethodSignature(m)) && m.name?.getText(sourceFile) === 'measure',
      );
      if (extendsView && !hasMeasure) {
        add(
          node,
          'warn',
          'view-without-measure',
          `custom View '${node.name?.text ?? '<anon>'}' has no measure() — it collapses to {0,0} in an auto slot; add measure() or give instances a fixed/grow size (gotcha 1)`,
        );
      }
    }

    // gotcha 3 — positioning app content with absolute rects instead of the col/row/stack DSL.
    if (ts.isObjectLiteralExpression(node)) {
      const isAbsolute = node.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) &&
          p.name.getText(sourceFile) === 'position' &&
          ts.isStringLiteral(p.initializer) &&
          p.initializer.text === 'absolute',
      );
      if (isAbsolute) {
        const assign = findEnclosingAssignmentBase(node);
        if (assign === null || !ctx.windowVars.has(assign)) {
          add(
            node,
            'warn',
            'content-absolute-rect',
            `positioning content with an absolute rect — prefer the col/row/stack DSL; absolute is only for a window/dialog's own placement or an overlay (gotcha 3)`,
          );
        }
      }
    }
    // `win.layout.rect = {...}` on a non-window var is also content-positioning.
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const lhs = node.left;
      if (
        ts.isPropertyAccessExpression(lhs) &&
        lhs.name.text === 'rect' &&
        ts.isPropertyAccessExpression(lhs.expression) &&
        lhs.expression.name.text === 'layout'
      ) {
        const base = baseIdentifier(lhs.expression.expression);
        if (base !== null && !ctx.windowVars.has(base)) {
          add(
            node,
            'warn',
            'content-absolute-rect',
            `'${base}.layout.rect = ...' positions content with an absolute rect — prefer the col/row/stack DSL (gotcha 3)`,
          );
        }
      }
    }

    // gotcha 10 — focusing a list/grid container instead of its inner `.rows` renderer.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if ((method === 'focusView' || method === 'focusInto') && node.arguments.length === 1) {
        const arg = node.arguments[0];
        if (ts.isIdentifier(arg) && ctx.containerVars.has(arg.text)) {
          add(
            node,
            'warn',
            'focus-container-not-rows',
            `focus '${arg.text}.rows', not the container — keyboard nav lives on the inner renderer (gotcha 10)`,
          );
        }
      }
    }

    // gotcha 8 — closing a modal with .close() leaves its execView promise hanging.
    if (
      ctx.hasExecView &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'close' &&
      node.arguments.length === 0
    ) {
      add(
        node,
        'info',
        'modal-close',
        `if this is a modal opened via execView, resolve it with the OK/Cancel command (or endModal), not .close() (gotcha 8)`,
      );
    }

    // gotcha 6 — a signal write inside a timer never repaints without a flush / no-op command.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'setInterval' || node.expression.text === 'setTimeout')
    ) {
      const cb = node.arguments[0];
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) && cb.body) {
        let setsSignal = false;
        let flushes = false;
        walk(cb.body, (inner) => {
          if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) {
            const n = inner.expression.name.text;
            if (n === 'set') setsSignal = true;
            if (n === 'flush' || n === 'emitCommand') flushes = true;
          }
        });
        if (setsSignal && !flushes) {
          add(
            node,
            'info',
            'signal-set-without-flush',
            `a signal write in a timer won't repaint on its own — call loop.renderRoot.flush() or loop.emitCommand('tick') after it (gotcha 6)`,
          );
        }
      }
    }
  });

  return findings.sort((a, b) => a.line - b.line);
}

/** Climb from an object literal to the base identifier of the assignment it initializes, or null. */
function findEnclosingAssignmentBase(objectLiteral) {
  let node = objectLiteral.parent;
  while (node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return baseIdentifier(node.left);
    }
    if (ts.isVariableDeclaration(node)) return ts.isIdentifier(node.name) ? node.name.text : null;
    // Stop climbing at a statement boundary — the object literal is an argument, not an assignment RHS.
    if (ts.isStatement(node)) return null;
    node = node.parent;
  }
  return null;
}

/** Recursively list the `.ts` source files under a path (skipping node_modules, dist, and tests). */
function collectFiles(path) {
  const st = statSync(path);
  if (st.isFile()) return path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
  const out = [];
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name === 'dist' || name === '.turbo') continue;
    const full = join(path, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...collectFiles(full));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !/\.(test|spec|impl|e2e)\.ts$/.test(name))
      out.push(full);
  }
  return out;
}

/**
 * Lint every source file under the given paths.
 *
 * @param {string[]} paths Files or directories to scan.
 * @param {string} [cwd] Base for the reported relative paths (default `process.cwd()`).
 * @returns {ReturnType<typeof lintText>} All findings, file-then-line ordered.
 */
export function lintPaths(paths, cwd = process.cwd()) {
  const findings = [];
  for (const p of paths) {
    for (const file of collectFiles(p)) {
      findings.push(...lintText(readFileSync(file, 'utf8'), relative(cwd, file)));
    }
  }
  return findings;
}

const ICON = { error: '✗', warn: '⚠', info: 'ℹ' };

/** Render findings as a readable report. */
export function formatFindings(findings) {
  if (findings.length === 0) return 'jsvision-doctor: no issues found ✓';
  const lines = findings.map((f) => `  ${ICON[f.level] ?? '•'} ${f.file}:${f.line}  [${f.rule}] ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  const infos = findings.filter((f) => f.level === 'info').length;
  return [`jsvision-doctor: ${errors} error(s), ${warns} warning(s), ${infos} info`, ...lines].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const paths = argv.length > 0 ? argv : ['.'];
  const findings = lintPaths(paths);
  process.stdout.write(formatFindings(findings) + '\n');
  if (findings.some((f) => f.level === 'error')) process.exitCode = 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
