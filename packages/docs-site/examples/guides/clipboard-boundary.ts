/**
 * Deterministic clipboard-boundary laboratory for the Keyboard & clipboard course.
 *
 * The application uses only an in-memory virtual adapter. Learners compare canonical-first copy,
 * host authorization states, failure fallback, and stale asynchronous delivery without granting
 * the docs page access to a visitor clipboard.
 */
import {
  Button,
  Group,
  Text,
  View,
  at,
  createKeymap,
  createRoot,
  signal,
  type DispatchEvent,
  type DrawContext,
} from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import {
  CLIPBOARD_SAMPLE,
  copyOutcome,
  nextClipboardAuthorization,
  type ClipboardAuthorization,
} from '../../src/example-fixtures/keyboard-and-clipboard/boundary.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_AUTH = 'clipboard-boundary.authorization';
const CMD_COPY = 'clipboard-boundary.copy';
const CMD_FAIL = 'clipboard-boundary.fail-read';
const CMD_FALLBACK = 'clipboard-boundary.fallback';
const CMD_PENDING = 'clipboard-boundary.pending';
const CMD_NEXT = 'clipboard-boundary.next-focus';
const CMD_RESOLVE = 'clipboard-boundary.resolve';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 15;

/** Focused command target that owns canonical copy and fallback paste actions. */
class ClipboardTarget extends View {
  constructor(
    private readonly setCopy: (authorization: ClipboardAuthorization, source: 'keyboard' | 'mouse') => void,
    private readonly setFallback: (text: string) => void,
    private readonly authorization: () => ClipboardAuthorization,
  ) {
    super();
    this.focusable = true;
  }

  override draw(ctx: DrawContext): void {
    const role = this.state.focused ? 'buttonFocused' : 'button';
    const label = this.state.focused ? 'Clipboard target [FOCUSED]' : 'Clipboard target';
    ctx.fill(' ', ctx.color(role));
    ctx.text(0, 0, label, ctx.color(role));
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type !== 'command') return;
    if (event.event.command === CMD_COPY) {
      event.setClipboard?.(CLIPBOARD_SAMPLE);
      this.setCopy(this.authorization(), event.event.arg === 'mouse' ? 'mouse' : 'keyboard');
      event.handled = true;
      return;
    }
    if (event.event.command === CMD_FALLBACK) {
      this.setFallback(event.readClipboard?.() ?? '');
      event.handled = true;
    }
  }
}

