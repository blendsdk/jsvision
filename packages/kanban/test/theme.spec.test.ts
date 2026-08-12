import { classicTheme } from '@jsvision/core';
import type { Color } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';

import { KANBAN_THEME_ROLES, createKanbanTheme, resolveKanbanTheme, resolveKanbanThemeRole } from '../src/index.js';
import type { KanbanTheme } from '../src/index.js';

const EXPECTED_ROLES = [
  'board.surface',
  'column.surface',
  'column.header',
  'column.header.focused',
  'column.separator',
  'swimlane.surface',
  'swimlane.header',
  'swimlane.header.focused',
  'swimlane.separator',
  'card.normal',
  'card.accent-1',
  'card.accent-2',
  'card.accent-3',
  'card.accent-4',
  'card.focused',
  'card.selected',
  'card.focused-selected',
  'card.read-only',
  'card.grabbed',
  'card.source-placeholder',
  'card.ghost',
  'drop-target.valid',
  'drop-target.warning',
  'drop-target.invalid',
  'operation.pending',
  'operation.rejected',
  'wip.warning',
  'wip.error',
  'dod.indicator',
  'state.loading',
  'state.refreshing',
  'state.partial',
  'state.empty',
  'state.error',
  'state.retry',
  'content.title',
  'content.status',
  'content.metadata',
  'content.label',
  'content.summary',
  'checklist.complete',
  'checklist.incomplete',
  'checklist.progress',
] as const;

