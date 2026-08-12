import { ANSI16_ORDER, Attr, contrastRatio, nearest16, nearest256, rgb256, sanitize, toRgb } from '@jsvision/core';
import type { Color, Theme, ThemeRole } from '@jsvision/core';

import { KANBAN_THEME_ROLES } from './theme.js';
import type {
  KanbanNonColorCue,
  KanbanResolvedThemeRole,
  KanbanTheme,
  KanbanThemeCapabilities,
  KanbanThemeOverrides,
  KanbanThemeResolutionReport,
  KanbanThemeRole,
  KanbanThemeToken,
  ResolvedKanbanTheme,
} from './theme.js';

/** Core theme role used as the mapped fallback for one Kanban semantic role. */
type CoreThemeRoleName =
  | 'listNormal'
  | 'listFocused'
  | 'listSelected'
  | 'listDivider'
  | 'tableHeader'
  | 'buttonDisabled'
  | 'progressFill'
  | 'progressTrack'
  | 'warningText'
  | 'dangerText'
  | 'splitterDragging'
  | 'statusBar';

/** Exact mapping from the closed Kanban vocabulary to existing Core semantics. */
const CORE_ROLE_BY_KANBAN: Readonly<Record<KanbanThemeRole, CoreThemeRoleName>> = Object.freeze({
  'board.surface': 'listNormal',
  'column.surface': 'listNormal',
  'column.header': 'tableHeader',
  'column.header.focused': 'listFocused',
  'column.separator': 'listDivider',
  'swimlane.surface': 'listNormal',
  'swimlane.header': 'tableHeader',
  'swimlane.header.focused': 'listFocused',
  'swimlane.separator': 'listDivider',
  'card.normal': 'listNormal',
  'card.accent-1': 'listNormal',
  'card.accent-2': 'listNormal',
  'card.accent-3': 'listNormal',
  'card.accent-4': 'listNormal',
  'card.focused': 'listFocused',
  'card.selected': 'listSelected',
  'card.focused-selected': 'listFocused',
  'card.read-only': 'buttonDisabled',
  'card.grabbed': 'splitterDragging',
  'card.source-placeholder': 'splitterDragging',
  'card.ghost': 'splitterDragging',
  'drop-target.valid': 'statusBar',
  'drop-target.warning': 'warningText',
  'drop-target.invalid': 'dangerText',
  'operation.pending': 'progressFill',
  'operation.rejected': 'dangerText',
  'wip.warning': 'warningText',
  'wip.error': 'dangerText',
  'dod.indicator': 'statusBar',
  'state.loading': 'progressTrack',
  'state.refreshing': 'progressFill',
  'state.partial': 'statusBar',
  'state.empty': 'listNormal',
  'state.error': 'dangerText',
  'state.retry': 'statusBar',
  'content.title': 'listNormal',
  'content.status': 'listNormal',
  'content.metadata': 'listNormal',
  'content.label': 'listNormal',
  'content.summary': 'listNormal',
  'checklist.complete': 'statusBar',
  'checklist.incomplete': 'listNormal',
  'checklist.progress': 'progressFill',
});

/** Family fallback used when both an explicit style and its direct Core mapping are unreadable. */
const TERMINAL_ROLE_BY_KANBAN: Readonly<Record<KanbanThemeRole, CoreThemeRoleName>> = Object.freeze(
  Object.fromEntries(
    KANBAN_THEME_ROLES.map((role) => {
      if (role === 'card.focused-selected') return [role, 'listSelected'];
      if (role.includes('warning')) return [role, 'warningText'];
      if (role.includes('error') || role.includes('invalid') || role.includes('rejected')) {
        return [role, 'dangerText'];
      }
      if (role.includes('pending') || role.includes('progress') || role.includes('refreshing')) {
        return [role, 'progressFill'];
      }
      if (role.includes('focused')) return [role, 'listFocused'];
      if (role.includes('selected')) return [role, 'listSelected'];
      return [role, 'listNormal'];
    }),
  ) as Record<KanbanThemeRole, CoreThemeRoleName>,
);

