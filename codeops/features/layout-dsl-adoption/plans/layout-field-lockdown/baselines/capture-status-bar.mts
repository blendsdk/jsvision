import { createRenderRoot, createRoot } from '@jsvision/ui';
import { resolveCapabilities } from '@jsvision/core';
import { statusBarStory } from '../../../../../../packages/examples/kitchen-sink/stories/status-bar.story.js';

const ctx = { width: 80, height: 24 };
createRoot((dispose) => {
  const view = statusBarStory.build(ctx as never);
  view.setLayout({ position: 'absolute', rect: { x: 0, y: 0, ...ctx } });
  const rr = createRenderRoot(ctx, { caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor', unicode: { utf8: true } } }).profile });
  rr.mount(view);
  const out: string[] = [`status-bar.story @ ${ctx.width}x${ctx.height}`, '-'.repeat(ctx.width)];
  for (const row of rr.buffer().rows()) out.push(row.map((c) => c.char).join('').replace(/\s+$/, ''));
  process.stdout.write(out.join('\n') + '\n');
  dispose();
});
