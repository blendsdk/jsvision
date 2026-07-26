import type {
  CodeEditorCapabilityInventoryEntry,
  CodeEditorDemoAction,
  CodeEditorDemoFixture,
  CodeEditorDemoScenario,
} from './scenarios.js';

/** Factory seam supplied by the runtime registry to keep mounting logic out of catalog data. */
type DefineScenario = (
  metadata: Omit<CodeEditorDemoScenario, 'fixture' | 'mount' | 'actions'>,
  fixture: CodeEditorDemoFixture,
  windowed?: boolean,
  theme?: 'dark' | 'light',
  lineNumbers?: boolean,
) => CodeEditorDemoScenario;

/** Builds the ordered immutable scenario catalog used by the live and headless showcases. */
export function createCodeEditorScenarioCatalog(
  scenario: DefineScenario,
  inventory: readonly CodeEditorCapabilityInventoryEntry[],
): readonly CodeEditorDemoScenario[] {
  const generatedLargeText = `${'x\n'.repeat(50_001)}// generated at runtime`;
  const intelligenceFixture: CodeEditorDemoFixture = {
    title: 'service.ts',
    languageId: 'typescript',
    demonstrates: ['lifecycle-decisions', 'degradation-and-recovery', 'adapter-typescript'],
    text: 'const message = greet("terminal");\n',
  };
  const qaScenarios = createLanguageIntelligenceQaScenarios(scenario, intelligenceFixture);
  const capabilityInventoryText = inventory
    .map(
      (entry) =>
        `[${entry.status}] ${entry.id} — ${entry.title}${entry.reason === undefined ? '' : `: ${entry.reason}`}`,
    )
    .join('\n');

  return Object.freeze([
    scenario(
      {
        id: 'typescript-window',
        title: 'TypeScript editor window',
        description: 'Edit, select, search, fold, undo, save, and inspect line/column state.',
        capabilities: ['editor-and-window', 'editing-lifecycle', 'local-language-features', 'full-document-tier'],
      },
      {
        title: 'main.ts',
        languageId: 'typescript',
        languageSelection: { filename: 'main.ts' },
        demonstrates: ['language-from-extension', 'adapter-typescript', 'line-ending-lf'],
        text: 'interface User { name: string; }\nconst user: User = { name: "Ada" };\nconsole.log(user.name);\n',
      },
      true,
      'dark',
    ),
    scenario(
      {
        id: 'direct-editor',
        title: 'Direct embedded editor',
        description: 'Use the borderless CodeEditor surface without window chrome.',
        capabilities: ['editor-and-window', 'editing-lifecycle'],
      },
      {
        title: 'embedded.ts',
        languageId: 'typescript',
        languageSelection: { explicitId: 'typescript' },
        demonstrates: ['language-explicit-selection', 'adapter-typescript'],
        text: 'export const embedded = true;\n',
      },
      false,
      'dark',
    ),
    scenario(
      {
        id: 'capability-inventory',
        title: 'Capability inventory',
        description: 'Review every interactive, automated-only, and unsupported showcase capability.',
        capabilities: ['editor-and-window', 'accessibility-and-resize'],
      },
      {
        title: 'capabilities.txt',
        languageId: 'plain',
        text: capabilityInventoryText,
        readOnly: true,
      },
      true,
      'light',
      true,
    ),
    scenario(
      {
        id: 'read-only-editor',
        title: 'Read-only document',
        description: 'Inspect navigation and selection while source mutations remain blocked.',
        capabilities: ['editing-lifecycle', 'full-document-tier'],
      },
      {
        title: 'locked.sql',
        languageId: 'postgresql',
        demonstrates: ['lifecycle-decisions', 'adapter-postgresql'],
        text: 'SELECT current_user;\n',
        readOnly: true,
      },
      true,
      'dark',
      true,
    ),
    scenario(
      {
        id: 'postgresql-folding',
        title: 'PostgreSQL structural folding',
        description: 'Fold and unfold a parser-backed query with a nested subquery.',
        capabilities: ['local-language-features', 'accessibility-and-resize'],
      },
      {
        title: 'folding.sql',
        languageId: 'postgresql',
        demonstrates: ['adapter-postgresql', 'folding-commands'],
        text: [
          'SELECT nested.id',
          'FROM (',
          '  SELECT id',
          '  FROM app_user',
          '  WHERE active = TRUE',
          ') AS nested;',
          'SELECT current_user;',
        ].join('\n'),
      },
      true,
      'dark',
      true,
    ),
    scenario(
      {
        id: 'structural-folding',
        title: 'Structural code folding',
        description: 'Fold and unfold real nested TypeScript parser ranges from the gutter or action menu.',
        capabilities: ['local-language-features', 'accessibility-and-resize'],
      },
      {
        title: 'folding.ts',
        languageId: 'typescript',
        demonstrates: ['adapter-typescript', 'folding-commands'],
        text: [
          'export function outer(value: number) {',
          '  if (value > 0) {',
          '    return value;',
          '  }',
          '  return 0;',
          '}',
          'console.log(outer(1));',
        ].join('\n'),
      },
      true,
      'dark',
      true,
    ),
    scenario(
      {
        id: 'modern-keyboard-editing',
        title: 'Modern keyboard editing',
        description: 'Try selection-aware Tab, navigation, history, clipboard, and Ctrl+/ comments.',
        capabilities: ['editing-lifecycle', 'local-language-features'],
      },
      {
        title: 'keyboard.ts',
        languageId: 'typescript',
        text: 'function greet(name: string) {\n  return `Hello ${name}`;\n}\n',
      },
      true,
      'dark',
    ),
    scenario(
      {
        id: 'viewport-and-mouse',
        title: 'Viewport and mouse interaction',
        description: 'Resize, wheel-scroll, drag-select, double-click source runs, and watch both scrollbars.',
        capabilities: ['editor-and-window', 'editing-lifecycle', 'accessibility-and-resize'],
      },
      {
        title: 'viewport.ts',
        languageId: 'typescript',
        demonstrates: ['terminal-resize', 'adapter-typescript'],
        text: [
          'export function describeViewport(width: number, height: number) {',
          '  const terminalColumns = Math.max(1, width);',
          '  const terminalRows = Math.max(1, height);',
          '  return { terminalColumns, terminalRows, interaction: "mouse-and-wheel" };',
          '}',
          '',
          '// Continue typing below to observe caret-follow scrolling.',
          'const first = describeViewport(80, 24);',
          'const second = describeViewport(44, 12);',
          'console.log(first, second);',
        ].join('\n'),
      },
      true,
      'dark',
      true,
    ),
    scenario(
      {
        id: 'line-number-gutter',
        title: 'Optional line-number gutter',
        description: 'Inspect fixed one-based line numbers, the active-line cue, scrolling, and narrow fallback.',
        capabilities: ['local-language-features', 'accessibility-and-resize'],
      },
      {
        title: 'numbered.ts',
        languageId: 'typescript',
        text: Array.from({ length: 14 }, (_, index) => `const line${index + 1} = ${index + 1};`).join('\n'),
      },
      true,
      'dark',
      true,
    ),
    scenario(
      {
        id: 'language-gallery',
        title: 'SQL, JavaScript, TypeScript, and plain text',
        description: 'Switch language adapters and inspect partial highlighting for incomplete source.',
        capabilities: ['languages-sql-javascript-typescript-plain', 'local-language-features'],
      },
      {
        title: 'query.sql',
        languageId: 'postgresql',
        languageSelection: { explicitId: 'postgresql' },
        demonstrates: [
          'language-explicit-selection',
          'adapter-postgresql',
          'adapter-javascript',
          'adapter-typescript',
          'adapter-plain',
          'source-incomplete',
        ],
        text: 'SELECT u.id, u.display_name\nFROM app_user AS u\nWHERE u.active = TRUE;\n',
      },
    ),
    scenario(
      {
        id: 'missing-language-adapter',
        title: 'Missing language adapter fallback',
        description: 'Resolve an unavailable explicit adapter to safe parser-free plain text.',
        capabilities: ['languages-sql-javascript-typescript-plain', 'local-language-features'],
      },
      {
        title: 'unknown.future',
        languageId: 'plain',
        languageSelection: { explicitId: 'future-language' },
        demonstrates: ['adapter-missing', 'adapter-plain'],
        text: 'future syntax remains editable and safe\n',
      },
      false,
    ),
    scenario(
      {
        id: 'invalid-and-incomplete-source',
        title: 'Incomplete and invalid source',
        description: 'Keep partial highlighting and editing available while source is unfinished.',
        capabilities: ['languages-sql-javascript-typescript-plain', 'local-language-features'],
      },
      {
        title: 'incomplete.ts',
        languageId: 'typescript',
        demonstrates: ['source-incomplete', 'source-invalid', 'adapter-typescript'],
        text: 'export function unfinished(value: string {\n  return value.\n',
      },
    ),
    scenario(
      {
        id: 'line-ending-variants',
        title: 'LF, CRLF, and CR line endings',
        description: 'Inspect mixed source line endings without normalizing the in-memory fixture.',
        capabilities: ['editing-lifecycle', 'hostile-and-unicode-text'],
      },
      {
        title: 'line-endings.txt',
        languageId: 'plain',
        demonstrates: ['line-ending-lf', 'line-ending-crlf', 'line-ending-cr', 'adapter-plain'],
        text: 'lf\ncrlf\r\ncr\rend',
      },
    ),
    ...qaScenarios,
    scenario(
      {
        id: 'language-intelligence',
        title: 'Deterministic language intelligence',
        description: 'Exercise simulated completion, diagnostics, navigation, formatting, cancellation, and recovery.',
        capabilities: ['lsp-intelligence', 'host-authorization'],
      },
      intelligenceFixture,
    ),
    scenario(
      {
        id: 'shared-session-editors',
        title: 'Two isolated editors, one session',
        description:
          'Inspect two document-scoped editors sharing protocol transport without tabs or an editor manager.',
        capabilities: ['lsp-intelligence', 'host-authorization', 'editor-and-window'],
      },
      {
        title: 'shared-first.ts',
        languageId: 'typescript',
        demonstrates: ['adapter-typescript'],
        text: 'const firstDocument = true;\n',
      },
    ),
    scenario(
      {
        id: 'safe-terminal-text',
        title: 'Unicode and hostile terminal text',
        description: 'Render tabs, combining marks, wide glyphs, bidi controls, and escape bytes safely.',
        capabilities: ['hostile-and-unicode-text', 'accessibility-and-resize'],
      },
      {
        title: 'hostile.txt',
        languageId: 'plain',
        demonstrates: ['unicode-invisible', 'unicode-hostile', 'adapter-plain'],
        text: 'tab\tcolumn\ncombining: e\u0301\nwide: 界🙂\nzero-width: \u200B\nbidi: \u202Etxt\u202C\ncontrol: \u001B[31mnot-red\u0007\n',
      },
    ),
    scenario(
      {
        id: 'themes-and-fallbacks',
        title: 'Hybrid themes and terminal fallbacks',
        description: 'Compare independent palettes, monochrome indicators, ASCII glyphs, and a narrow viewport.',
        capabilities: ['themes-and-capabilities', 'accessibility-and-resize'],
      },
      {
        title: 'theme.js',
        languageId: 'javascript',
        demonstrates: ['theme-live-change', 'adapter-javascript'],
        text: 'export function visibleState(value) {\n  return value ?? "fallback";\n}\n',
      },
      true,
      'light',
    ),
    scenario(
      {
        id: 'full-document-tier',
        title: 'Full-feature document tier',
        description: 'Inspect the complete feature set on a bounded source document.',
        capabilities: ['full-document-tier'],
      },
      {
        title: 'full.ts',
        languageId: 'typescript',
        demonstrates: ['document-full-tier', 'adapter-typescript'],
        text: 'const tier = "full";\n',
      },
    ),
    scenario(
      {
        id: 'large-document-tier',
        title: 'Large degradable document tier',
        description: 'Generate more than fifty thousand lines and inspect bounded feature degradation.',
        capabilities: ['large-document-tier'],
      },
      {
        title: 'generated-large.ts',
        languageId: 'typescript',
        demonstrates: ['document-large-tier', 'degradation-and-recovery', 'adapter-typescript'],
        text: generatedLargeText,
        readOnly: true,
      },
    ),
    scenario(
      {
        id: 'confirmation-document-tier',
        title: 'Confirmation-required document tier',
        description: 'Inspect the preflight classification used before opening source above ten MiB.',
        capabilities: ['confirmation-document-tier'],
      },
      {
        title: 'generated-confirmation.txt',
        languageId: 'plain',
        demonstrates: ['document-confirmation-tier', 'adapter-plain'],
        text: 'Preview intentionally stays compact; generate the confirmed payload only on explicit request.\n',
        readOnly: true,
      },
    ),
  ]);
}