/** Closed role membership set used at untyped dynamic-style boundaries. */
const THEME_ROLE_SET = new Set<string>(KANBAN_THEME_ROLES);
/** Exact fields accepted in a caller theme-role override. */
const OVERRIDE_FIELDS = new Set(['fg', 'bg', 'hotkey', 'attrs']);
/** Emergency mandatory-text style used only after every theme-derived pair fails. */
const EMERGENCY_STYLE: ThemeRole = Object.freeze({ fg: '#000000', bg: '#ffffff', attrs: Attr.bold });
/** All currently supported terminal attribute bits. */
const MAX_ATTR_MASK = Attr.bold | Attr.dim | Attr.italic | Attr.underline | Attr.blink | Attr.reverse | Attr.strike;

/** Returns one detached frozen ThemeRole. */
function freezeStyle(style: ThemeRole): ThemeRole {
  return Object.freeze({
    fg: style.fg,
    bg: style.bg,
    ...(style.hotkey === undefined ? {} : { hotkey: style.hotkey }),
    ...(style.attrs === undefined ? {} : { attrs: style.attrs }),
  });
}

/** Returns whether an untyped value is an allowlisted, parser-valid Core color. */
function isColor(value: unknown): value is Color {
  if (typeof value !== 'string') return false;
  try {
    toRgb(value as Color);
    return true;
  } catch {
    return false;
  }
}

/** Reads a complete Core role without invoking accessors or retaining caller objects. */
function readCoreRole(theme: Theme, role: CoreThemeRoleName): ThemeRole | undefined {
  try {
    const outer = Object.getOwnPropertyDescriptor(theme, role);
    if (outer === undefined || !('value' in outer) || typeof outer.value !== 'object' || outer.value === null) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(outer.value);
    const fg = descriptors.fg;
    const bg = descriptors.bg;
    const hotkey = descriptors.hotkey;
    const attrs = descriptors.attrs;
    if (fg === undefined || !('value' in fg) || !isColor(fg.value)) return undefined;
    if (bg === undefined || !('value' in bg) || !isColor(bg.value)) return undefined;
    if (hotkey !== undefined && (!('value' in hotkey) || !isColor(hotkey.value))) return undefined;
    if (
      attrs !== undefined &&
      (!('value' in attrs) || !Number.isSafeInteger(attrs.value) || attrs.value < 0 || attrs.value > MAX_ATTR_MASK)
    ) {
      return undefined;
    }
    return freezeStyle({
      fg: fg.value,
      bg: bg.value,
      ...(hotkey === undefined ? {} : { hotkey: hotkey.value }),
      ...(attrs === undefined ? {} : { attrs: attrs.value }),
    });
  } catch {
    return undefined;
  }
}

/** Creates a bounded safe report path without preserving hostile terminal controls. */
function safeReportPath(value: string): string {
  const cleaned = sanitize(value.slice(0, 128))
    .replace(/[\u202a-\u202e\u2066-\u2069]/gu, '')
    .replace(/[\t\n]+/gu, ' ')
    .trim()
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'override';
}

/** Creates one role-specific redundant non-color cue. */
function cueFor(role: KanbanThemeRole): readonly [KanbanNonColorCue, ...KanbanNonColorCue[]] {
  const cues: readonly KanbanNonColorCue[] =
    role === 'card.focused-selected'
      ? [
          { kind: 'marker', glyph: '>' },
          { kind: 'attribute', attrs: Attr.underline },
        ]
      : role.includes('focused')
        ? [{ kind: 'marker', glyph: '>' }]
        : role.includes('selected')
          ? [{ kind: 'marker', glyph: '*' }]
          : role === 'card.read-only'
            ? [{ kind: 'text', prefix: '[RO]' }]
            : role === 'card.grabbed'
              ? [{ kind: 'marker', glyph: '@' }]
              : role === 'card.source-placeholder'
                ? [{ kind: 'border', style: 'dashed' }]
                : role === 'card.ghost'
                  ? [{ kind: 'attribute', attrs: Attr.dim }]
                  : role === 'drop-target.valid'
                    ? [{ kind: 'text', prefix: '+' }]
                    : role.includes('warning')
                      ? [{ kind: 'text', prefix: '!' }]
                      : role.includes('error') || role.includes('invalid') || role.includes('rejected')
                        ? [{ kind: 'text', prefix: 'x' }]
                        : role.includes('pending') || role.includes('refreshing')
                          ? [{ kind: 'text', prefix: '~' }]
                          : role.includes('separator')
                            ? [{ kind: 'border', style: 'single' }]
                            : role === 'checklist.complete'
                              ? [{ kind: 'text', prefix: '[x]' }]
                              : role === 'checklist.incomplete'
                                ? [{ kind: 'text', prefix: '[ ]' }]
                                : role === 'checklist.progress'
                                  ? [{ kind: 'text', prefix: '%' }]
                                  : [{ kind: 'attribute', attrs: Attr.bold }];
  return Object.freeze(cues.map((cue) => Object.freeze(cue))) as readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];
}

