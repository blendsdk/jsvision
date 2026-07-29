/**
 * Interactive signal-graph laboratory for the Reactive state guide.
 *
 * The lesson exposes writable sources, one memoized derivation, and an observing effect together.
 * Individual and batched actions make the scheduler's run count visible without adding a second
 * demonstration-only state system.
 */
import { Button, Group, Text, at, batch, computed, effect, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;

export default defineExample({
  title: 'Reactive Signal Graph Lab',
  blurb: 'Change source signals and batch a paired update while the computed total and effect trace react.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const price = signal(10);
    const quantity = signal(2);
    const total = computed(() => price() * quantity());
    const effectRuns = signal(0);
    const lastObserved = signal('');
    const action = signal('ready: change one source or run the paired batch');

    effect(() => {
      const currentTotal = total();
      const snapshot = `effect observed $${price.peek()} × ${quantity.peek()} = $${currentTotal}`;
      effectRuns.set(effectRuns.peek() + 1);
      lastObserved.set(snapshot);
    });

    const raisePrice = new Button('Raise ~p~rice', {
      onClick: () => {
        price.update((value) => value + 2);
        action.set('single write: price notified its dependents');
      },
    });
    const addQuantity = new Button('Add ~q~uantity', {
      onClick: () => {
        quantity.update((value) => value + 1);
        action.set('single write: quantity notified its dependents');
      },
    });
    const batchSale = new Button('~B~atch sale', {
      onClick: () => {
        batch(() => {
          price.set(9);
          quantity.set(3);
        });
        action.set('batch: price + quantity, one effect');
      },
    });
    const reset = new Button('~R~eset', {
      onClick: () => {
        batch(() => {
          price.set(10);
          quantity.set(2);
        });
        action.set('reset batched to one consistent snapshot');
      },
    });

    const content = new Group();
    content.add(at(new Text('Writable sources feed one lazy derived value and one imperative observer.'), 0, 0, 66, 1));
    content.add(at(new Text(() => `price signal\n$${price()}`), 0, 2, 18, 2));
    content.add(at(new Text(() => `quantity signal\nQty ${quantity()}`), 22, 2, 18, 2));
    content.add(at(new Text(() => `total computed\n$${total()}`), 44, 2, 18, 2));
    content.add(at(new Text(() => lastObserved()), 0, 5, 66, 1));
    content.add(at(new Text(() => `Effect runs: ${effectRuns()} · ${action()}`), 0, 6, 66, 1));
    content.add(at(raisePrice, 0, 8, 15, 2));
    content.add(at(addQuantity, 17, 8, 17, 2));
    content.add(at(batchSale, 36, 8, 14, 2));
    content.add(at(reset, 52, 8, 12, 2));
    content.add(
      at(new Text('Alt+P/Q changes one source · Alt+B writes both inside batch() · Alt+R resets'), 0, 11, 66, 1),
    );
    content.add(
      at(new Text('Maximize or resize: reactive values stay live while the shared dialog reflows.'), 0, 13, 66, 1),
    );

    const dialog = new Template1Dialog({
      title: ' Reactive Signal Graph Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
