/**
 * Semantic compilation checks for the self-contained focused-usage snippets on the Data Grid hub.
 *
 * The component-page template intentionally permits short illustrative fragments elsewhere. These
 * two introductory snippets are complete copyable examples, so compiling them catches stale public
 * constructor shapes without forcing every conceptual fragment to become a runnable application.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

const PAGES = ['layout-and-rendering.md', 'sorting-and-filtering.md'] as const;

/** Extract the first TypeScript fence from one specialist page. */
function focusedUsageSource(page: string): string {
  const markdown = readFileSync(resolve('components/data-grid', page), 'utf8');
  const match = /```ts\n([\s\S]*?)\n```/.exec(markdown);
  if (match?.[1] === undefined) throw new Error(`${page} is missing its focused TypeScript example`);
  return match[1];
}

/** Compile one in-memory snippet against the workspace's real public package declarations. */
function compileSnippet(page: string, source: string): readonly ts.Diagnostic[] {
  const filename = resolve(`__data-grid-docs-${page.replace('.md', '')}.ts`);
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const readSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (candidate) => candidate === filename || ts.sys.fileExists(candidate);
  host.readFile = (candidate) => (candidate === filename ? source : ts.sys.readFile(candidate));
  host.getSourceFile = (candidate, languageVersion, onError, shouldCreateNewSourceFile) =>
    candidate === filename
      ? ts.createSourceFile(candidate, source, languageVersion, true)
      : readSourceFile(candidate, languageVersion, onError, shouldCreateNewSourceFile);
  return ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
}

describe('Data Grid focused-usage snippets', () => {
  test.each(PAGES)('%s compiles against public APIs', (page) => {
    const diagnostics = compileSnippet(page, focusedUsageSource(page));
    expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
  });
});
