import type { CodeEditorLanguageId } from '@jsvision/code-editor';

/** Non-pilot Code Editor lessons that use the shared responsive teaching shell. */
export type CodeEditorLessonScenario =
  | 'quick-start'
  | 'document-controller'
  | 'external-changes'
  | 'editing-navigation'
  | 'readonly-clipboard'
  | 'language-gallery'
  | 'syntax-fallback'
  | 'invisibles-line-endings'
  | 'structural-folding'
  | 'search'
  | 'replace'
  | 'lsp-navigation'
  | 'viewport-mouse'
  | 'large-document-tiers'
  | 'themes'
  | 'theme-fallback'
  | 'safe-terminal-text'
  | 'host-recovery';

/** Complete reader-facing content and initial document state for one focused lesson. */
export interface CodeEditorLesson {
  /** Stable capability scenario used by the shared action controller. */
  readonly scenario: CodeEditorLessonScenario;
  /** Substantial bounded source displayed when the lesson opens and after reset. */
  readonly source: string;
  /** Built-in language adapter selected for the initial source. */
  readonly languageId: CodeEditorLanguageId;
  /** Whether editing commands are intentionally disabled. */
  readonly readOnly: boolean;
  /** Capability-specific action label with one keyboard accelerator. */
  readonly actionLabel: string;
  /** Heading that identifies the capability in the teaching rail. */
  readonly panelTitle: string;
  /** Concrete native editor evidence the reader should inspect after acting. */
  readonly lookFor: string;
}

const QUICK_START_SOURCE = `interface WorkspaceFile {
  readonly name: string;
  readonly language: 'typescript' | 'javascript';
  readonly dirty: boolean;
}

const activeFile: WorkspaceFile = {
  name: 'dashboard.ts',
  language: 'typescript',
  dirty: false,
};

function describeFile(file: WorkspaceFile): string {
  const marker = file.dirty ? '●' : '○';
  return \`\${marker} \${file.name} · \${file.language}\`;
}

console.log(describeFile(activeFile));
`;

const DOCUMENT_CONTROLLER_SOURCE = `interface Draft {
  readonly id: string;
  title: string;
  body: string;
  revision: number;
}

const releaseNotes: Draft = {
  id: 'draft-2048',
  title: 'Release notes',
  body: 'Describe the new editor lessons.',
  revision: 0,
};

function saveDraft(draft: Draft): Draft {
  return {
    ...draft,
    revision: draft.revision + 1,
  };
}

console.log(saveDraft(releaseNotes));
`;

const EXTERNAL_CHANGES_SOURCE = `interface Settings {
  readonly theme: 'classic' | 'dark' | 'light';
  readonly autosave: boolean;
  readonly tabSize: number;
}

const localSettings: Settings = {
  theme: 'classic',
  autosave: true,
  tabSize: 2,
};

function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings, null, settings.tabSize);
}

const snapshot = serializeSettings(localSettings);
console.log('Local snapshot', snapshot);
`;

const EDITING_NAVIGATION_SOURCE = `interface Command {
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
}

const commands: readonly Command[] = [
  { id: 'file.open', label: 'Open file', shortcut: 'Ctrl+O' },
  { id: 'file.save', label: 'Save file', shortcut: 'Ctrl+S' },
  { id: 'view.palette', label: 'Command palette', shortcut: 'F1' },
];

function commandLabels(items: readonly Command[]): string[] {
  return items.map((command) => command.label);
}

for (const label of commandLabels(commands)) {
  console.log(label);
}
`;

const READONLY_CLIPBOARD_SOURCE = `-- Read-only production report
WITH active_accounts AS (
  SELECT
    account_id,
    display_name,
    plan_name,
    last_seen_at
  FROM account_summary
  WHERE suspended_at IS NULL
)
SELECT
  plan_name,
  COUNT(*) AS account_count,
  MAX(last_seen_at) AS latest_activity
FROM active_accounts
GROUP BY plan_name
ORDER BY account_count DESC;
`;

const LANGUAGE_GALLERY_SOURCE = `Language gallery

Run the lesson repeatedly to compare four adapters:
1. Plain text
2. JavaScript
3. TypeScript
4. PostgreSQL

Each document is long enough to reveal:
- comments and keywords
- strings and numbers
- punctuation and operators
- functions and properties

The source changes with the selected language.
`;

