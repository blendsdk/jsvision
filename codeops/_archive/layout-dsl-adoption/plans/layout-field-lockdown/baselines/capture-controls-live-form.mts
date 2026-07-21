import { createRenderRoot, createRoot } from '@jsvision/ui';
import { resolveCapabilities } from '@jsvision/core';
import { buildDialog } from '../../../../../../packages/examples/controls-live/form.js';

const ctx = { width: 58, height: 19 };
createRoot((dispose) => {
  const { dialog } = buildDialog();
  dialog.setLayout({ position: 'absolute', rect: { x: 0, y: 0, ...ctx } });
  const rr = createRenderRoot(ctx, {
    caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor', unicode: { utf8: true } } }).profile,
  });
  rr.mount(dialog);
  const out: string[] = [`controls-live/form @ ${ctx.width}x${ctx.height}`, '-'.repeat(ctx.width)];
  for (const row of rr.buffer().rows()) out.push(row.map((c) => c.char).join('').replace(/\s+$/, ''));
  process.stdout.write(out.join('\n') + '\n');
  dispose();
});