describe('Kanban semantic theme contract', () => {
  it('should publish the exact closed role inventory as immutable package-local tokens', () => {
    // Descriptor roles are allowlisted; an open string vocabulary could inject arbitrary paint identities.
    expect(KANBAN_THEME_ROLES).toEqual(EXPECTED_ROLES);
    expect(new Set(KANBAN_THEME_ROLES).size).toBe(EXPECTED_ROLES.length);
    expect(Object.isFrozen(KANBAN_THEME_ROLES)).toBe(true);
  });

  it('should derive a complete deeply immutable token palette with the documented Core mappings', () => {
    const theme = createKanbanTheme(classicTheme);

    expect(theme.contractVersion).toBe(1);
    expect(Object.keys(theme.roles)).toEqual(EXPECTED_ROLES);
    expect(theme.roles['board.surface'].style).toEqual(classicTheme.listNormal);
    expect(theme.roles['column.header'].mappedFallback).toEqual(classicTheme.tableHeader);
    expect(theme.roles['card.focused'].mappedFallback).toEqual(classicTheme.listFocused);
    expect(theme.roles['card.selected'].mappedFallback).toEqual(classicTheme.listSelected);
    expect(theme.roles['card.read-only'].mappedFallback).toEqual(classicTheme.buttonDisabled);
    expect(theme.roles['column.separator'].mappedFallback).toEqual(classicTheme.listDivider);
    expect(theme.roles['wip.warning'].mappedFallback).toEqual(classicTheme.warningText);
    expect(theme.roles['state.error'].mappedFallback).toEqual(classicTheme.dangerText);
    expect(theme.roles['card.grabbed'].mappedFallback).toEqual(classicTheme.splitterDragging);
    expect(theme.roles['operation.pending'].mappedFallback).toEqual(classicTheme.progressFill);
    expect(Object.isFrozen(theme)).toBe(true);
    expect(Object.isFrozen(theme.roles)).toBe(true);
    expect(Object.isFrozen(theme.roles['content.title'])).toBe(true);
    expect(Object.isFrozen(theme.roles['content.title'].style)).toBe(true);
    expect(Object.isFrozen(theme.roles['content.title'].cues)).toBe(true);
    expect(theme.roles['content.title'].cues.length).toBeGreaterThan(0);
  });

  it('should apply a valid explicit token override above its mapped Core role without retaining caller data', () => {
    const statusStyle: { fg: Color; bg: Color } = { fg: '#000000', bg: '#ffffff' };
    const overrides = { 'content.status': statusStyle };
    const resolved = resolveKanbanTheme(classicTheme, overrides);

    statusStyle.fg = '#ffffff';
    expect(resolved.report.rejected).toEqual([]);
    expect(resolved.theme.roles['content.status'].style).toMatchObject({ fg: '#000000', bg: '#ffffff' });
    expect(resolved.theme.roles['content.status'].mappedFallback).toEqual(classicTheme.listNormal);
  });

  it('should reject unknown, malformed, and accessor-backed overrides without invoking accessors', () => {
    const getter = vi.fn(() => ({ fg: '#000000', bg: '#ffffff' }));
    const hostile = Object.create(null);
    Object.defineProperty(hostile, 'content.title', { enumerable: true, get: getter });
    Object.defineProperty(hostile, 'unknown.role', {
      enumerable: true,
      value: { fg: '\u001b[31m', bg: '#ffffff' },
    });

    const resolved = resolveKanbanTheme(classicTheme, hostile);

    expect(getter).not.toHaveBeenCalled();
    expect(resolved.report.rejected.length).toBeGreaterThan(0);
    expect(JSON.stringify(resolved.report)).not.toContain('\u001b');
    expect(resolved.theme.roles['content.title'].style).toEqual(classicTheme.listNormal);
    expect(Object.keys(resolved.theme.roles)).toEqual(EXPECTED_ROLES);
  });

  it('should retain a non-color cue and omit numeric contrast claims in monochrome and no-color modes', () => {
    const theme = createKanbanTheme(classicTheme);
    const mono = resolveKanbanThemeRole(theme, 'card.focused', 'card.normal', { colorDepth: 'mono' });
    const noColor = resolveKanbanThemeRole(theme, 'content.status', 'content.title', {
      colorDepth: 'truecolor',
      noColor: true,
    });

    expect(mono.role).toBe('card.focused');
    expect(mono.cues.length).toBeGreaterThan(0);
    expect(mono.contrastRatio).toBeUndefined();
    expect(noColor.cues.length).toBeGreaterThan(0);
    expect(noColor.contrastRatio).toBeUndefined();
  });

  it('should route an unknown requested role through the allowlisted fallback chain', () => {
    const theme = createKanbanTheme(classicTheme);
    const resolved = resolveKanbanThemeRole(theme, 'application.secret-role', 'state.error', {
      colorDepth: '16',
    });

    expect(resolved.role).toBe('state.error');
    expect(resolved.fallback).not.toBe('none');
    expect(resolved.style).not.toHaveProperty('application.secret-role');
    expect(resolved.cues.length).toBeGreaterThan(0);
  });
});
it('supplies four optional card accents with legacy card-normal fallback', () => {
  const theme = createKanbanTheme(classicTheme, { 'card.accent-1': { bg: '#005f87', fg: '#ffffff' } });
  expect(KANBAN_THEME_ROLES).toEqual(expect.arrayContaining(['card.accent-1', 'card.accent-4']));
  expect(theme.roles['card.accent-1']?.style.bg).toBe('#005f87');
  expect(theme.roles['card.accent-2']?.mappedFallback).toEqual(theme.roles['card.normal'].style);

  const { 'card.accent-2': omitted, ...legacyRoles } = theme.roles;
  expect(omitted).toBeDefined();
  const legacy: KanbanTheme = { ...theme, roles: legacyRoles };
  const resolved = resolveKanbanThemeRole(legacy, 'card.accent-2', 'card.normal', { colorDepth: 'truecolor' });
  expect(resolved.role).toBe('card.accent-2');
  expect(resolved.style).toEqual(theme.roles['card.normal'].style);
});

it.each(['truecolor', '256', '16', 'mono'] as const)(
  'keeps card accent identity and redundant cues at %s depth',
  (colorDepth) => {
    const theme = createKanbanTheme(classicTheme, {
      'card.accent-3': { bg: '#af0000', fg: '#ffffff' },
    });
    const resolved = resolveKanbanThemeRole(theme, 'card.accent-3', 'card.normal', { colorDepth });
    expect(resolved.role).toBe('card.accent-3');
    expect(resolved.cues.length).toBeGreaterThan(0);
    if (colorDepth === 'mono') expect(resolved.contrastRatio).toBeUndefined();
    else expect(resolved.contrastRatio).toBeGreaterThanOrEqual(4.5);
  },
);

it('keeps accent identity with mapped styling when NO_COLOR is active', () => {
  const theme = createKanbanTheme(classicTheme);
  const resolved = resolveKanbanThemeRole(theme, 'card.accent-4', 'card.normal', {
    colorDepth: 'truecolor',
    noColor: true,
  });
  expect(resolved).toMatchObject({ role: 'card.accent-4', fallback: 'mapped-core' });
  expect(resolved.cues.length).toBeGreaterThan(0);
});
