/**
 * Immutable oracle for the Build a complete application capstone and its two laboratories.
 *
 * The capstone composes prerequisite skills into one workflow and one release rehearsal. It must
 * prove integration without presenting a browser terminal as production, filesystem, or network
 * evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sanitize } from '@jsvision/core';
import { createForm } from '@jsvision/forms';
import { Button, Input, View, signal } from '@jsvision/ui';
import { z } from 'zod';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { assessProductionReadiness } from '../src/example-fixtures/in-production/production-readiness.js';
import type { ProductionEvidence } from '../src/example-fixtures/in-production/production-readiness.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/complete-application.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const workflowFixturePath = fileURLToPath(
  new URL('../src/example-fixtures/complete-application/workflow-model.ts', import.meta.url),
);
const releaseFixturePath = fileURLToPath(
  new URL('../src/example-fixtures/complete-application/release-rehearsal.ts', import.meta.url),
);
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const workflowFixtureSource = existsSync(workflowFixturePath) ? readFileSync(workflowFixturePath, 'utf8') : '';
const releaseFixtureSource = existsSync(releaseFixturePath) ? readFileSync(releaseFixturePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'complete-application');
const workflowLabId = 'guides/capstone-workflow';
const releaseLabId = 'guides/capstone-release-rehearsal';
const labIds = [workflowLabId, releaseLabId] as const;

interface CapstoneWorkflowPanel extends View {
  readonly lessonName: 'Complete application workflow';
  readonly routeName: 'records' | 'editor';
  readonly phase: 'idle' | 'loading' | 'editing' | 'saving' | 'saved' | 'error' | 'cancelled';
  readonly persistenceWrites: number;
  readonly authorizedSeamCalls: number;
  readonly validationFailures: number;
  readonly cancellations: number;
  readonly staleResultsSuppressed: number;
  readonly recoveries: number;
  readonly pendingWork: number;
  readonly feedback: string;
  readonly cleanupCount: number;
  readonly nameInput: Input;
  readonly recordButton: Button;
}

interface ReleaseRehearsalPanel extends View {
  readonly lessonName: 'Release rehearsal';
  readonly scenarioName: 'Ready' | 'Non-TTY' | 'Crash loop' | 'Unsafe diagnostic' | 'Stale evidence';
  readonly decision: 'ship' | 'no-go';
  readonly scenarioChanges: number;
  readonly releaseChecks: number;
  readonly restorationChecks: number;
  readonly diagnosticLeaks: number;
  readonly diagnosticRecords: number;
  readonly blockingConcern:
    | 'package'
    | 'runtime'
    | 'tty'
    | 'restore'
    | 'diagnostics'
    | 'security'
    | 'compatibility'
    | 'performance'
    | 'support'
    | 'none';
  readonly blockingReason: string;
  readonly supervisorAction: 'stopped-clean' | 'stopped-manual' | 'breaker-open' | 'restart';
  readonly diagnosticSnapshot: string;
  readonly recoveries: number;
  readonly evidenceFresh: boolean;
  readonly feedback: string;
  readonly cleanupCount: number;
}

interface PersistedRecord {
  readonly id: number;
  readonly name: string;
}

interface RecordStore {
  save(record: PersistedRecord, abort: AbortSignal): Promise<{ ok: true } | { ok: false; code: 'denied' }>;
}

class WorkflowCoordinator {
  readonly phase = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly savedName = signal<string | null>(null);
  private generation = 0;
  private controller: AbortController | null = null;
  private disposed = false;

  constructor(private readonly store: RecordStore) {}

  async save(rawName: string): Promise<void> {
    const generation = ++this.generation;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.phase.set('saving');
    const record = { id: 1, name: rawName.trim() };
    const result = await this.store.save(record, controller.signal);
    if (this.disposed || controller.signal.aborted || generation !== this.generation) return;
    if (result.ok) {
      this.savedName.set(record.name);
      this.phase.set('saved');
    } else {
      this.phase.set('error');
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.controller?.abort();
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) throw new Error(`missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

function workflowPanelIn(dialog: View): CapstoneWorkflowPanel {
  const panel = viewsIn(dialog).find(
    (view): view is CapstoneWorkflowPanel =>
      'lessonName' in view && view.lessonName === 'Complete application workflow',
  );
  if (panel === undefined) throw new Error('the capstone workflow is missing its teaching panel');
  return panel;
}

function releasePanelIn(dialog: View): ReleaseRehearsalPanel {
  const panel = viewsIn(dialog).find(
    (view): view is ReleaseRehearsalPanel => 'lessonName' in view && view.lessonName === 'Release rehearsal',
  );
  if (panel === undefined) throw new Error('the release rehearsal is missing its teaching panel');
  return panel;
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`the capstone laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + Math.floor(button.bounds.width / 2), y: origin.y },
  });
}

function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const from = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: from,
    to: { x: from.x + 8, y: from.y + 3 },
  });
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

describe('Build a complete application course contract', () => {
  test('should publish the exact completed capstone catalog contract and two distinct labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Build a complete application',
      group: 'Operating a real app',
      page: '/guide/complete-application',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 7,
      prerequisites: [
        'application-architecture',
        'forms',
        'screens-and-routing',
        'testing-headlessly',
        'in-production',
      ],
      learningOutcomes: [
        'Build a cohesive application from project setup through state, navigation, async work, persistence, and tests.',
        'Apply accessibility, security, failure recovery, packaging, and production verification as one release workflow.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    for (const prerequisite of [
      'application-architecture',
      'forms',
      'screens-and-routing',
      'testing-headlessly',
      'in-production',
    ]) {
      expect(source).toContain(`](/guide/${prerequisite})`);
    }
    for (const id of labIds) {
      expect(source).toContain(`<PlayExample id="${id}"`);
      expect(EXAMPLES.filter((candidate) => candidate.id === id)).toHaveLength(1);
    }
  });

  test('should state the learner contract and follow a complete question-led capstone backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the complete-application mental model?',
      '## How do I build the first vertical slice?',
      '## Laboratory: complete application workflow',
      '## How should I structure the project?',
      '## How do state, actions, and forms become one workflow?',
      '## How do navigation and focus preserve task continuity?',
      '## How do I cancel async work and ignore stale results?',
      '## How does persistence cross an authorized seam?',
      '## How do I test the complete workflow?',
      '## Laboratory: release rehearsal',
      '## How do accessibility and security stay inside the workflow?',
      '## How does the application recover and produce safe diagnostics?',
      '## How do I package and verify one release?',
      '## What belongs in advanced application evolution?',
      '## How do I diagnose complete-application failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:complete|cohesive).+(?:state|navigation).+(?:test|release)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach one vertical slice and explicit ownership instead of a kitchen-sink architecture', () => {
    expect(source).toMatch(
      /(?:project|application) boundary[\s\S]{0,350}(?:domain|service)[\s\S]{0,350}(?:state|action)[\s\S]{0,350}(?:screen|view)/iu,
    );
    expect(source).toMatch(/(?:record|task|settings)[\s\S]{0,350}(?:list|editor)[\s\S]{0,350}(?:save|persist)/iu);
    expect(source).toMatch(
      /(?:one vertical slice|smallest complete|walking skeleton)[\s\S]{0,350}(?:build|test|ship)/iu,
    );
    expect(source).toMatch(
      /(?:application owner|long-lived)[\s\S]{0,350}(?:screen owner|route)[\s\S]{0,350}(?:cleanup|dispose)/iu,
    );
    expect(source).toMatch(
      /(?:compose|integrate)[\s\S]{0,300}(?:prerequisite|earlier course)[\s\S]{0,300}(?:not|without)[\s\S]{0,220}(?:repeat|duplicate|reteach)/iu,
    );
  });

  test('should start from reproducible project setup and supported public package boundaries', () => {
    expect(source).toMatch(/(?:Node|node)[\s\S]{0,150}(?:22\+|>=?\s*22)[\s\S]{0,250}(?:ESM|type.*module)/iu);
    expect(source).toMatch(/(?:src\/|feature)[\s\S]{0,400}(?:domain|services|state|screens|main)/iu);
    expect(source).toMatch(
      /(?:@jsvision\/core|@jsvision\/ui|@jsvision\/forms)[\s\S]{0,450}(?:same version|lockstep|public entry)/iu,
    );
    expect(source).toMatch(/(?:build|typecheck|test)[\s\S]{0,350}(?:dist|artifact|package)/iu);
    expect(source).toMatch(
      /(?:configuration|environment)[\s\S]{0,300}(?:validate|schema|boundary)[\s\S]{0,250}(?:before|startup)/iu,
    );
  });

  test('should integrate reactive state, validated form input, commands, navigation, and focus', () => {
    expect(source).toMatch(/(?:signal|computed)[\s\S]{0,350}(?:source state|derived|phase)/iu);
    expect(source).toMatch(/createForm\([\s\S]{0,350}(?:raw|editing)[\s\S]{0,300}(?:typed|values\(\)|schema)/iu);
    expect(source).toMatch(
      /(?:command|action)[\s\S]{0,350}(?:single|same)[\s\S]{0,250}(?:menu|button|hotkey|status)/iu,
    );
    expect(source).toMatch(/createRouter|router\.(?:push|back|replace)/u);
    expect(source).toMatch(
      /(?:focus|focused)[\s\S]{0,350}(?:stable key|restore|return)[\s\S]{0,250}(?:editor|list|route)/iu,
    );
    expect(source).toMatch(
      /(?:validation|invalid)[\s\S]{0,300}(?:visible|focus|error)[\s\S]{0,250}(?:save|persistence)/iu,
    );
  });

  test('should coordinate cancellation, stale suppression, explicit phases, and recoverable failure', () => {
    expect(source).toMatch(/AbortController[\s\S]{0,350}(?:cancel|abort)[\s\S]{0,300}(?:cleanup|navigation|dispose)/iu);
    expect(source).toMatch(
      /(?:generation|request identity)[\s\S]{0,350}(?:stale|latest)[\s\S]{0,250}(?:ignore|suppress|discard)/iu,
    );
    expect(source).toMatch(/(?:idle|loading)[\s\S]{0,350}(?:ready|saving)[\s\S]{0,350}(?:error|cancelled)/iu);
    expect(source).toMatch(/(?:retry|recover)[\s\S]{0,350}(?:preserve|retain)[\s\S]{0,250}(?:input|route|state)/iu);
    expect(source).toMatch(/(?:acquire|start|subscribe)[\s\S]{0,350}(?:dispose|abort|unsubscribe|release)/iu);
    expect(source).toMatch(
      /(?:late|stale)[\s\S]{0,300}(?:must not|never)[\s\S]{0,220}(?:navigate|overwrite|announce|persist)/iu,
    );
  });

  test('should cross persistence only through an authorized bounded injected seam', () => {
    expect(source).toMatch(/interface (?:RecordStore|Repository|Persistence)[\s\S]{0,400}(?:load|save)/u);
    expect(source).toMatch(/(?:inject|adapter|port)[\s\S]{0,350}(?:filesystem|database|network|host)/iu);
    expect(source).toMatch(
      /(?:authorize|permission|capability)[\s\S]{0,350}(?:before|at)[\s\S]{0,250}(?:read|write|save)/iu,
    );
    expect(source).toMatch(
      /(?:validate|schema)[\s\S]{0,350}(?:untrusted|loaded|persisted)[\s\S]{0,250}(?:data|record)/iu,
    );
    expect(source).toMatch(/(?:bound|limit|maximum)[\s\S]{0,350}(?:records|bytes|text|result)/iu);
    expect(source).toMatch(
      /(?:browser lab|laboratory)[\s\S]{0,300}(?:memory|virtual|injected)[\s\S]{0,300}(?:not|never)[\s\S]{0,250}(?:visitor|real file|network)/iu,
    );
  });

  test('should verify behavior through rendered evidence and deterministic seams', () => {
    expect(source).toMatch(/(?:headless|renderRoot\.buffer\(\))[\s\S]{0,400}(?:cell|frame|text|geometry)/iu);
    expect(source).toMatch(/(?:fake|fixture|in-memory)[\s\S]{0,350}(?:clock|repository|service|scheduler)/iu);
    expect(source).toMatch(/(?:same|one)[\s\S]{0,250}(?:command|action)[\s\S]{0,250}(?:keyboard|mouse)/iu);
    expect(source).toMatch(/(?:test|assert)[\s\S]{0,350}(?:loading|error|cancel|retry|saved)/iu);
    expect(source).toMatch(/(?:dispose|cleanup)[\s\S]{0,350}(?:exactly once|count|pending|listener)/iu);
    expect(source).toMatch(/(?:80.?×.?24|80x24)[\s\S]{0,300}(?:reduced|narrow|68.?×.?20|68x20)/iu);
    expect(source).toMatch(
      /(?:snapshot|self-authored flag)[\s\S]{0,300}(?:not enough|insufficient|avoid)[\s\S]{0,220}(?:cell|observable|render)/iu,
    );
  });

  test('should make accessibility and security part of each user and data boundary', () => {
    expect(source).toMatch(
      /(?:keyboard|Alt-hotkey)[\s\S]{0,350}(?:every|required|primary)[\s\S]{0,220}(?:action|workflow)/iu,
    );
    expect(source).toMatch(/(?:visible focus|focus indicator)[\s\S]{0,300}(?:validation|route|modal|retry)/iu);
    expect(source).toMatch(/(?:non-color|not color|text label)[\s\S]{0,300}(?:loading|error|saved|decision)/iu);
    expect(source).toMatch(/(?:monochrome|ASCII|reduced geometry)[\s\S]{0,400}(?:usable|reachable|fallback)/iu);
    expect(source).toMatch(
      /sanitize\([\s\S]{0,350}(?:display|untrusted)[\s\S]{0,250}(?:not|different)[\s\S]{0,200}redact/iu,
    );
    expect(source).toMatch(
      /(?:redactEvent|redact)[\s\S]{0,300}(?:diagnostic|log)[\s\S]{0,250}(?:never|omit)[\s\S]{0,180}(?:payload|secret|text)/iu,
    );
  });

  test('should rehearse release decisions without claiming browser production evidence', () => {
    expect(source).toMatch(
      /(?:release rehearsal|ship\/no-go)[\s\S]{0,400}(?:artifact|runtime|TTY|restore|diagnostic|security)/iu,
    );
    expect(source).toMatch(
      /(?:browser|embedded terminal)[\s\S]{0,400}(?:cannot|does not)[\s\S]{0,300}(?:prove|verify)[\s\S]{0,250}(?:supervision|real TTY|deployment|signal)/iu,
    );
    expect(source).toMatch(
      /(?:scenario|fixture)[\s\S]{0,400}(?:non-TTY|crash loop|unsafe diagnostic|stale evidence)/iu,
    );
    expect(source).toMatch(
      /(?:fresh|current)[\s\S]{0,300}(?:release identifier|artifact|evidence)[\s\S]{0,250}(?:ship|go)/iu,
    );
    expect(source).toMatch(
      /(?:missing|failed|stale)[\s\S]{0,300}(?:evidence|check)[\s\S]{0,250}(?:no-go|block|do not ship)/iu,
    );
    expect(source).toMatch(
      /(?:real|native|production)[\s\S]{0,300}(?:test|matrix|artifact)[\s\S]{0,250}(?:before|outside|CI)/iu,
    );
  });

  test('should connect packaging, restoration, diagnostics, and current release verification', () => {
    expect(source).toMatch(
      /(?:frozen lockfile|immutable install)[\s\S]{0,300}(?:build|artifact)[\s\S]{0,250}(?:digest|checksum|commit)/iu,
    );
    expect(source).toMatch(
      /(?:await app\.run\(\)|Application\.run\(\))[\s\S]{0,350}(?:restore|raw mode|alternate screen|cursor)/iu,
    );
    expect(source).toMatch(/createLogger\([\s\S]{0,350}(?:ring|file)[\s\S]{0,250}(?:bound|size|capacity)/iu);
    expect(source).toMatch(/(?:capability|dumpCaps)[\s\S]{0,350}(?:profile|reason|support|incident)/iu);
    expect(source).toMatch(
      /(?:release-readiness|production-readiness)[\s\S]{0,350}(?:pass|fail|warn)[\s\S]{0,250}(?:ship|no-go)/iu,
    );
    expect(source).toMatch(/(?:evidence age|freshness|maxAge|stale)[\s\S]{0,300}(?:clock|timestamp|rerun)/iu);
  });

  test('should bind both labs to deterministic fixture modules with no ambient privileged I/O', () => {
    expect(source).toContain('src/example-fixtures/complete-application/workflow-model.ts');
    expect(source).toContain('src/example-fixtures/complete-application/release-rehearsal.ts');

    expect(workflowFixtureSource).not.toBe('');
    expect(workflowFixtureSource).toMatch(/export (?:function|class|interface|type)/u);
    expect(workflowFixtureSource).toMatch(
      /(?:repository|persistence|store)[\s\S]{0,350}(?:inject|authorized|permission)/iu,
    );
    expect(workflowFixtureSource).toMatch(/AbortController|AbortSignal/u);
    expect(workflowFixtureSource).toMatch(/(?:generation|stale)[\s\S]{0,300}(?:ignore|suppress|discard)/iu);
    expect(workflowFixtureSource).toMatch(/(?:dispose|cleanup)/iu);
    expect(workflowFixtureSource).not.toMatch(/node:fs|process\.env|fetch\(|localStorage|document\.|window\./u);

    expect(releaseFixtureSource).not.toBe('');
    expect(releaseFixtureSource).toMatch(/(?:Ready|Non-TTY|Crash loop|Unsafe diagnostic|Stale evidence)/u);
    expect(releaseFixtureSource).toMatch(/(?:ship|no-go)[\s\S]{0,350}(?:fresh|stale|restore|diagnostic)/iu);
    expect(releaseFixtureSource).toMatch(/(?:bound|capacity|max)[\s\S]{0,300}(?:diagnostic|record|log)/iu);
    expect(releaseFixtureSource).not.toMatch(/node:fs|process\.env|fetch\(|Date\.now\(|document\.|window\./u);
  });

  test('should diagnose integrated failures by symptom, owner, correction, and evidence', () => {
    for (const symptom of [
      'invalid save',
      'stale completion',
      'lost focus',
      'unauthorized persistence',
      'diagnostic leak',
      'release no-go',
    ]) {
      expect(source).toMatch(new RegExp(symptom, 'iu'));
    }
    expect(source).toMatch(
      /Symptom[\s\S]{0,250}(?:Owner|Likely owner)[\s\S]{0,250}Correction[\s\S]{0,250}(?:Evidence|Distinguishing evidence)/iu,
    );
    expect(source).toMatch(/(?:invalid save)[\s\S]{0,350}(?:form|schema|values\(\)|validation)/iu);
    expect(source).toMatch(/(?:stale completion)[\s\S]{0,350}(?:generation|abort|request identity)/iu);
    expect(source).toMatch(/(?:lost focus)[\s\S]{0,350}(?:route|stable key|restore)/iu);
    expect(source).toMatch(/(?:release no-go)[\s\S]{0,350}(?:failed|missing|stale)[\s\S]{0,220}evidence/iu);
  });

  test('should finish with consequential practices, exercises, prerequisite links, and API links', () => {
    const practices = source.slice(
      source.indexOf('## What are the best practices?'),
      source.indexOf('## What should I practice next?'),
    );
    expect(practices.match(/^- /gmu)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(practices).toMatch(/(?:otherwise|because|prevents|so that|or else)/iu);
    const practice = source.slice(source.indexOf('## What should I practice next?'));
    expect(practice.match(/^\d+\. /gmu)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(practice).toContain('](/components/)');
    expect(practice).toContain('](/components/data-grid/)');
    expect(practice).toContain('](/components/code-editor/)');
    expect(practice).toContain('](/api/ui/functions/createApplication)');
    expect(practice).toContain('](/api/ui/functions/createRouter)');
    expect(practice).toContain('](/api/forms/functions/createForm)');
  });

  test('should keep capstone snippets focused, public, and separate from live modules', () => {
    const blocks = snippets();
    expect(blocks.length).toBeGreaterThanOrEqual(10);
    expect(blocks.length).toBeLessThanOrEqual(24);
    for (const block of blocks) {
      expect(block.split('\n').length, block).toBeLessThanOrEqual(32);
      for (const match of block.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/forms', '@jsvision/ui', 'zod', 'node:process']).toContain(match[1]);
      }
      expect(block).not.toMatch(/@jsvision\/(?:core|forms|ui)\/(?:src|dist|engine)\//u);
      expect(block).not.toContain('../');
      expect(block).not.toContain('demoApp(');
      expect(block).not.toContain('Template1Dialog');
    }
    for (const concept of ['createApplication', 'createForm', 'createRouter', 'AbortController', 'createLogger']) {
      expect(
        blocks.some((block) => block.includes(concept)),
        concept,
      ).toBe(true);
    }
  });
});

describe('Complete application laboratory contract', () => {
  test.each(labIds)('should register %s as a unique full Classic template1 application', async (id) => {
    const entry = registryEntry(id);
    expect(entry).toMatchObject({ id, category: 'guides', kind: 'app', themeMenu: true });
    const definition = await loadDefinition(id);
    expect(definition.title).toMatch(id === workflowLabId ? /complete.*workflow/iu : /release.*rehearsal/iu);
    expect(definition.blurb).toMatch(/(?:try|navigate|save|cancel|scenario|verify|observe)/iu);
    const { app, dialog } = buildLabExample(id, definition);
    try {
      const evidence = collectTemplate1Evidence(app, dialog);
      expect(evidence.dialogRect.width).toBeLessThan(80);
      expect(evidence.dialogRect.height).toBeLessThan(22);
      expect(frameText(app)).toMatch(/Alt\+/u);
    } finally {
      app.loop.dispose();
    }
  });

  test('should prove navigation, authorized persistence, cancellation, recovery, and visible feedback', async () => {
    const { app, dialog } = buildLabExample(workflowLabId, await loadDefinition(workflowLabId));
    const panel = workflowPanelIn(dialog);
    try {
      expect(panel.routeName).toBe('records');
      expect(panel.persistenceWrites).toBe(0);
      clickButton(app, dialog, 'Open editor');
      expect(panel.routeName).toBe('editor');
      expect(app.loop.getFocused()).toBe(panel.nameInput);
      panel.nameInput.getValueSignal().set('');
      clickButton(app, dialog, 'Save record');
      expect(panel.validationFailures).toBe(1);
      expect(panel.persistenceWrites).toBe(0);
      expect(app.loop.getFocused()).toBe(panel.nameInput);
      panel.nameInput.getValueSignal().set('Quarterly report');
      clickButton(app, dialog, 'Save record');
      await settle();
      expect(panel.persistenceWrites).toBe(1);
      expect(panel.authorizedSeamCalls).toBe(1);
      expect(panel.phase).toBe('saved');
      expect(panel.feedback).toMatch(/saved/iu);

      clickButton(app, dialog, 'Start refresh');
      expect(panel.pendingWork).toBe(1);
      clickButton(app, dialog, 'Cancel work');
      expect(panel.cancellations).toBe(1);
      expect(panel.pendingWork).toBe(0);
      expect(panel.phase).toBe('cancelled');

      clickButton(app, dialog, 'Simulate failure');
      expect(panel.phase).toBe('error');
      clickButton(app, dialog, 'Retry');
      expect(panel.recoveries).toBe(1);
      expect(frameText(app)).toMatch(/(?:saved|cancelled|recovered|retry)/iu);
      expect(panel.staleResultsSuppressed).toBeGreaterThanOrEqual(0);

      clickButton(app, dialog, 'Back');
      expect(panel.routeName).toBe('records');
      expect(panel.nameInput.getValueSignal()()).toBe('Quarterly report');
      expect(app.loop.getFocused()).toBe(panel.recordButton);
      expect(frameText(app)).toContain('RECORDS');
      expect(frameText(app)).not.toContain('EDITOR · record');
    } finally {
      app.loop.dispose();
    }
    expect(panel.cleanupCount).toBe(1);
  });

  test('should keep the workflow reachable through documented keyboard commands', async () => {
    const { app, dialog } = buildLabExample(workflowLabId, await loadDefinition(workflowLabId));
    const panel = workflowPanelIn(dialog);
    try {
      app.loop.dispatch(key('o', { alt: true }));
      expect(panel.routeName).toBe('editor');
      app.loop.dispatch(key('s', { alt: true }));
      await settle();
      expect(panel.persistenceWrites).toBe(1);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.pendingWork).toBe(1);
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.cancellations).toBe(1);
    } finally {
      app.loop.dispose();
    }
  });

  test('should compare release scenarios without leaking payloads or claiming native proof', async () => {
    const { app, dialog } = buildLabExample(releaseLabId, await loadDefinition(releaseLabId));
    const panel = releasePanelIn(dialog);
    try {
      expect(panel.scenarioName).toBe('Ready');
      expect(panel.decision).toBe('ship');
      expect(panel.evidenceFresh).toBe(true);
      expect(panel.blockingConcern).toBe('none');
      expect(panel.supervisorAction).toBe('stopped-clean');
      expect(panel.restorationChecks).toBeGreaterThan(0);
      expect(panel.diagnosticLeaks).toBe(0);
      expect(panel.diagnosticSnapshot).not.toContain('fixture-secret-payload');

      const expected = [
        { scenario: 'Non-TTY', concern: 'tty', supervisor: 'stopped-manual', fresh: true },
        { scenario: 'Crash loop', concern: 'runtime', supervisor: 'breaker-open', fresh: true },
        { scenario: 'Unsafe diagnostic', concern: 'diagnostics', supervisor: 'stopped-manual', fresh: true },
        { scenario: 'Stale evidence', concern: 'package', supervisor: 'stopped-manual', fresh: false },
      ] as const;
      for (const scenario of expected) {
        clickButton(app, dialog, 'Next scenario');
        expect(panel.scenarioName).toBe(scenario.scenario);
        expect(panel.decision).toBe('no-go');
        expect(panel.blockingConcern).toBe(scenario.concern);
        expect(panel.blockingReason).not.toBe('');
        expect(panel.supervisorAction).toBe(scenario.supervisor);
        expect(panel.evidenceFresh).toBe(scenario.fresh);
        expect(panel.diagnosticRecords).toBeLessThanOrEqual(6);
        expect(panel.diagnosticSnapshot).not.toContain('fixture-secret-payload');
      }
      expect(panel.scenarioChanges).toBe(4);
      clickButton(app, dialog, 'Verify recovery');
      expect(panel.recoveries).toBe(1);
      expect(panel.releaseChecks).toBeGreaterThan(0);
      expect(panel.restorationChecks).toBe(0);
      expect(panel.diagnosticLeaks).toBe(0);
      expect(panel.diagnosticRecords).toBeLessThanOrEqual(6);
      expect(frameText(app)).toMatch(/(?:rehearsal|browser|not native|no-go|recovery)/iu);
    } finally {
      app.loop.dispose();
    }
    expect(panel.cleanupCount).toBe(1);
  });

  test('should keep both laboratories padded through resize, maximize, restore, and reduced geometry', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      try {
        collectTemplate1Evidence(app, dialog);
        resizeDialog(app, dialog);
        collectTemplate1Evidence(app, dialog, { startup: 'resized' });
        app.loop.dispatch(key('z', { alt: true }));
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
        app.loop.dispatch(key('z', { alt: true }));
        collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      } finally {
        app.loop.dispose();
      }

      const reduced = buildLabExample(id, definition, { viewport: { width: 68, height: 20 } });
      try {
        const evidence = collectTemplate1Evidence(reduced.app, reduced.dialog);
        expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Tab|Enter|click)/iu);
        expect(frameText(reduced.app)).toMatch(/(?:status|saved|scenario|ship|no-go|ready)/iu);
      } finally {
        reduced.app.loop.dispose();
      }
    }
  });
});

describe('Independent complete-application controls', () => {
  test('should keep raw editing separate from trusted typed form output', () => {
    const form = createForm({
      schema: z.object({ name: z.string().trim().min(1), port: z.coerce.number().int().min(1).max(65535) }),
      initial: { name: 'Demo', port: '8080' },
    });
    expect(form.rawValues()).toEqual({ name: 'Demo', port: '8080' });
    expect(form.values()).toEqual({ name: 'Demo', port: 8080 });
    form.field('port').value.set('invalid');
    expect(form.values()).toBeNull();
    form.dispose();
  });

  test('should preserve validated domain text, sanitize its display, and suppress stale completion after disposal', async () => {
    const pending = deferred<{ ok: true } | { ok: false; code: 'denied' }>();
    const writes: PersistedRecord[] = [];
    let observedSignal: AbortSignal | undefined;
    const model = new WorkflowCoordinator({
      save: (record, abort) => {
        writes.push(record);
        observedSignal = abort;
        return pending.promise;
      },
    });
    const saving = model.save('  report\x1b]0;unsafe\x07  ');
    expect(writes).toEqual([{ id: 1, name: 'report\x1b]0;unsafe\x07' }]);
    expect(sanitize(writes[0]?.name ?? '')).toBe('report]0;unsafe');
    model.dispose();
    expect(observedSignal?.aborted).toBe(true);
    pending.resolve({ ok: true });
    await saving;
    expect(model.phase()).toBe('saving');
    expect(model.savedName()).toBeNull();
  });

  test('should make a fresh complete release shippable and stale evidence a no-go', () => {
    const releaseId = 'release-1';
    const recordedAt = 1_000;
    const concerns = [
      'package',
      'runtime',
      'tty',
      'restore',
      'diagnostics',
      'security',
      'compatibility',
      'performance',
      'support',
    ] as const;
    const evidence: ProductionEvidence[] = concerns.map((concern) => ({
      concern,
      status: 'pass',
      releaseId,
      recordedAt,
      reason: `${concern} verified`,
    }));
    expect(assessProductionReadiness(releaseId, evidence, { assessedAt: 1_100, maxAgeMs: 200 }).decision).toBe('ship');
    expect(assessProductionReadiness(releaseId, evidence, { assessedAt: 1_500, maxAgeMs: 200 }).decision).toBe('no-go');
  });
});
