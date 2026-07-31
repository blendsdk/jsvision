/**
 * Deterministic clipboard-boundary laboratory for the Keyboard & clipboard course.
 *
 * The application uses only in-memory virtual adapters. Learners compare canonical-first copy,
 * host authorization states, real native-read fallback, and stale asynchronous delivery without
 * granting the docs page access to a visitor clipboard.
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
const VIRTUAL_HOST_TEXT = 'virtual host result';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 15;

type ReadMode = 'success' | 'failure' | 'pending';

/** Focused command target that owns canonical copy and receives real paste events. */
class ClipboardTarget extends View {
  constructor(
    private readonly setCopy: (authorization: ClipboardAuthorization, source: 'keyboard' | 'mouse') => void,
    private readonly receivePaste: (text: string, truncated: boolean) => void,
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
    if (event.event.type === 'command' && event.event.command === CMD_COPY) {
      event.setClipboard?.(CLIPBOARD_SAMPLE);
      this.setCopy(this.authorization(), event.event.arg === 'mouse' ? 'mouse' : 'keyboard');
      event.handled = true;
      return;
    }
    if (event.event.type === 'paste') {
      this.receivePaste(event.event.text, event.event.truncated);
      event.handled = true;
    }
  }
}

export default defineExample({
  title: 'Clipboard Boundary Laboratory',
  blurb: 'Compare canonical copy, virtual host authorization, real failure fallback, and stale async delivery.',
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
      const copy = signal('Copy: local ready > host not attempted');
      const hostWrite = signal('Host write: not attempted');
      const paste = signal('Paste: ready');
      const diagnostic = signal('Diagnostic: none');
      const nativeRead = signal('Native read: idle');
      const reason = signal('Reason: none');
      const actionSource = signal('Action source: keyboard');
      const hostReads = signal(0);
      const pasteEvents = signal(0);
      let nextReadMode: ReadMode = 'success';
      let pendingResolve: ((text: string) => void) | null = null;
      let readScheduled = false;
      let resolutionRequested = false;
      let seeding = true;

      // The virtual wrapper is always installed so the browser host can never replace it with a
      // visitor bridge. Its unavailable branch deliberately performs no bridge call and emits no
      // failure, matching the public browser clipboard helper.
      app.loop.writeClipboardText = () => {
        const state = authorization.peek();
        if (state === 'unavailable') {
          hostWrite.set('Host write: unavailable (no bridge call)');
          return;
        }
        hostWrite.set(`Host write: ${state === 'authorized' ? 'success' : 'denied'}`);
        if (state === 'denied') throw new Error('virtual host rejected clipboard write');
      };
      app.loop.readClipboardText = () => {
        hostReads.update((count) => count + 1);
        const mode = nextReadMode;
        nextReadMode = 'success';
        if (mode === 'failure') throw new Error('virtual host read rejected');
        if (mode === 'pending') {
          return new Promise<string>((resolve) => {
            pendingResolve = resolve;
            if (resolutionRequested) {
              resolutionRequested = false;
              pendingResolve = null;
              resolve(VIRTUAL_HOST_TEXT);
            }
          });
        }
        return VIRTUAL_HOST_TEXT;
      };

      const target = new ClipboardTarget(
        (state, source) => {
          canonical.set('Canonical: course sample');
          copy.set(copyOutcome(state));
          diagnostic.set(state === 'denied' ? 'Diagnostic: host clipboard write failed' : 'Diagnostic: none');
          actionSource.set(`Action source: ${source}`);
        },
        (text, truncated) => {
          canonical.set(text === CLIPBOARD_SAMPLE ? 'Canonical: course sample' : 'Canonical: virtual host result');
          if (seeding) return;
          pasteEvents.update((count) => count + 1);
          nativeRead.set('Native read: settled');
          if (text === CLIPBOARD_SAMPLE) {
            paste.set('Paste: canonical fallback');
            diagnostic.set('Diagnostic: host clipboard read failed');
          } else {
            paste.set(truncated ? 'Paste: virtual result accepted (truncated)' : 'Paste: virtual result accepted');
            diagnostic.set('Diagnostic: none');
          }
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
        nextReadMode = 'failure';
        diagnostic.set('Diagnostic: next virtual read will fail');
        paste.set('Paste: ready for canonical fallback');
      });
      const offFallback = app.onCommand(CMD_FALLBACK, () => {
        app.loop.focusView(target);
        nativeRead.set('Native read: pending');
        paste.set('Paste: canonical fallback');
        diagnostic.set('Diagnostic: host clipboard read failed');
        app.loop.emitCommand('paste');
      });
      const offPending = app.onCommand(CMD_PENDING, () => {
        app.loop.focusView(target);
        nextReadMode = 'pending';
        readScheduled = true;
        nativeRead.set('Native read: pending');
        paste.set('Paste: awaiting virtual result');
        reason.set('Reason: awaiting virtual host');
        app.loop.emitCommand('paste');
      });
      const offNext = app.onCommand(CMD_NEXT, () => {
        app.loop.focusView(focusDestination);
        reason.set('Reason: focus changed');
      });
      const offResolve = app.onCommand(CMD_RESOLVE, () => {
        if (!readScheduled) {
          nativeRead.set('Native read: idle');
          paste.set('Paste: no read pending');
          reason.set('Reason: start with Alt+P');
          resolutionRequested = false;
          return;
        }
        readScheduled = false;
        const stale = app.loop.getFocused() !== target;
        nativeRead.set('Native read: settled');
        paste.set(stale ? 'Paste: stale result discarded' : 'Paste: resolving virtual result');
        reason.set(stale ? 'Reason: focus changed' : 'Reason: focus route unchanged');
        const resolve = pendingResolve;
        pendingResolve = null;
        if (resolve === null) {
          resolutionRequested = true;
        } else {
          resolve(VIRTUAL_HOST_TEXT);
        }
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
      content.add(
        at(
          new Text(() => `${nativeRead()} | Host reads: ${hostReads()} | Paste events: ${pasteEvents()}`),
          0,
          8,
          66,
          1,
        ),
      );
      content.add(at(new Text(() => `${reason()} | ${actionSource()}`), 0, 9, 66, 1));
      content.add(at(target, 0, 11, 28, 1));
      content.add(at(focusDestination, 30, 10, 19, 2));
      content.add(at(copyButton, 50, 10, 16, 2));
      content.add(at(new Text('Alt+A auth | Alt+C copy | Alt+F fail + Alt+V real fallback'), 0, 13, 66, 1));
      content.add(at(new Text('Alt+P real pending | Alt+N move focus | Alt+R resolve | mouse Copy'), 0, 14, 66, 1));

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
          offFallback();
          offFailure();
          offAuthorization();
          readScheduled = false;
          resolutionRequested = false;
          pendingResolve = null;
          app.loop.writeClipboardText = undefined;
          app.loop.readClipboardText = undefined;
          disposeLesson();
        }),
      );
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(target);
      // A direct deterministic paste seeds canonical state without attempting any host write.
      app.loop.dispatch({ type: 'paste', text: CLIPBOARD_SAMPLE, truncated: false });
      seeding = false;
      paste.set('Paste: ready');
      return app;
    }),
});
