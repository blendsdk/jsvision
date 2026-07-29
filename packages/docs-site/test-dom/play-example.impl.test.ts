/**
 * Browser lifecycle hardening for the lazy live-example launcher.
 *
 * These cases cover implementation races and untrusted persisted state beyond
 * the user-facing DOM specification.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import PlayExample from '../.vitepress/theme/components/PlayExample.vue';
import {
  PLAY_RUNTIME_KEY,
  type PlayResizeObserver,
  type PlayRuntime,
  type PlaySession,
  type PlaySessionOptions,
} from '../src/play/play-runtime';

const SIZE_KEY = 'jsvision:play-modal-size';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

/** Create a manually settled promise for deterministic lifecycle race coverage. */
function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

/** Construct a no-op session whose methods can be inspected by each lifecycle case. */
function session(overrides: Partial<PlaySession> = {}): PlaySession {
  return {
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
    remount: vi.fn(() => Promise.resolve()),
    fit: vi.fn(),
    sizeInCells: vi.fn(() => ({ width: 120, height: 36 })),
    ...overrides,
  };
}

/** Mount one launcher with deterministic browser dependencies. */
function mountPlay(
  createSession: PlayRuntime['createSession'],
  resizeObserver: PlayResizeObserver = { observe: vi.fn(), disconnect: vi.fn() },
): VueWrapper {
  const runtime: PlayRuntime = {
    isNoKeyboardDevice: () => false,
    createSession,
    createResizeObserver: () => resizeObserver,
    requestAnimationFrame: (callback) => {
      callback(0);
      return 0;
    },
  };
  return mount(PlayExample, {
    props: { id: 'controls/button', title: 'Button laboratory' },
    attachTo: document.body,
    global: { provide: { [PLAY_RUNTIME_KEY]: runtime } },
  });
}

afterEach(() => {
  localStorage.removeItem(SIZE_KEY);
  document.documentElement.style.overflow = '';
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('PlayExample lazy lifecycle hardening', () => {
  test('closing while session creation is pending disposes the stale session without opening it', async () => {
    const created = deferred<PlaySession | null>();
    const pendingSession = session();
    const wrapper = mountPlay(() => created.promise);

    await wrapper.get('button.play-button').trigger('click');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await wrapper.get('button.play-close').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');

    created.resolve(pendingSession);
    await flushPromises();
    expect(pendingSession.open).not.toHaveBeenCalled();
    expect(pendingSession.close).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe('');
    wrapper.unmount();
  });

  test('unmounting while session open is pending prevents observer and scroll-lock resurrection', async () => {
    const opened = deferred<void>();
    const pendingSession = session({ open: vi.fn(() => opened.promise) });
    const resizeObserver = { observe: vi.fn(), disconnect: vi.fn() };
    const wrapper = mountPlay(() => Promise.resolve(pendingSession), resizeObserver);

    await wrapper.get('button.play-button').trigger('click');
    await flushPromises();
    expect(pendingSession.open).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(pendingSession.close).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe('');

    opened.resolve(undefined);
    await flushPromises();
    expect(pendingSession.close).toHaveBeenCalledTimes(1);
    expect(resizeObserver.observe).not.toHaveBeenCalled();
    expect(document.documentElement.style.overflow).toBe('');
  });

  test('shows a readable error and keeps close available when lazy session loading rejects', async () => {
    const wrapper = mountPlay(() => Promise.reject(new Error('terminal chunk unavailable')));

    await wrapper.get('button.play-button').trigger('click');
    await flushPromises();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('This example failed to load.');
    expect(alert.text()).toContain('terminal chunk unavailable');
    expect(wrapper.get('button.play-close').exists()).toBe(true);
    wrapper.unmount();
  });

  test.each([
    ['negative', '{"width":-1,"height":24}', null],
    ['fractional', '{"width":80.5,"height":24}', null],
    ['non-finite', '{"width":1e309,"height":24}', null],
    ['undersized', '{"width":1,"height":1}', { width: 40, height: 12 }],
    ['oversized', '{"width":999999,"height":999999}', { width: 240, height: 80 }],
  ])('bounds %s persisted dimensions before session use', async (_label, stored, expected) => {
    localStorage.setItem(SIZE_KEY, stored);
    const createSession = vi.fn((_options: PlaySessionOptions) => Promise.resolve(null));
    const wrapper = mountPlay(createSession);

    await wrapper.get('button.play-button').trigger('click');
    await flushPromises();
    const options = createSession.mock.calls[0]?.[0];
    if (options === undefined) throw new Error('expected Play session options');
    expect(options.loadRememberedSize()).toEqual(expected);
    wrapper.unmount();
  });

  test('reset clears the live host size and remounts at the documented default grid', async () => {
    let widthDuringRemount = 'not-called';
    const mountedSession = session({
      remount: vi.fn(() => {
        widthDuringRemount = document.querySelector<HTMLElement>('.play-term')?.style.width ?? 'missing';
        return Promise.resolve();
      }),
    });
    const wrapper = mountPlay(() => Promise.resolve(mountedSession));

    await wrapper.get('button.play-button').trigger('click');
    await flushPromises();
    const host = wrapper.get<HTMLElement>('.play-term').element;
    host.style.width = '900px';
    host.style.height = '600px';
    await wrapper.get('button.play-ctl').trigger('click');
    await flushPromises();

    expect(widthDuringRemount).toBe('');
    expect(mountedSession.remount).toHaveBeenCalledWith({ size: { width: 120, height: 36 } });
    wrapper.unmount();
  });
});
