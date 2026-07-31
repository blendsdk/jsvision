import { createApplication } from '@jsvision/ui';
import { buildBrowserCaps, mountApp } from '@jsvision/web';
import { expect, test } from 'vitest';

test('mount disposal releases input and resize subscriptions when the terminal has no disposer', () => {
  let dataHandler: ((data: string) => void) | undefined;
  let resizeHandler: ((size: { cols: number; rows: number }) => void) | undefined;
  const term = {
    write: (_data: string) => undefined,
    onData: (handler: (data: string) => void) => {
      dataHandler = handler;
      return { dispose: () => (dataHandler = undefined) };
    },
    onResize: (handler: (size: { cols: number; rows: number }) => void) => {
      resizeHandler = handler;
      return { dispose: () => (resizeHandler = undefined) };
    },
  };
  const caps = buildBrowserCaps();
  const app = createApplication({ caps, viewport: { width: 20, height: 6 } });
  const mounted = mountApp({ element: { tagName: 'DIV' }, app, caps, term });
  expect(dataHandler).toBeDefined();
  expect(resizeHandler).toBeDefined();

  mounted.dispose();
  expect(dataHandler).toBeUndefined();
  expect(resizeHandler).toBeUndefined();
});
