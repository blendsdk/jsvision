import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';

/** Additional target-state probes implemented by the application-family runner. */
export type ApplicationProbe = StandardProbe | 'nested-window-count' | 'nested-window-max-height' | 'menu-titles';

/** View behavior: a custom view owns drawing, focus, input, and reactive repaint feedback. */
export const VIEW_CONTRACT = defineBehaviorContract<
  'custom-drawing' | 'focus-and-input' | 'reactive-repaint',
  ApplicationProbe
>({
  exampleId: 'foundations/view',
  capabilities: ['custom-drawing', 'focus-and-input', 'reactive-repaint'],
  cases: [
    {
      id: 'activate-custom-view',
      covers: ['custom-drawing', 'focus-and-input', 'reactive-repaint'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Canvas state: idle' },
        { probe: 'rendered-text', operator: 'contains', value: '◇ idle' },
      ],
      actions: [{ kind: 'key', key: 'k', modifiers: ['Alt'] }],
      expected: [
        { probe: 'focused-view', operator: 'equals', value: 'DemoView' },
        { probe: 'rendered-text', operator: 'contains', value: 'Canvas state: active' },
        { probe: 'rendered-text', operator: 'contains', value: '◆ ACTIVE' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Group behavior: child composition preserves order and supports deterministic dynamic content. */
export const GROUP_CONTRACT = defineBehaviorContract<
  'child-composition' | 'paint-order' | 'dynamic-children',
  ApplicationProbe
>({
  exampleId: 'foundations/group',
  capabilities: ['child-composition', 'paint-order', 'dynamic-children'],
  cases: [
    {
      id: 'add-overlay-child',
      covers: ['child-composition', 'paint-order', 'dynamic-children'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Children: Base, Detail' },
        { probe: 'rendered-text', operator: 'excludes', value: 'OVERLAY — last child paints in front' },
      ],
      actions: [{ kind: 'key', key: 'a', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Children: Base, Detail, Overlay' },
        { probe: 'rendered-text', operator: 'contains', value: 'OVERLAY — last child paints in front' },
        { probe: 'rendered-text', operator: 'excludes', value: 'Detail paints after Base' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Application behavior: app-wide key bindings dispatch commands and expose enablement changes. */
export const APPLICATION_CONTRACT = defineBehaviorContract<
  'command-dispatch' | 'command-enablement' | 'application-keymap',
  ApplicationProbe
>({
  exampleId: 'application/application',
  capabilities: ['command-dispatch', 'command-enablement', 'application-keymap'],
  cases: [
    {
      id: 'dispatch-enabled-command',
      covers: ['command-dispatch', 'application-keymap'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Command: ready · runs 0' }],
      actions: [{ kind: 'key', key: 'r', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Command: ran · runs 1' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'disable-command',
      covers: ['command-enablement'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Run enabled: yes' }],
      actions: [
        { kind: 'key', key: 'e', modifiers: ['Alt'] },
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Run enabled: no' },
        { probe: 'rendered-text', operator: 'contains', value: 'runs 0' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Desktop behavior: window activation and arrangement remain visible inside the shell lab. */
export const DESKTOP_CONTRACT = defineBehaviorContract<
  'window-activation' | 'z-order' | 'arrangement',
  ApplicationProbe
>({
  exampleId: 'application/desktop',
  capabilities: ['window-activation', 'z-order', 'arrangement'],
  cases: [
    {
      id: 'activate-next-window',
      covers: ['window-activation', 'z-order'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Active: Inspector · front: Inspector' }],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Active: Editor · front: Editor' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'tile-windows',
      covers: ['arrangement'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Layout: overlapping' },
        { probe: 'nested-window-max-height', operator: 'equals', value: 7 },
      ],
      actions: [{ kind: 'key', key: 't', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Layout: tiled' },
        { probe: 'nested-window-max-height', operator: 'less-than', value: 7 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Router behavior: push, back, replace, and reset expose a predictable typed navigation stack. */
export const ROUTER_CONTRACT = defineBehaviorContract<'push' | 'back' | 'replace' | 'reset', ApplicationProbe>({
  exampleId: 'application/router',
  capabilities: ['push', 'back', 'replace', 'reset'],
  cases: [
    {
      id: 'push-detail',
      covers: ['push'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: home · canGoBack: no' }],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: detail · canGoBack: yes' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'back-to-home',
      covers: ['back'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: home · canGoBack: no' }],
      actions: [
        { kind: 'key', key: 'n', modifiers: ['Alt'] },
        { kind: 'key', key: 'b', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: home · canGoBack: no' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'replace-current-route',
      covers: ['replace'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: home · canGoBack: no' }],
      actions: [{ kind: 'key', key: 'p', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: settings · canGoBack: no' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reset-stack',
      covers: ['reset'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: home · canGoBack: no' }],
      actions: [
        { kind: 'key', key: 'n', modifiers: ['Alt'] },
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Route: home · canGoBack: no' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Window behavior: activation, zoom/restore, and close enablement are taught without losing the lab. */
export const WINDOW_CONTRACT = defineBehaviorContract<
  'active-state' | 'zoom-and-restore' | 'close-policy',
  ApplicationProbe
>({
  exampleId: 'application/window',
  capabilities: ['active-state', 'zoom-and-restore', 'close-policy'],
  cases: [
    {
      id: 'zoom-and-restore-window',
      covers: ['active-state', 'zoom-and-restore'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Window: active · restored' }],
      actions: [{ kind: 'key', key: 'z', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Window: active · zoomed' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'protected-window-stays-open',
      covers: ['close-policy'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Close policy: protected' },
        { probe: 'nested-window-count', operator: 'equals', value: 1 },
      ],
      actions: [{ kind: 'key', key: 'c', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Close blocked: laboratory stays open' },
        { probe: 'nested-window-count', operator: 'equals', value: 1 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** MenuBar behavior: keyboard navigation, accelerators, and dynamic items dispatch visible commands. */
export const MENU_BAR_CONTRACT = defineBehaviorContract<
  'keyboard-menu' | 'item-accelerator' | 'dynamic-items',
  ApplicationProbe
>({
  exampleId: 'application/menu-bar',
  capabilities: ['keyboard-menu', 'item-accelerator', 'dynamic-items'],
  cases: [
    {
      id: 'run-menu-command',
      covers: ['keyboard-menu', 'item-accelerator'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Menu command: none' }],
      actions: [
        { kind: 'key', key: 'l', modifiers: ['Alt'] },
        { kind: 'key', key: 'o', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Menu command: Open' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'add-dynamic-menu',
      covers: ['dynamic-items'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Menus: File, Help' },
        { probe: 'menu-titles', operator: 'contains', value: 'File, Help' },
      ],
      actions: [{ kind: 'key', key: 'd', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Menus: File, Tools, Help' },
        { probe: 'menu-titles', operator: 'contains', value: 'File, Tools, Help' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** StatusLine behavior: command hints, enablement, and pointer/keyboard activation stay observable. */
export const STATUS_LINE_CONTRACT = defineBehaviorContract<
  'command-hints' | 'command-enablement' | 'keyboard-activation',
  ApplicationProbe
>({
  exampleId: 'application/status-line',
  capabilities: ['command-hints', 'command-enablement', 'keyboard-activation'],
  cases: [
    {
      id: 'activate-status-command',
      covers: ['command-hints', 'keyboard-activation'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Status action: none' }],
      actions: [{ kind: 'key', key: 's', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Status action: Save' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'disable-status-command',
      covers: ['command-enablement'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Save enabled: yes' }],
      actions: [{ kind: 'key', key: 'e', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Save enabled: no' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Complete immutable page population for the foundations and application-shell wave. */
export const APPLICATION_CATALOG_ENTRY_IDS = [
  'foundations/view',
  'foundations/group',
  'application/application',
  'application/desktop',
  'application/router',
  'application/window',
  'application/menu-bar',
  'application/status-line',
] as const;

/** Complete immutable runnable-example population for the foundations and application-shell wave. */
export const APPLICATION_EXAMPLE_IDS = [...APPLICATION_CATALOG_ENTRY_IDS] as const;

/** Contracts authored before the eight foundations and application-shell examples. */
export const APPLICATION_CONTRACTS = [
  VIEW_CONTRACT,
  GROUP_CONTRACT,
  APPLICATION_CONTRACT,
  DESKTOP_CONTRACT,
  ROUTER_CONTRACT,
  WINDOW_CONTRACT,
  MENU_BAR_CONTRACT,
  STATUS_LINE_CONTRACT,
] as const;
