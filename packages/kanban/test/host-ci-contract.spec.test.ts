/** Specification oracle for designated Node 22 Kanban host evidence in CI. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('Kanban host CI contract', () => {
  it('designates Node 22 Ubuntu, macOS, and Windows jobs for the focused host E2E suite', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const hostJob = /kanban-host-e2e:\s*([\s\S]*?)(?=\n  [a-z][a-z0-9-]*:|\s*$)/u.exec(workflow)?.[1] ?? '';

    expect(hostJob, 'a dedicated kanban-host-e2e job must exist').not.toBe('');
    expect(hostJob).toMatch(/node-version:\s*22/u);
    expect(hostJob).toMatch(/ubuntu-latest/u);
    expect(hostJob).toMatch(/macos-latest/u);
    expect(hostJob).toMatch(/windows-latest/u);
    expect(hostJob).toMatch(/yarn workspace @jsvision\/kanban test:e2e/u);
  });

  it('requires platform evidence in every designated cell and never converts host failure into success', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const hostJob = /kanban-host-e2e:\s*([\s\S]*?)(?=\n  [a-z][a-z0-9-]*:|\s*$)/u.exec(workflow)?.[1] ?? '';

    expect(hostJob).toMatch(/JSVISION_KANBAN_REQUIRE_HOST_EVIDENCE:\s*['"]?1['"]?/u);
    expect(hostJob).not.toMatch(/continue-on-error:\s*true/u);
    expect(hostJob).not.toMatch(/\|\|\s*(?:true|exit\s+0)/u);
    expect(hostJob).not.toMatch(/if:\s*runner\.os\s*!=\s*['"]Windows['"]/u);
  });
});