/** Builds self-contained manual checks for every simulated language-service and host outcome. */
function createLanguageIntelligenceQaScenarios(
  scenario: DefineScenario,
  fixture: CodeEditorDemoFixture,
): readonly CodeEditorDemoScenario[] {
  return Object.freeze([
    qaScenario(
      scenario,
      'qa-lsp-completion',
      'QA: LSP completion',
      'Verify that an asynchronous completion response opens a keyboard-operable popup.',
      'completion',
      ['Press F5', 'Use Up/Down, then Enter or Escape'],
      'A popup shows greet without changing the document until accepted.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-hover',
      'QA: LSP hover',
      'Verify explicit keyboard hover assistance at the caret.',
      'hover',
      ['Place the caret on message', 'Press F5', 'Press Escape to close'],
      'A popup shows Simulated hover information and Escape restores focus.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-signature',
      'QA: LSP signature help',
      'Verify signature help after a trigger-character edit.',
      'signature',
      ['Press F5', 'Inspect the active parameter', 'Press Escape to close'],
      'A popup shows greet(name: string): string with name active.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-diagnostics',
      'QA: LSP diagnostics',
      'Verify published diagnostics and keyboard detail navigation.',
      'diagnostic-detail',
      ['Press F5', 'Inspect the result and diagnostic marker'],
      'The result reports diagnostic-detail and navigation remains available.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-symbols',
      'QA: document symbols',
      'Verify the document-symbol chooser returned by the simulated service.',
      'symbols',
      ['Press F5', 'Use Up/Down and Enter, or Escape'],
      'A keyboard-operable chooser shows the message symbol.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-formatting',
      'QA: LSP formatting',
      'Verify a validated formatting edit is applied as one document mutation.',
      'format',
      ['Press F5', 'Compare the first source line'],
      'The source changes to greet("formatted") and becomes modified.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-navigation',
      'QA: definition navigation',
      'Verify that a cross-document definition target remains host-authorized.',
      'navigate',
      ['Press F5', 'Inspect the host evidence line'],
      'Host evidence reports navigate; the demo never opens files automatically.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-lsp-recovery',
      'QA: cancellation and recovery',
      'Verify cancellation followed by service reconnection and resynchronization.',
      'cancel-recover',
      ['Press F5', 'Inspect the live result'],
      'The result reports request-cancelled and service-recovered.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-host-save-accepted',
      'QA: accepted save',
      'Verify the host-owned save acceptance path.',
      'host-accept',
      ['Press F5', 'Inspect the host decision'],
      'The result reports decision:accepted and the revision is saved.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-host-save-rejected',
      'QA: rejected save',
      'Verify that a rejected save preserves the modified document.',
      'host-reject',
      ['Press F5', 'Inspect the decision and modified state'],
      'The result reports decision:rejected and modified remains true.',
      fixture,
    ),
    qaScenario(
      scenario,
      'qa-host-save-conflict',
      'QA: save conflict',
      'Verify that a revision conflict never silently overwrites text.',
      'host-conflict',
      ['Press F5', 'Inspect the decision and concurrent edit'],
      'The result reports decision:version-conflict and remains modified.',
      fixture,
    ),
  ]);
}

/** Creates one QA scenario with a single F5 action and a concrete visible expectation. */
function qaScenario(
  scenario: DefineScenario,
  id: string,
  title: string,
  purpose: string,
  action: CodeEditorDemoAction,
  steps: readonly string[],
  expected: string,
  fixture: CodeEditorDemoFixture,
): CodeEditorDemoScenario {
  return scenario(
    {
      id,
      title,
      description: purpose,
      capabilities: ['lsp-intelligence', 'host-authorization'],
      qa: Object.freeze({
        purpose,
        action,
        steps: Object.freeze([...steps]),
        expected,
      }),
    },
    fixture,
  );
}