const SYNTAX_FALLBACK_SOURCE = `interface ParseResult {
  readonly ok: boolean;
  readonly warnings: readonly string[];
}

const incompleteResult: ParseResult = {
  ok: false,
  warnings: [
    'The adapter will fail intentionally',
    'The document must remain editable',
  ],
};

function summarize(result: ParseResult): string {
  return result.warnings
    .map((warning, index) => \`\${index + 1}. \${warning}\`)
    .join('\\n');
}

const preview = summarize(incompleteResult);
console.log(preview);

// Imagine the user has paused here while completing a member expression.
const unfinishedPreview = incompleteResult.
`;

const INVISIBLES_SOURCE =
  'interface LineSample {\r\n' +
  '\treadonly label: string;\r\n' +
  '\treadonly value: string;\r\n' +
  '}\r\n' +
  '\r\n' +
  'const samples: LineSample[] = [\r\n' +
  '\t{ label: "tab", value: "\\t" },\r\n' +
  '\t{ label: "space", value: " " },  \r\n' +
  '\t{ label: "indent", value: "  " },\r\n' +
  '];\r\n' +
  '\r\n' +
  'for (const sample of samples) {\r\n' +
  '\tconsole.log(sample.label, sample.value);\r\n' +
  '}\r\n';

const STRUCTURAL_FOLDING_SOURCE = `interface NavigationGroup {
  readonly title: string;
  readonly entries: readonly string[];
}

const componentTopics: NavigationGroup[] = [
  {
    title: 'Foundations',
    entries: ['View', 'Group', 'Window'],
  },
  {
    title: 'Editing',
    entries: ['Input', 'TextArea', 'CodeEditor'],
  },
];

function printNavigation(groups: readonly NavigationGroup[]): void {
  for (const group of groups) {
    console.log(group.title);
    for (const entry of group.entries) {
      console.log(\`  - \${entry}\`);
    }
  }
}

printNavigation(componentTopics);
`;

const SEARCH_SOURCE = `interface SearchDocument {
  readonly path: string;
  readonly message: string;
  readonly tags: readonly string[];
}

const documents: SearchDocument[] = [
  {
    path: 'src/welcome.ts',
    message: 'Welcome to the editor',
    tags: ['docs', 'message'],
  },
  {
    path: 'src/status.ts',
    message: 'Build completed',
    tags: ['status', 'message'],
  },
];

const matching = documents.filter((document) =>
  document.message.toLowerCase().includes('message'),
);

console.log(matching);
`;

const REPLACE_SOURCE = `interface Migration {
  readonly file: string;
  readonly before: string;
  readonly after: string;
}

const migration: Migration = {
  file: 'src/config.ts',
  before: 'first',
  after: 'updated',
};

function previewMigration(change: Migration): string {
  return [
    \`File: \${change.file}\`,
    \`Before: \${change.before}\`,
    \`After: \${change.after}\`,
  ].join('\\n');
}

console.log(previewMigration(migration));
`;

const LSP_NAVIGATION_SOURCE = `export interface Customer {
  readonly id: string;
  readonly displayName: string;
  readonly region: 'eu' | 'us' | 'apac';
}

export const featuredCustomer: Customer = {
  id: 'customer-42',
  displayName: 'Northwind Traders',
  region: 'eu',
};

export function formatCustomer(customer: Customer): string {
  return \`\${customer.displayName} [\${customer.region}]\`;
}

function printFeaturedCustomer(): void {
  const summary = formatCustomer(featuredCustomer);
  console.log(summary);
}

printFeaturedCustomer();
`;

const VIEWPORT_MOUSE_SOURCE = `interface TimelineEvent {
  readonly at: string;
  readonly category: 'build' | 'test' | 'deploy';
  readonly message: string;
}

const timeline: TimelineEvent[] = [
  { at: '09:00', category: 'build', message: 'Bundle created' },
  { at: '09:02', category: 'test', message: 'Unit suite passed' },
  { at: '09:05', category: 'deploy', message: 'Preview published' },
  { at: '09:12', category: 'test', message: 'Smoke check passed' },
];

function renderTimeline(events: readonly TimelineEvent[]): string {
  return events
    .map((event) => \`\${event.at} · \${event.category} · \${event.message}\`)
    .join('\\n');
}

console.log(renderTimeline(timeline));
`;

const LARGE_DOCUMENT_SOURCE = Array.from(
  { length: 40 },
  (_, index) => `export const metric${index + 1} = { id: ${index + 1}, label: 'Metric ${index + 1}' };`,
).join('\n');

