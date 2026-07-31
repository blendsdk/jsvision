/**
 * Immutable oracle for the In production course and its authentic operational substitutes.
 *
 * Deployment, process supervision, and a real controlling terminal cannot be reproduced honestly
 * in the browser. The course must instead bind a verified supervisor policy, release-readiness
 * checklist, bounded diagnostic fixture, and executable artifact test to current public evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger, dumpCaps, evaluateEssentials, redactEvent, resolveCapabilities, sanitize } from '@jsvision/core';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';

const guidePath = fileURLToPath(new URL('../guide/in-production.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const supervisorPath = fileURLToPath(
  new URL('../src/example-fixtures/in-production/supervisor-policy.json', import.meta.url),
);
const readinessPath = fileURLToPath(
  new URL('../src/example-fixtures/in-production/production-readiness.ts', import.meta.url),
);
const diagnosticsPath = fileURLToPath(
  new URL('../src/example-fixtures/in-production/bounded-diagnostics.ts', import.meta.url),
);
const artifactTestPath = fileURLToPath(new URL('./in-production-example.spec.test.ts', import.meta.url));
const rootManifestPath = fileURLToPath(new URL('../../../package.json', import.meta.url));
const coreManifestPath = fileURLToPath(new URL('../../core/package.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const supervisorSource = existsSync(supervisorPath) ? readFileSync(supervisorPath, 'utf8') : '';
const readinessSource = existsSync(readinessPath) ? readFileSync(readinessPath, 'utf8') : '';
const diagnosticsSource = existsSync(diagnosticsPath) ? readFileSync(diagnosticsPath, 'utf8') : '';
const artifactTestSource = existsSync(artifactTestPath) ? readFileSync(artifactTestPath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'in-production');
const exactException =
  'Deployment, process supervision, container security, and production terminal evidence cannot be reproduced by an embedded browser terminal.';

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

function parsedSupervisor(): unknown {
  if (supervisorSource === '') return undefined;
  return JSON.parse(supervisorSource) as unknown;
}

describe('In production course and authentic-substitute contract', () => {
  test('should publish the completed zero-lab catalog contract with its exact exception', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'In production',
      group: 'Operating a real app',
      page: '/guide/in-production',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 6,
      prerequisites: ['crash-safety', 'untrusted-text', 'terminal-capabilities'],
      learningOutcomes: [
        'Package, deploy, observe, and support a Node or Bun ESM terminal application.',
        'Set evidence-based compatibility, security, performance, and operational expectations.',
      ],
      requiredLiveExamples: 0,
      liveExampleException: exactException,
      examples: [],
    });
    expect(source).toContain('](/guide/crash-safety)');
    expect(source).toContain('](/guide/untrusted-text)');
    expect(source).toContain('](/guide/terminal-capabilities)');
    expect(source).not.toContain('<PlayExample');
    expect(EXAMPLES.filter((candidate) => candidate.id.startsWith('guides/in-production'))).toHaveLength(0);
  });

  test('should state the learner contract and follow a question-led production course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the production-readiness mental model?',
      '## How do I get the first deployable result?',
      '## What operational evidence replaces a browser laboratory?',
      '## How do I package a Node ESM application?',
      '## When is a Bun deployment claim justified?',
      '## How do I preserve terminal and signal ownership?',
      '## How do I supervise without creating a crash loop?',
      '## How do I collect bounded, redacted diagnostics?',
      '## How do capability snapshots support an incident?',
      '## How do I set security expectations?',
      '## How do I scope compatibility and support promises?',
      '## How do I use performance evidence?',
      '## How do I make a release-readiness decision?',
      '## How do I keep operational evidence fresh?',
      '## What belongs in advanced production work?',
      '## How do I diagnose production failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:package|deploy).+(?:observe|support).+(?:Node|Bun|ESM)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach production readiness as linked build, runtime, terminal, evidence, and support owners', () => {
    expect(source).toMatch(
      /(?:build artifact|package)[\s\S]{0,350}(?:runtime|process)[\s\S]{0,350}(?:terminal|TTY)[\s\S]{0,350}(?:evidence|support)/iu,
    );
    expect(source).toMatch(/(?:application|host)[\s\S]{0,300}(?:restore|cleanup)[\s\S]{0,300}(?:supervisor|restart)/iu);
    expect(source).toMatch(/(?:release|deploy)[\s\S]{0,350}(?:immutable|reproducible|lockfile|provenance)/iu);
    expect(source).toMatch(/(?:readiness|go\/no-go|ship)[\s\S]{0,350}(?:evidence|pass|fail|warning)/iu);
    expect(source).toMatch(/(?:claim|promise)[\s\S]{0,300}(?:owner|scope|date|environment|version)/iu);
  });

  test('should package only public ESM entry points with a reproducible Node 22 baseline', () => {
    expect(source).toMatch(/(?:Node|node)[\s\S]{0,120}(?:>=?\s*22|22\+)/iu);
    expect(source).toMatch(/"type"\s*:\s*"module"[\s\S]{0,500}(?:build|dist|entry)/iu);
    expect(source).toMatch(/(?:@jsvision\/core|@jsvision\/ui)[\s\S]{0,350}(?:same version|lockstep|pin)/iu);
    expect(source).toMatch(
      /(?:public entry|package entry|exports)[\s\S]{0,300}(?:never|avoid|do not)[\s\S]{0,250}internal/iu,
    );
    expect(source).toMatch(/(?:frozen lockfile|immutable install|yarn\.lock)[\s\S]{0,300}(?:build|verify)/iu);
    expect(source).toMatch(/(?:artifact|bundle|dist)[\s\S]{0,350}(?:checksum|digest|version|commit)/iu);
    expect(source).toMatch(/(?:CommonJS|require\(\))[\s\S]{0,300}(?:unsupported|dynamic import|ESM)/iu);
  });

  test('should distinguish the Node package contract from bounded and possibly stale Bun evidence', () => {
    expect(source).toMatch(
      /ADR-009[\s\S]{0,300}(?:Proposed|proposed)[\s\S]{0,350}(?:not|does not)[\s\S]{0,220}(?:guarantee|support promise)/iu,
    );
    expect(source).toMatch(/(?:package manifest|engines)[\s\S]{0,350}(?:Node|node)[\s\S]{0,300}(?:Bun|bun)/iu);
    expect(source).toMatch(/bun build --compile[\s\S]{0,350}(?:target|binary|executable)/iu);
    expect(source).toMatch(/(?:embedded|bundled)[\s\S]{0,250}(?:source|runtime)[\s\S]{0,250}(?:size|sign|scan)/iu);
    expect(source).toMatch(
      /(?:Bun|bun)[\s\S]{0,400}(?:CI|PTY|restore|signal)[\s\S]{0,350}(?:current|dated|recorded|matrix)/iu,
    );
    expect(source).toMatch(
      /(?:do not|never)[\s\S]{0,300}(?:promote|turn)[\s\S]{0,250}(?:experiment|proposed|observation)[\s\S]{0,250}(?:guarantee|promise)/iu,
    );
  });

  test('should preserve a controlling TTY, signal forwarding, and one restoration owner', () => {
    expect(source).toMatch(/(?:controlling TTY|interactive TTY)[\s\S]{0,350}(?:allocate|attach|preserve)/iu);
    expect(source).toMatch(/(?:non-TTY|detached|background)[\s\S]{0,350}(?:fail|refuse|requireTty)/iu);
    expect(source).toMatch(/(?:SIGINT|SIGTERM|SIGHUP)[\s\S]{0,400}(?:forward|child|application)/iu);
    expect(source).toMatch(
      /(?:await app\.run\(\)|Application\.run\(\))[\s\S]{0,350}(?:restore|raw mode|alternate screen|cursor)/iu,
    );
    expect(source).toMatch(/(?:one|single)[\s\S]{0,220}(?:restore|terminal lifecycle) owner/iu);
    expect(source).toMatch(
      /(?:grace period|TimeoutStopSec|shutdown timeout)[\s\S]{0,300}(?:restore|clean|force|kill)/iu,
    );
    expect(source).toMatch(
      /(?:SIGKILL|kill -9|unconditional termination)[\s\S]{0,300}(?:cannot|no)[\s\S]{0,200}(?:cleanup|restore|handler)/iu,
    );
  });

  test('should supervise failures with bounded restart, backoff, and startup classification', () => {
    expect(source).toMatch(
      /(?:restart)[\s\S]{0,250}(?:failure|non-zero)[\s\S]{0,250}(?:not|never)[\s\S]{0,180}(?:clean|zero|normal)/iu,
    );
    expect(source).toMatch(/(?:backoff|delay)[\s\S]{0,300}(?:attempt|burst|window|limit)/iu);
    expect(source).toMatch(/(?:crash loop|restart loop)[\s\S]{0,350}(?:stop|open|trip|manual)/iu);
    expect(source).toMatch(
      /(?:startup|preflight)[\s\S]{0,350}(?:TTY|configuration|permission|artifact)[\s\S]{0,300}(?:permanent|do not restart|operator)/iu,
    );
    expect(source).toMatch(
      /(?:exit code|reason)[\s\S]{0,350}(?:deploy|operator stop|application defect|host failure)/iu,
    );
    expect(source).toMatch(/(?:health|readiness)[\s\S]{0,350}(?:process alive|not enough|interaction|terminal)/iu);
  });

  test('should collect bounded screen-safe diagnostics without retaining user payloads', () => {
    expect(source).toMatch(/createLogger\([\s\S]{0,400}(?:ring|file|stderr)[\s\S]{0,300}(?:size|bound|capacity)/iu);
    expect(source).toMatch(/(?:console\.log|stdout)[\s\S]{0,350}(?:corrupt|scribble|active UI|terminal)/iu);
    expect(source).toMatch(
      /redactEvent\([\s\S]{0,350}(?:printable|paste)[\s\S]{0,250}(?:never|not)[\s\S]{0,150}(?:text|payload|character)/iu,
    );
    expect(source).toMatch(
      /sanitize\([\s\S]{0,350}(?:display|terminal control)[\s\S]{0,250}(?:not|different)[\s\S]{0,220}redact/iu,
    );
    expect(source).toMatch(/dumpCaps\([\s\S]{0,350}(?:reason|layer|profile)[\s\S]{0,250}(?:secret-free|safe)/iu);
    expect(source).toMatch(/(?:token|secret|path|environment value|user text)[\s\S]{0,400}(?:redact|omit|allowlist)/iu);
    expect(source).toMatch(/(?:retention|rotation|expiry|expire)[\s\S]{0,350}(?:diagnostic|log|incident)/iu);
  });

  test('should use capability evidence to separate startup failures from supported degradation', () => {
    expect(source).toMatch(/evaluateEssentials\([\s\S]{0,350}(?:interactive TTY)[\s\S]{0,250}(?:missing|met)/iu);
    expect(source).toMatch(
      /(?:mouse|color|colour|alternate screen)[\s\S]{0,350}(?:degradation|keyboard-only|monochrome|inline)/iu,
    );
    expect(source).toMatch(/(?:capability snapshot|dumpCaps)[\s\S]{0,350}(?:incident|ticket|support bundle)/iu);
    expect(source).toMatch(
      /(?:profile|capability)[\s\S]{0,300}(?:reason|provenance)[\s\S]{0,250}(?:diagnos|compare)/iu,
    );
    expect(source).toMatch(/(?:SSH|tmux|screen|Windows)[\s\S]{0,500}(?:verify|matrix|evidence)/iu);
    expect(source).toMatch(/(?:fallback|degraded)[\s\S]{0,300}(?:not|is not)[\s\S]{0,220}(?:failure|unsupported)/iu);
  });

  test('should scope security, compatibility, performance, and support to their owning evidence', () => {
    expect(source).toContain('](/reference/architecture/security)');
    expect(source).toContain('](/reference/decisions/ADR-001-esm-zero-dependency)');
    expect(source).toContain('](/reference/decisions/ADR-006-informational-perf-bench)');
    expect(source).toContain('](/reference/decisions/ADR-009-bun-runtime-support)');
    expect(source).toMatch(
      /(?:zero runtime dependencies|supply chain)[\s\S]{0,400}(?:does not|not)[\s\S]{0,250}(?:secure app|authorization|container)/iu,
    );
    expect(source).toMatch(
      /(?:container|sandbox|least privilege)[\s\S]{0,450}(?:TTY|device|filesystem|network|capability)/iu,
    );
    expect(source).toMatch(
      /(?:compatibility|supported)[\s\S]{0,350}(?:runtime|OS|terminal|version)[\s\S]{0,300}(?:tested|matrix|date)/iu,
    );
    expect(source).toMatch(/(?:median|p95|16 ms)[\s\S]{0,350}(?:informational|environment|hardware|contention)/iu);
    expect(source).toMatch(
      /(?:performance|benchmark)[\s\S]{0,300}(?:not|never)[\s\S]{0,220}(?:SLA|guarantee|universal)/iu,
    );
    expect(source).toMatch(
      /(?:support policy|support promise)[\s\S]{0,350}(?:owner|response|reproduce|evidence|version)/iu,
    );
  });

  test('should make readiness a reproducible decision and reject stale evidence', () => {
    expect(source).toMatch(
      /(?:production-readiness|release-readiness)[\s\S]{0,400}(?:pass|fail|warn)[\s\S]{0,300}(?:evidence|reason)/iu,
    );
    expect(source).toMatch(/(?:timestamp|recordedAt|assessedAt|date)[\s\S]{0,350}(?:clock|inject|deterministic)/iu);
    expect(source).toMatch(
      /(?:stale|expired|too old)[\s\S]{0,300}(?:compatibility|security|performance|restore|evidence)/iu,
    );
    expect(source).toMatch(/(?:maximum age|freshness|age limit|expires)[\s\S]{0,300}(?:fail|warning|rerun)/iu);
    expect(source).toMatch(/(?:release identifier|version|commit|digest)[\s\S]{0,350}(?:evidence|artifact)/iu);
    expect(source).toMatch(/(?:go|ship)[\s\S]{0,250}(?:all|required|blocking)[\s\S]{0,250}(?:pass|green)/iu);
    expect(source).toMatch(/(?:no-go|do not ship|block)[\s\S]{0,300}(?:missing|failed|stale)/iu);
  });

  test('should bind the zero-lab exception to named, authentic operational artifacts', () => {
    expect(source).toContain('src/example-fixtures/in-production/supervisor-policy.json');
    expect(source).toContain('src/example-fixtures/in-production/production-readiness.ts');
    expect(source).toContain('src/example-fixtures/in-production/bounded-diagnostics.ts');
    expect(source).toContain('test/in-production-example.spec.test.ts');
    expect(source).toMatch(
      /(?:browser|embedded terminal)[\s\S]{0,450}(?:cannot|cannot honestly)[\s\S]{0,350}(?:supervis|container|real TTY|deployment)/iu,
    );
    expect(source).toMatch(
      /(?:artifact|substitute)[\s\S]{0,300}(?:run|verify|test)[\s\S]{0,300}(?:observe|expected)/iu,
    );
  });

  test('should require a parseable supervisor policy with terminal-safe bounded restart semantics', () => {
    expect(supervisorSource).not.toBe('');
    expect(parsedSupervisor()).toMatchObject({
      schemaVersion: 1,
      runtime: 'node',
      entry: 'dist/main.js',
      terminal: {
        requiresTty: true,
        forwardSignals: ['SIGINT', 'SIGTERM', 'SIGHUP'],
      },
      restart: {
        mode: 'on-failure',
        maxAttempts: 3,
        windowSeconds: 60,
        backoffSeconds: [1, 5, 15],
      },
    });
    expect(parsedSupervisor()).toMatchObject({
      shutdown: {
        graceSeconds: 15,
        forceSignal: 'SIGKILL',
      },
    });
  });

  test('should require deterministic readiness and bounded-diagnostic source contracts', () => {
    expect(readinessSource).not.toBe('');
    expect(readinessSource).toMatch(
      /export (?:function|const) (?:evaluateProductionReadiness|assessProductionReadiness)/u,
    );
    for (const concern of [
      'package',
      'runtime',
      'tty',
      'restore',
      'diagnostics',
      'security',
      'compatibility',
      'performance',
      'support',
      'freshness',
    ]) {
      expect(readinessSource).toMatch(new RegExp(`\\b${concern}\\b`, 'iu'));
    }
    expect(readinessSource).toMatch(
      /(?:pass|fail|warn)[\s\S]{0,400}(?:assessedAt|now|clock)[\s\S]{0,300}(?:maxAge|fresh|stale)/iu,
    );
    expect(readinessSource).not.toMatch(/Date\.now\(\)|process\.env|readFile|fetch\(/u);

    expect(diagnosticsSource).not.toBe('');
    expect(diagnosticsSource).toMatch(/from ['"]@jsvision\/core['"]/u);
    expect(diagnosticsSource).toMatch(/createLogger\([\s\S]{0,250}sink:\s*['"]ring['"][\s\S]{0,250}size:/u);
    expect(diagnosticsSource).toMatch(/redactEvent\(/u);
    expect(diagnosticsSource).toMatch(/dumpCaps\(/u);
    expect(diagnosticsSource).toMatch(/sanitize\(/u);
    expect(diagnosticsSource).not.toMatch(/console\.|process\.env|readFile|fetch\(/u);
  });

  test('should require an executable artifact test for release, failure, and stale-evidence decisions', () => {
    expect(artifactTestSource).not.toBe('');
    expect(artifactTestSource).toContain("from '../src/example-fixtures/in-production/production-readiness.js'");
    expect(artifactTestSource).toContain("from '../src/example-fixtures/in-production/bounded-diagnostics.js'");
    expect(artifactTestSource).toMatch(/supervisor-policy\.json/u);
    expect(artifactTestSource).toMatch(/(?:ship|ready|pass)[\s\S]{0,450}(?:failed startup|non-TTY|artifact)/iu);
    expect(artifactTestSource).toMatch(/(?:crash loop|maxAttempts|backoff)[\s\S]{0,450}(?:stop|bounded|open)/iu);
    expect(artifactTestSource).toMatch(
      /(?:redact|payload|secret)[\s\S]{0,450}(?:not\.toContain|toHaveLength|bounded)/iu,
    );
    expect(artifactTestSource).toMatch(/(?:stale|freshness|maxAge)[\s\S]{0,450}(?:fail|no-go|block)/iu);
  });

  test('should diagnose failures by symptom, cause, correction, and distinguishing evidence', () => {
    for (const symptom of [
      'failed startup',
      'crash loop',
      'terminal remains',
      'diagnostic leak',
      'wrong capability',
      'stale evidence',
    ]) {
      expect(source).toMatch(new RegExp(symptom, 'iu'));
    }
    expect(source).toMatch(
      /Symptom[\s\S]{0,250}Likely cause[\s\S]{0,250}Correction[\s\S]{0,250}(?:Evidence|Distinguishing evidence)/iu,
    );
    expect(source).toMatch(
      /(?:failed startup|non-TTY)[\s\S]{0,350}(?:TTY allocation|requiresTty|terminal attachment)/iu,
    );
    expect(source).toMatch(/(?:diagnostic leak|secret)[\s\S]{0,350}(?:redactEvent|allowlist|bounded)/iu);
    expect(source).toMatch(/(?:terminal remains|raw mode|cursor)[\s\S]{0,350}(?:restore trace|supervisor|signal)/iu);
  });

  test('should finish with consequential practices, exercises, related courses, and public API links', () => {
    const bestPractices = source.slice(
      source.indexOf('## What are the best practices?'),
      source.indexOf('## What should I practice next?'),
    );
    expect(bestPractices.match(/^- /gmu)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(bestPractices).toMatch(/(?:otherwise|because|or else|prevents|so that)/iu);
    const practice = source.slice(source.indexOf('## What should I practice next?'));
    expect(practice.match(/^\d+\. /gmu)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(practice).toContain('Build a complete application');
    expect(practice).toContain('](/guide/complete-application)');
    expect(practice).toContain('](/api/core/functions/createLogger)');
    expect(practice).toContain('](/api/core/functions/evaluateEssentials)');
    expect(practice).toContain('](/api/core/functions/dumpCaps)');
  });

  test('should keep explanatory snippets focused on supported public entry points', () => {
    const blocks = snippets();
    expect(blocks.length).toBeGreaterThanOrEqual(8);
    expect(blocks.length).toBeLessThanOrEqual(20);
    for (const block of blocks) {
      expect(block.split('\n').length, block).toBeLessThanOrEqual(30);
      for (const match of block.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui', 'node:process']).toContain(match[1]);
      }
      expect(block).not.toMatch(/@jsvision\/(?:core|ui)\/(?:src|dist|engine)\//u);
      expect(block).not.toContain('../');
      expect(block).not.toContain('demoApp(');
      expect(block).not.toContain('Template1Dialog');
    }
    expect(blocks.some((block) => block.includes('createLogger'))).toBe(true);
    expect(blocks.some((block) => block.includes('evaluateEssentials'))).toBe(true);
    expect(blocks.some((block) => block.includes('dumpCaps'))).toBe(true);
  });
});

describe('Public production controls', () => {
  test('should expose an ESM-only Node 22 package contract at the current baseline', () => {
    const root = JSON.parse(readFileSync(rootManifestPath, 'utf8')) as {
      type?: string;
      engines?: Record<string, string>;
    };
    const core = JSON.parse(readFileSync(coreManifestPath, 'utf8')) as {
      type?: string;
      engines?: Record<string, string>;
      exports?: Record<string, unknown>;
      dependencies?: Record<string, string>;
    };
    expect(root).toMatchObject({ type: 'module', engines: { node: '>=22' } });
    expect(core).toMatchObject({ type: 'module', engines: { node: '>=22' }, exports: { '.': expect.anything() } });
    expect(core.dependencies ?? {}).toEqual({});
    expect(core.engines).not.toHaveProperty('bun');
  });

  test('should retain only the newest bounded and redacted input diagnostics', () => {
    const logger = createLogger({ sink: 'ring', size: 2 });
    logger.info('runtime', 'started', { release: '1.3.0' });
    logger.debug('input', 'event', redactEvent({ type: 'paste', text: 'token=production-secret', truncated: false }));
    logger.warn('runtime', 'degraded', { mode: 'keyboard-only' });
    const entries = logger.entries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.fields).toEqual({ type: 'paste', length: 23, truncated: false });
    expect(JSON.stringify(entries)).not.toContain('production-secret');
    logger.close();
  });

  test('should distinguish a non-TTY startup failure from non-essential degradations', () => {
    const caps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { colorDepth: 'mono', mouse: { sgr: false }, altScreen: false },
    }).profile;
    const failed = evaluateEssentials(caps, { isTTY: false });
    const degraded = evaluateEssentials(caps, { isTTY: true });
    expect(failed.met).toBe(false);
    expect(failed.missing).toEqual(['interactive TTY (raw-mode keyboard input)']);
    expect(degraded.met).toBe(true);
    expect(degraded.degradations.map((entry) => entry.mode)).toEqual(['keyboard-only', 'monochrome', 'inline']);
  });

  test('should produce secret-free capability evidence and inert display text', () => {
    const resolution = resolveCapabilities({
      env: { TERM: 'xterm-256color', COLORTERM: 'truecolor', API_TOKEN: 'production-secret' },
      platform: 'linux',
    });
    const evidence = dumpCaps(resolution);
    expect(evidence).toContain('colorDepth=truecolor (env)');
    expect(evidence).not.toContain('API_TOKEN');
    expect(evidence).not.toContain('production-secret');
    expect(sanitize('release\x1b]0;hijack\x07 ready')).toBe('release]0;hijack ready');
  });
});