/** Reads one all-or-nothing explicit role override without invoking nested accessors. */
function readOverride(value: unknown, mapped: ThemeRole): Readonly<Partial<ThemeRole>> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length === 0 || keys.some((key) => !OVERRIDE_FIELDS.has(key))) return undefined;
    const result: { fg?: Color; bg?: Color; hotkey?: Color; attrs?: number } = {};
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !('value' in descriptor)) return undefined;
      if (key === 'attrs') {
        if (!Number.isSafeInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > MAX_ATTR_MASK) {
          return undefined;
        }
        result.attrs = descriptor.value;
      } else {
        if (!isColor(descriptor.value)) return undefined;
        if (key === 'fg') result.fg = descriptor.value;
        else if (key === 'bg') result.bg = descriptor.value;
        else result.hotkey = descriptor.value;
      }
    }
    return Object.freeze({ ...mapped, ...result });
  } catch {
    return undefined;
  }
}

/** Safely enumerates caller overrides as own property descriptors. */
function overrideDescriptors(overrides: KanbanThemeOverrides | undefined): PropertyDescriptorMap {
  if (overrides === undefined || typeof overrides !== 'object' || overrides === null) return {};
  try {
    return Object.getOwnPropertyDescriptors(overrides);
  } catch {
    return {};
  }
}

/**
 * Resolves a complete immutable Kanban palette and bounded rejection evidence.
 *
 * @example
 * ```ts
 * const { theme, report } = resolveKanbanTheme(classicTheme, {
 *   'content.status': { fg: '#000000', bg: '#ffffff' },
 * });
 * ```
 */
export function resolveKanbanTheme(coreTheme: Theme, overrides?: KanbanThemeOverrides): ResolvedKanbanTheme {
  const descriptors = overrideDescriptors(overrides);
  const rejected: string[] = [];
  for (const key of Object.keys(descriptors)) {
    if (!THEME_ROLE_SET.has(key)) rejected.push(safeReportPath(key));
  }

  const roles = {} as Record<KanbanThemeRole, KanbanThemeToken>;
  for (const role of KANBAN_THEME_ROLES) {
    const mappedRole = CORE_ROLE_BY_KANBAN[role];
    const mapped = readCoreRole(coreTheme, mappedRole) ?? EMERGENCY_STYLE;
    const terminal = readCoreRole(coreTheme, TERMINAL_ROLE_BY_KANBAN[role]) ?? EMERGENCY_STYLE;
    const overrideDescriptor = descriptors[role];
    let style = mapped;
    if (overrideDescriptor !== undefined) {
      if (!('value' in overrideDescriptor)) {
        rejected.push(role);
      } else {
        const override = readOverride(overrideDescriptor.value, mapped);
        if (override === undefined) rejected.push(role);
        else style = freezeStyle(override as ThemeRole);
      }
    }
    const accentFallback = role.startsWith('card.accent-') ? roles['card.normal'] : undefined;
    roles[role] = Object.freeze({
      style: freezeStyle(style),
      mappedFallback: freezeStyle(accentFallback?.style ?? mapped),
      terminalFallback: freezeStyle(accentFallback?.terminalFallback ?? terminal),
      cues: cueFor(role),
    });
  }
  const report: KanbanThemeResolutionReport = Object.freeze({
    rejected: Object.freeze([...new Set(rejected)].slice(0, KANBAN_THEME_ROLES.length + 32)),
    adjustments: Object.freeze([]),
  });
  return Object.freeze({
    theme: Object.freeze({ contractVersion: 1, roles: Object.freeze(roles) }),
    report,
  });
}