export default defineExample({
  title: 'Clipboard Boundary Laboratory',
  blurb: 'Compare canonical copy, virtual host authorization, failure fallback, and stale async delivery.',
  build: (ctx) =>
    createRoot((disposeReactive) => {
      let active = true;
      const disposeLesson = (): void => {
        if (!active) return;
        active = false;
        disposeReactive();
      };
      ctx.onCleanup?.(disposeLesson);

      const app = demoApp(ctx, {
        themeMenu: true,
        keymap: createKeymap({
          'alt+a': CMD_AUTH,
          'alt+c': CMD_COPY,
          'alt+f': CMD_FAIL,
          'alt+v': CMD_FALLBACK,
          'alt+p': CMD_PENDING,
          'alt+n': CMD_NEXT,
          'alt+r': CMD_RESOLVE,
        }),
      });
      const authorization = signal<ClipboardAuthorization>('unavailable');
      const canonical = signal('(empty)');
      const copy = signal('Copy: ready');
      const hostWrite = signal('Host write: not attempted');
      const paste = signal('Paste: ready');
      const diagnostic = signal('Diagnostic: none');
      const nativeRead = signal('Native read: idle');
      const reason = signal('Reason: none');
      const actionSource = signal('Action source: keyboard');
      let pendingFocus: View | null = null;

      app.loop.writeClipboardText = () => {
        const state = authorization.peek();
        hostWrite.set(`Host write: ${state === 'authorized' ? 'success' : state}`);
        if (state !== 'authorized') throw new Error('virtual host rejected clipboard write');
      };

      const target = new ClipboardTarget(
        (state, source) => {
          canonical.set('Canonical: course sample');
          copy.set(copyOutcome(state));
          diagnostic.set(state === 'authorized' ? 'Diagnostic: none' : 'Diagnostic: host clipboard write failed');
          actionSource.set(`Action source: ${source}`);
        },
        (text) => {
          paste.set(text === CLIPBOARD_SAMPLE ? 'Paste: canonical fallback' : 'Paste: empty fallback');
          diagnostic.set('Diagnostic: host clipboard read failed');
        },
        () => authorization(),
      );
      const focusDestination = new Button('Focus destination', {
        onClick: () => reason.set('Reason: focus changed by mouse'),
      });
      const copyButton = new Button('~C~opy sample', {
        onClick: () => {
          app.loop.focusView(target);
          app.loop.emitCommand(CMD_COPY, 'mouse');
        },
      });

      const offAuthorization = app.onCommand(CMD_AUTH, () => {
        authorization.update(nextClipboardAuthorization);
        hostWrite.set('Host write: not attempted');
        diagnostic.set('Diagnostic: none');
      });
      const offFailure = app.onCommand(CMD_FAIL, () => {
        diagnostic.set('Diagnostic: next host read will fail safely');
        paste.set('Paste: ready for canonical fallback');
      });
      const offPending = app.onCommand(CMD_PENDING, () => {
        pendingFocus = app.loop.getFocused();
        nativeRead.set('Native read: pending');
        reason.set('Reason: awaiting virtual host');
      });
      const offNext = app.onCommand(CMD_NEXT, () => {
        app.loop.focusView(focusDestination);
        reason.set('Reason: focus changed');
      });
      const offResolve = app.onCommand(CMD_RESOLVE, () => {
        const stale = pendingFocus !== null && app.loop.getFocused() !== pendingFocus;
        nativeRead.set('Native read: settled');
        paste.set(stale ? 'Paste: stale result discarded' : 'Paste: virtual result accepted');
        reason.set(stale ? 'Reason: focus changed' : 'Reason: focus route unchanged');
        pendingFocus = null;
      });

      const content = new Group();
      content.add(at(new Text('Host seam: virtual'), 0, 0, 25, 1));
      content.add(at(new Text('Visitor clipboard: never requested'), 28, 0, 38, 1));
      content.add(at(new Text(() => `Authorization: ${authorization()}`), 0, 2, 32, 1));
      content.add(at(new Text(() => canonical()), 34, 2, 32, 1));
      content.add(at(new Text(() => copy()), 0, 4, 66, 1));
      content.add(at(new Text(() => hostWrite()), 0, 5, 66, 1));
      content.add(at(new Text(() => paste()), 0, 6, 66, 1));
      content.add(at(new Text(() => diagnostic()), 0, 7, 66, 1));
      content.add(at(new Text(() => `${nativeRead()} | ${reason()}`), 0, 8, 66, 1));
      content.add(at(new Text(() => actionSource()), 0, 9, 66, 1));
      content.add(at(target, 0, 11, 28, 1));
      content.add(at(focusDestination, 30, 10, 19, 2));
      content.add(at(copyButton, 50, 10, 16, 2));
      content.add(at(new Text('Alt+A auth | Alt+C copy | Alt+F fail + Alt+V fallback'), 0, 13, 66, 1));
      content.add(at(new Text('Alt+P pending | Alt+N move focus | Alt+R resolve | mouse Copy'), 0, 14, 66, 1));

      const dialog = new Template1Dialog({
        title: ' Clipboard Boundary Laboratory ',
        width: CONTENT_WIDTH + 4,
        height: CONTENT_HEIGHT + 4,
        preserveChildHeights: (view) =>
          view instanceof Text || view instanceof Button || view instanceof ClipboardTarget,
      });
      dialog.onMount(() =>
        dialog.onCleanup(() => {
          offResolve();
          offNext();
          offPending();
          offFailure();
          offAuthorization();
          app.loop.writeClipboardText = undefined;
          disposeLesson();
        }),
      );
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(target);
      // Seed the canonical clipboard through the same public command route used by the lesson.
      // This keeps the failure exercise deterministic even when it is the learner's first action.
      app.loop.emitCommand(CMD_COPY);
      return app;
    }),
});
