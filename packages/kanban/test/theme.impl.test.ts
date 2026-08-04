import { classicTheme } from '@jsvision/core';
import type { Theme, ThemeRole } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';

import { KANBAN_THEME_ROLES, createKanbanTheme, resolveKanbanTheme, resolveKanbanThemeRole } from '../src/index.js';
import type { KanbanThemeOverrides } from '../src/index.js';

describe('Kanban theme resolver implementation', () => {
  it('rejects every malformed nested field as an all-or-nothing override', () => {
    const getter = vi.fn(() => '#ffffff');
    const accessorStyle: Partial<ThemeRole> = { bg: '#000000' };
    Object.defineProperty(accessorStyle, 'fg', { enumerable: true, get: getter });
    const malformedColor: Partial<ThemeRole> = { fg: '#000000' };
    const malformedAttrs: Partial<ThemeRole> = { attrs: 0 };
    const unknownField: Partial<ThemeRole> = { fg: '#000000' };
    Reflect.set(malformedColor, 'fg', '#not-a-color');
    Reflect.set(malformedAttrs, 'attrs', 1_000_000);
    Reflect.set(unknownField, 'unexpected', '#ffffff');
    const overrides: KanbanThemeOverrides = {
      'content.title': accessorStyle,
      'content.status': malformedColor,
      'card.normal': malformedAttrs,
      'card.focused': unknownField,
    };
    const resolved = resolveKanbanTheme(classicTheme, overrides);

    expect(getter).not.toHaveBeenCalled();
    expect(resolved.report.rejected).toEqual(['card.normal', 'card.focused', 'content.title', 'content.status']);
    for (const role of ['content.title', 'content.status', 'card.normal', 'card.focused'] as const) {
      expect(resolved.theme.roles[role].style).toEqual(resolved.theme.roles[role].mappedFallback);
    }
  });

  it('publishes a deeply frozen non-color cue for every semantic role', () => {
    const theme = createKanbanTheme(classicTheme);

    for (const role of KANBAN_THEME_ROLES) {
      const token = theme.roles[role];
      expect(token.cues.length).toBeGreaterThan(0);
      expect(Object.isFrozen(token)).toBe(true);
      expect(Object.isFrozen(token.style)).toBe(true);
      expect(Object.isFrozen(token.mappedFallback)).toBe(true);
      expect(Object.isFrozen(token.terminalFallback)).toBe(true);
      expect(Object.isFrozen(token.cues)).toBe(true);
      expect(token.cues.every((cue) => Object.isFrozen(cue))).toBe(true);
    }
  });

  it.each(['16', '256', 'truecolor'] as const)('enforces readable effective contrast at %s depth', (colorDepth) => {
    const theme = createKanbanTheme(classicTheme, {
      'content.title': { fg: '#777777', bg: '#777777' },
    });
    const resolved = resolveKanbanThemeRole(theme, 'content.title', 'state.error', { colorDepth });

    expect(resolved.contrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(resolved.fallback).not.toBe('none');
  });

  it('uses the mapped Core role in monochrome even when an explicit color override exists', () => {
    const theme = createKanbanTheme(classicTheme, {
      'content.status': { fg: '#000000', bg: '#ffffff' },
    });
    const resolved = resolveKanbanThemeRole(theme, 'content.status', 'content.title', { colorDepth: 'mono' });

    expect(resolved.style).toEqual(classicTheme.listNormal);
    expect(resolved.fallback).toBe('mapped-core');
    expect(resolved.contrastRatio).toBeUndefined();
  });

  it('tries selected styling after an unreadable focused style for focused-selected cards', () => {
    const coreTheme: Theme = {
      ...classicTheme,
      listFocused: { fg: '#777777', bg: '#777777' },
      listSelected: { fg: '#000000', bg: '#ffffff' },
    };
    const theme = createKanbanTheme(coreTheme);
    const resolved = resolveKanbanThemeRole(theme, 'card.focused-selected', 'card.normal', {
      colorDepth: 'truecolor',
    });

    expect(resolved.style).toEqual(coreTheme.listSelected);
    expect(resolved.fallback).toBe('family');
    expect(resolved.contrastRatio).toBe(21);
  });

  it('keeps major monochrome card states distinguishable without color', () => {
    const theme = createKanbanTheme(classicTheme);
    const roles = [
      'card.normal',
      'card.focused',
      'card.focused-selected',
      'card.read-only',
      'card.grabbed',
      'card.source-placeholder',
      'card.ghost',
      'drop-target.valid',
    ] as const;
    const signatures = roles.map((role) => JSON.stringify(theme.roles[role].cues));

    expect(new Set(signatures).size).toBe(roles.length);
  });

  it('does not invoke a malformed Core role accessor and resolves deterministically', () => {
    const getter = vi.fn(() => classicTheme.listNormal);
    const hostile = { ...classicTheme };
    Object.defineProperty(hostile, 'listNormal', { enumerable: true, get: getter });

    const first = createKanbanTheme(hostile);
    const second = createKanbanTheme(hostile);

    expect(getter).not.toHaveBeenCalled();
    expect(first).toEqual(second);
    expect(first.roles['board.surface'].style).toEqual({ fg: '#000000', bg: '#ffffff', attrs: 1 });
  });
});
