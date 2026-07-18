/**
 * `playground` — the absolute minimal `@jsvision/ui` application shell.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples playground
 *
 * The smallest complete application: a menu bar, a status line, one window with
 * a line of text, and a quit path (Alt-X). Terminal capabilities are
 * auto-detected, and every symbol imports from the single `@jsvision/ui`
 * package. Use this file as a scratchpad for trying things out.
 */
/// <reference types="node" />
import {
  Commands,
  createApplication,
  item,
  menuBar,
  separator,
  statusItem,
  statusLine,
  subMenu,
  Text,
  Window,
} from '@jsvision/ui';

/** Compose and run the application until quit; returns the process exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'playground needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples playground\n',
    );
    return 0;
  }

  const app = createApplication({
    menuBar: menuBar([
      subMenu('\u2261', [item('~W~elcome', Commands.ok, 'F1'), separator(), item('E~x~it', Commands.quit, 'Alt-X')]),
      subMenu('~F~ile', [
        //
        item('E~x~it', Commands.quit, 'Alt-X'),
      ]),
    ]),
    statusLine: statusLine([
      statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
      statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    ]),
  });

  const win = new Window('Playground');
  win.layout.rect = { x: 2, y: 1, width: 40, height: 10 };
  win.castsShadow = true;

  const hello = new Text('Hello from the jsvision playground!');
  hello.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 36, height: 1 } };
  win.add(hello);

  app.desktop.addWindow(win);

  return app.run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
