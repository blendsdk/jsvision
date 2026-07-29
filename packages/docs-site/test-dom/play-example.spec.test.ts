/**
 * Browser-facing specification for the live-example launcher.
 *
 * The test supplies deterministic terminal and resize dependencies through the
 * launcher runtime key. This keeps the oracle focused on DOM behavior: the
 * heavy xterm implementation remains lazy and is covered separately by the
 * controller integration suite.
 */
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import PlayExample from '../.vitepress/theme/components/PlayExample.vue';

const RUNTIME_MODULE_PATH = '../src/play/play-runtime';

interface RuntimeController {
  open(element: HTMLElement): Promise<void>;
  close(): void;
  remount(next: { readonly size?: { readonly width: number; readonly height: number } }): Promise<void>;
  fit(): void;
  sizeInCells(element: HTMLElement): { readonly width: number; readonly height: number } | null;
}

interface RuntimeModule {
  readonly PLAY_RUNTIME_KEY: symbol;
  readonly browserPlayRuntime: {
    createSession(options: {
      readonly id: string;
      readonly size: { readonly width: number; readonly height: number };
      readonly isFocused: () => boolean;
      readonly onFocusChange: (focused: boolean) => void;
      readonly onError: (message: string) => void;
      readonly onClose: () => void;
      readonly loadRememberedSize: () => null;
    }): Promise<RuntimeController | null>;
  };
}

const importEvidence = vi.hoisted(() => ({
  xterm: vi.fn(),
  fit: vi.fn(),
  webgl: vi.fn(),
  controller: vi.fn(),
  registry: vi.fn(),
  stylesheet: vi.fn(),
}));

vi.mock('@xterm/xterm', () => {
  importEvidence.xterm();
  return { Terminal: class Terminal {} };
});
vi.mock('@xterm/addon-fit', () => {
  importEvidence.fit();
  return { FitAddon: class FitAddon {} };
});
vi.mock('@xterm/addon-webgl', () => {
  importEvidence.webgl();
  return { WebglAddon: class WebglAddon {} };
});
vi.mock('@xterm/xterm/css/xterm.css', () => {
  importEvidence.stylesheet();
  return {};
});
vi.mock('../src/play/play-controller.js', () => {
  importEvidence.controller();
  return {
    createPlayController: () => ({
      open: vi.fn(() => Promise.resolve()),
      close: vi.fn(),
      remount: vi.fn(() => Promise.resolve()),
    }),
  };
});
vi.mock('../examples/index.js', () => {
  importEvidence.registry();
  return { EXAMPLES: [{ id: 'controls/button' }] };
});

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertRuntimeModule(value: unknown): asserts value is RuntimeModule {
  if (
    !isRecord(value) ||
    typeof value.PLAY_RUNTIME_KEY !== 'symbol' ||
    !isRecord(value.browserPlayRuntime) ||
    typeof value.browserPlayRuntime.createSession !== 'function'
  ) {
    throw new TypeError('play-runtime must export its injection key and browser runtime');
  }
}

/** Load the public test seam without making the specification depend on its implementation shape. */
async function loadRuntimeModule(): Promise<RuntimeModule> {
  const candidate: unknown = await import(RUNTIME_MODULE_PATH);
  assertRuntimeModule(candidate);
  return candidate;
}

afterEach(() => {
  document.documentElement.style.overflow = '';
  vi.restoreAllMocks();
});

describe('PlayExample DOM contract', () => {
  test('keeps real browser chunks deferred until the browser runtime creates a session', async () => {
    const { browserPlayRuntime } = await loadRuntimeModule();
    expect(Object.values(importEvidence).every((factory) => factory.mock.calls.length === 0)).toBe(true);

    const created = await browserPlayRuntime.createSession({
      id: 'controls/button',
      size: { width: 120, height: 36 },
      isFocused: () => false,
      onFocusChange: () => undefined,
      onError: () => undefined,
      onClose: () => undefined,
      loadRememberedSize: () => null,
    });

    expect(created).not.toBeNull();
    expect(Object.values(importEvidence).every((factory) => factory.mock.calls.length === 1)).toBe(true);
  });

  test('renders labelled prose and loads runtime chunks only after keyboard activation', async () => {
    const { PLAY_RUNTIME_KEY } = await loadRuntimeModule();
    const loadRuntimeChunks = vi.fn();
    const createSession = vi.fn(() => {
      loadRuntimeChunks();
      return Promise.resolve(null);
    });
    const wrapper = mount(PlayExample, {
      props: {
        id: 'controls/button',
        title: 'Button laboratory',
        blurb: 'Explore button states and activation.',
      },
      attachTo: document.body,
      global: {
        provide: {
          [PLAY_RUNTIME_KEY]: {
            isNoKeyboardDevice: () => false,
            createSession,
            createResizeObserver: () => ({ observe: vi.fn(), disconnect: vi.fn() }),
            requestAnimationFrame: (callback: FrameRequestCallback) => callback(0),
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Explore button states and activation.');
    const play = wrapper.get('button.play-button');
    expect(play.attributes('type')).toBe('button');
    expect(play.attributes('aria-label')).toBe('Run the Button laboratory example in a terminal');
    play.element.focus();
    expect(document.activeElement).toBe(play.element);
    expect(createSession).not.toHaveBeenCalled();
    expect(loadRuntimeChunks).not.toHaveBeenCalled();

    await play.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(loadRuntimeChunks).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  test('loads once on activation, exposes resize/reset controls, and disposes before unmount', async () => {
    const { PLAY_RUNTIME_KEY } = await loadRuntimeModule();
    const controller: RuntimeController = {
      open: vi.fn(() => Promise.resolve()),
      close: vi.fn(),
      remount: vi.fn(() => Promise.resolve()),
      fit: vi.fn(),
      sizeInCells: vi.fn(() => ({ width: 120, height: 36 })),
    };
    const resizeObserver = { observe: vi.fn(), disconnect: vi.fn() };
    const createSession = vi.fn(() => Promise.resolve(controller));
    const wrapper = mount(PlayExample, {
      props: { id: 'controls/button', title: 'Button laboratory' },
      attachTo: document.body,
      global: {
        provide: {
          [PLAY_RUNTIME_KEY]: {
            isNoKeyboardDevice: () => false,
            createSession,
            createResizeObserver: () => resizeObserver,
            requestAnimationFrame: (callback: FrameRequestCallback) => callback(0),
          },
        },
      },
    });

    await wrapper.get('button.play-button').trigger('click');
    await wrapper.vm.$nextTick();
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(controller.open).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toContain('Button laboratory');
    expect(resizeObserver.observe).toHaveBeenCalledTimes(1);

    await wrapper.get('button.play-ctl').trigger('click');
    expect(controller.remount).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(controller.close).toHaveBeenCalledTimes(1);
    expect(resizeObserver.disconnect).toHaveBeenCalledTimes(1);
  });
});