const THEMES_SOURCE = `interface PalettePreview {
  readonly name: string;
  readonly background: string;
  readonly foreground: string;
  readonly accent: string;
}

const palettes: PalettePreview[] = [
  {
    name: 'Classic',
    background: 'blue',
    foreground: 'white',
    accent: 'yellow',
  },
  {
    name: 'Dark',
    background: 'black',
    foreground: 'gray',
    accent: 'cyan',
  },
];

console.table(palettes);
`;

const THEME_FALLBACK_SOURCE = `interface ThemeOverride {
  readonly role: string;
  readonly foreground?: string;
  readonly background?: string;
}

const requestedOverrides: ThemeOverride[] = [
  { role: 'editor', background: 'invalid' },
  { role: 'selection', foreground: '#ffffff' },
  { role: 'lineNumber', foreground: '#808080' },
];

function validOverrides(items: readonly ThemeOverride[]): ThemeOverride[] {
  return items.filter((item) => item.background !== 'invalid');
}

const resolved = validOverrides(requestedOverrides);
console.log('Resolved overrides', resolved);
`;

const SAFE_TERMINAL_SOURCE = `interface ProtocolNotice {
  readonly source: 'language-server' | 'extension';
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
}

const notice: ProtocolNotice = {
  source: 'language-server',
  severity: 'error',
  message: 'Untrusted protocol text is inert',
};

function displayNotice(value: ProtocolNotice): string {
  return [
    value.severity.toUpperCase(),
    value.source,
    value.message,
  ].join(' · ');
}

console.log(displayNotice(notice));
`;

const HOST_RECOVERY_SOURCE = `interface RecoveryStep {
  readonly order: number;
  readonly label: string;
  readonly state: 'pending' | 'complete';
}

const recoveryPlan: RecoveryStep[] = [
  { order: 1, label: 'Dispose failed work', state: 'complete' },
  { order: 2, label: 'Reconnect service', state: 'pending' },
  { order: 3, label: 'Resynchronize document', state: 'pending' },
  { order: 4, label: 'Authorize host effect', state: 'pending' },
];

function nextStep(steps: readonly RecoveryStep[]): RecoveryStep | undefined {
  return steps.find((step) => step.state === 'pending');
}

console.log('Next recovery step', nextStep(recoveryPlan));
`;