/**
 * Creates the complete immutable Kanban semantic palette for a Core theme.
 *
 * @example
 * ```ts
 * const kanbanTheme = createKanbanTheme(classicTheme);
 * ```
 */
export function createKanbanTheme(coreTheme: Theme, overrides?: KanbanThemeOverrides): KanbanTheme {
  return resolveKanbanTheme(coreTheme, overrides).theme;
}

/** Converts a resolvable color to its effective terminal-depth reference color. */
function effectiveColor(color: Color, capabilities: KanbanThemeCapabilities): Color | undefined {
  let rgb;
  try {
    rgb = toRgb(color);
  } catch {
    return undefined;
  }
  if (rgb === null) return undefined;
  if (capabilities.colorDepth === 'truecolor') return color;
  if (capabilities.colorDepth === '16') return ANSI16_ORDER[nearest16(rgb)];
  if (capabilities.colorDepth === '256') {
    const effective = rgb256(nearest256(rgb));
    return `#${effective.r.toString(16).padStart(2, '0')}${effective.g.toString(16).padStart(2, '0')}${effective.b
      .toString(16)
      .padStart(2, '0')}`;
  }
  return undefined;
}

/** Returns effective-depth contrast, or undefined when terminal colors are unknowable. */
function effectiveContrast(style: ThemeRole, capabilities: KanbanThemeCapabilities): number | undefined {
  const fg = effectiveColor(style.fg, capabilities);
  const bg = effectiveColor(style.bg, capabilities);
  if (fg === undefined || bg === undefined) return undefined;
  const ratio = contrastRatio(fg, bg);
  return Number.isFinite(ratio) ? ratio : undefined;
}

/**
 * Resolves one dynamic semantic role through the explicit, mapped, family, and emergency chain.
 *
 * Unknown application values never become drawing identities; the allowlisted fallback role is used
 * instead. Monochrome and explicit no-color modes retain attributes and cues without claiming a
 * numeric color contrast.
 *
 * @example
 * ```ts
 * const focused = resolveKanbanThemeRole(theme, 'card.focused', 'card.normal', {
 *   colorDepth: '16',
 * });
 * ```
 */
export function resolveKanbanThemeRole(
  theme: KanbanTheme,
  requestedRole: unknown,
  fallbackRole: KanbanThemeRole,
  capabilities: KanbanThemeCapabilities,
): KanbanResolvedThemeRole {
  const requestedKnown = typeof requestedRole === 'string' && THEME_ROLE_SET.has(requestedRole);
  const role = requestedKnown ? (requestedRole as KanbanThemeRole) : fallbackRole;
  const requestedToken = theme.roles[role];
  const token = requestedToken ?? theme.roles['card.normal'];
  const cues = Object.freeze(token.cues.map((cue) => Object.freeze({ ...cue }))) as readonly [
    KanbanNonColorCue,
    ...KanbanNonColorCue[],
  ];
  if (capabilities.noColor === true || capabilities.colorDepth === 'mono') {
    return Object.freeze({
      role,
      style: freezeStyle(token.mappedFallback),
      cues,
      fallback: 'mapped-core',
    });
  }

  const candidates: readonly {
    readonly style: ThemeRole;
    readonly fallback: KanbanResolvedThemeRole['fallback'];
  }[] = [
    { style: token.style, fallback: requestedKnown && requestedToken !== undefined ? 'none' : 'family' },
    { style: token.mappedFallback, fallback: 'mapped-core' },
    { style: token.terminalFallback, fallback: 'family' },
    { style: EMERGENCY_STYLE, fallback: 'emergency' },
  ];
  for (const candidate of candidates) {
    const ratio = effectiveContrast(candidate.style, capabilities);
    if (ratio !== undefined && ratio >= 4.5) {
      return Object.freeze({
        role,
        style: freezeStyle(candidate.style),
        cues,
        fallback: candidate.fallback,
        contrastRatio: ratio,
      });
    }
  }
  return Object.freeze({
    role,
    style: freezeStyle(EMERGENCY_STYLE),
    cues,
    fallback: 'emergency',
    contrastRatio: 21,
  });
}
