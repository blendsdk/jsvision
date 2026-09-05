/** Story: passive GroupBox layout, caption, nesting, reactivity, role, and shadow states. */
import { Button, Group, GroupBox, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Interactive GroupBox comparison for the kitchen-sink component navigator. */
export const groupBoxStory: Story = {
  id: 'containers/group-box',
  category: 'Containers',
  title: 'GroupBox',
  blurb: 'Passive framed groups: compare caption alignment, nesting, live titles, theme roles, clipping, and shadow.',
  build(ctx: StoryContext) {
    const moduleCount = signal(2);
    const feedback = signal('Press Alt+A or Space to add a module.');
    const canvas = new Group();
    const leftWidth = Math.floor((ctx.width - 5) / 2);
    const rightX = leftWidth + 3;
    const rightWidth = ctx.width - rightX - 2;

    const application = new GroupBox({ title: 'Application', titleAlignment: 'start', padding: 1 });
    const modules = new GroupBox({ title: () => `Modules: ${moduleCount()}`, titleAlignment: 'center', padding: 1 });
    modules.add(at(new Text('Core\nUI'), 0, 0, 10, 2));
    application.add(at(modules, 0, 0, leftWidth - 2, 4));
    application.add(
      at(
        new Button('~A~dd module', {
          onClick: () => {
            const next = moduleCount() + 1;
            moduleCount.set(next);
            feedback.set(`Added module ${next}`);
          },
        }),
        1,
        4,
        17,
        2,
      ),
    );
    application.add(at(new Text(() => feedback()), 1, 7, leftWidth - 4, 1));
    canvas.add(at(application, 1, 0, leftWidth, 11));

    const alignedEnd = new GroupBox({ title: 'End', titleAlignment: 'end', role: 'labelSelected', padding: 1 });
    alignedEnd.add(at(new Text('A non-default role colors the frame and fill together.'), 0, 0, rightWidth - 2, 2));
    canvas.add(at(alignedEnd, rightX, 0, rightWidth, 5));

    const clipped = new GroupBox({
      title: '界界 Deployment modules with a deliberately long caption',
      titleAlignment: 'end',
      padding: 1,
      shadow: true,
    });
    clipped.add(at(new Text('Shadow spacing belongs to the parent layout.'), 0, 0, rightWidth - 2, 2));
    canvas.add(at(clipped, rightX, 7, rightWidth, 6));

    canvas.add(
      at(
        new Text('Tab focuses the button · Alt+A/Space updates the nested caption.'),
        1,
        ctx.height - 2,
        ctx.width - 2,
        1,
      ),
    );
    return canvas;
  },
};