/** Immutable lesson registry kept outside the runnable example tree. */
const LESSONS: Readonly<Record<CodeEditorLessonScenario, CodeEditorLesson>> = Object.freeze({
  'quick-start': {
    scenario: 'quick-start',
    source: QUICK_START_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: 'Show ~w~indow chrome',
    panelTitle: 'COMPOSITION',
    lookFor: 'The same source and controller gaining a title, scrollbars, and status chrome.',
  },
  'document-controller': {
    scenario: 'document-controller',
    source: DOCUMENT_CONTROLLER_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~A~pply document edit',
    panelTitle: 'DOCUMENT OWNERSHIP',
    lookFor: 'A new comment in the editor and one exact revision advance.',
  },
  'external-changes': {
    scenario: 'external-changes',
    source: EXTERNAL_CHANGES_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~R~eload external change',
    panelTitle: 'EXTERNAL CHANGE',
    lookFor: 'A visible host-owned prefix and a preserved line-ending outcome.',
  },
  'editing-navigation': {
    scenario: 'editing-navigation',
    source: EDITING_NAVIGATION_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~E~dit & select',
    panelTitle: 'EDITING & NAVIGATION',
    lookFor: 'Inserted source, an advanced revision, and a non-empty selection.',
  },
  'readonly-clipboard': {
    scenario: 'readonly-clipboard',
    source: READONLY_CLIPBOARD_SOURCE,
    languageId: 'postgresql',
    readOnly: true,
    actionLabel: 'C~o~py selection',
    panelTitle: 'READ-ONLY CLIPBOARD',
    lookFor: 'A selected SQL keyword, successful copy evidence, and revision zero.',
  },
  'language-gallery': {
    scenario: 'language-gallery',
    source: LANGUAGE_GALLERY_SOURCE,
    languageId: 'plain',
    readOnly: false,
    actionLabel: '~N~ext language',
    panelTitle: 'LANGUAGE GALLERY',
    lookFor: 'The document and real syntax colors changing with each adapter.',
  },
  'syntax-fallback': {
    scenario: 'syntax-fallback',
    source: SYNTAX_FALLBACK_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~T~rigger fallback',
    panelTitle: 'GRACEFUL FALLBACK',
    lookFor: 'The language becoming plain while the complete source remains visible.',
  },
  'invisibles-line-endings': {
    scenario: 'invisibles-line-endings',
    source: INVISIBLES_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~R~eveal invisibles',
    panelTitle: 'INVISIBLE CHARACTERS',
    lookFor: 'A selected tab location plus an exact bounded warning count.',
  },
  'structural-folding': {
    scenario: 'structural-folding',
    source: STRUCTURAL_FOLDING_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~F~old structure',
    panelTitle: 'STRUCTURAL FOLDING',
    lookFor: 'Collapsed gutter markers and fewer visible document rows.',
  },
  search: {
    scenario: 'search',
    source: SEARCH_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~F~ind message',
    panelTitle: 'SEARCH',
    lookFor: 'Native search presentation and the matching source selection.',
  },
  replace: {
    scenario: 'replace',
    source: REPLACE_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~R~eplace message',
    panelTitle: 'REPLACE',
    lookFor: '“first” becoming “updated” and the revision advancing once.',
  },
  'lsp-navigation': {
    scenario: 'lsp-navigation',
    source: LSP_NAVIGATION_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~N~avigate to symbol',
    panelTitle: 'LSP NAVIGATION',
    lookFor: 'A validated definition target selected inside the current document.',
  },
  'viewport-mouse': {
    scenario: 'viewport-mouse',
    source: VIEWPORT_MOUSE_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~S~elect with mouse',
    panelTitle: 'VIEWPORT & MOUSE',
    lookFor: 'A wider native viewport, visible line numbers, and selected source.',
  },
  'large-document-tiers': {
    scenario: 'large-document-tiers',
    source: LARGE_DOCUMENT_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: 'C~l~assify large document',
    panelTitle: 'DOCUMENT TIERS',
    lookFor: 'A bounded larger document and an explicit large-mode result.',
  },
  themes: {
    scenario: 'themes',
    source: THEMES_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~N~ext editor theme',
    panelTitle: 'EDITOR THEMES',
    lookFor: 'Syntax colors and editor surfaces changing together.',
  },
  'theme-fallback': {
    scenario: 'theme-fallback',
    source: THEME_FALLBACK_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~R~esolve fallback',
    panelTitle: 'THEME FALLBACK',
    lookFor: 'Readable editor colors plus a rejected-override report.',
  },
  'safe-terminal-text': {
    scenario: 'safe-terminal-text',
    source: SAFE_TERMINAL_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~S~how safe diagnostic',
    panelTitle: 'TERMINAL-SAFE TEXT',
    lookFor: 'A native diagnostic marker and inert, bounded explanation.',
  },
  'host-recovery': {
    scenario: 'host-recovery',
    source: HOST_RECOVERY_SOURCE,
    languageId: 'typescript',
    readOnly: false,
    actionLabel: '~R~ecover service',
    panelTitle: 'HOST RECOVERY',
    lookFor: 'Ready service state, authorized navigation, and recovered host callback.',
  },
});

/** Return the immutable presentation definition for one non-pilot lesson. */
export function codeEditorLesson(scenario: CodeEditorLessonScenario): CodeEditorLesson {
  return LESSONS[scenario];
}

/** Return the language-specific gallery source displayed after one visible cycle. */
export function languageGallerySource(languageId: CodeEditorLanguageId): string {
  if (languageId === 'javascript') {
    return `const projects = [
  { name: 'Docs', healthy: true, checks: 18 },
  { name: 'Runtime', healthy: true, checks: 42 },
];

function summarizeProject(project) {
  const state = project.healthy ? 'ready' : 'attention';
  return \`\${project.name}: \${state} (\${project.checks})\`;
}

for (const project of projects) {
  console.log(summarizeProject(project));
}
`;
  }
  if (languageId === 'typescript') {
    return `interface ProjectHealth {
  readonly name: string;
  readonly healthy: boolean;
  readonly checks: number;
}

const projects: ProjectHealth[] = [
  { name: 'Docs', healthy: true, checks: 18 },
  { name: 'Runtime', healthy: true, checks: 42 },
];

function summarizeProject(project: ProjectHealth): string {
  return \`\${project.name}: \${project.checks} checks\`;
}

console.log(projects.map(summarizeProject));
`;
  }
  if (languageId === 'postgresql') {
    return `WITH project_health AS (
  SELECT
    project_name,
    healthy,
    completed_checks
  FROM documentation_projects
  WHERE archived_at IS NULL
)
SELECT
  project_name,
  completed_checks,
  CASE
    WHEN healthy THEN 'ready'
    ELSE 'attention'
  END AS state
FROM project_health
ORDER BY completed_checks DESC;
`;
  }
  return LANGUAGE_GALLERY_SOURCE;
}
