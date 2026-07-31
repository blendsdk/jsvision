/**
 * Capture one deployed JSVision live-example modal as a README screenshot.
 *
 * The docs page may scroll before opening an example, so fixed viewport crops are unreliable. This
 * helper connects to headless Chrome, resets the page scroll, measures `.play-modal`, and captures
 * that exact element. Outputs are deliberately restricted to `assets/readme/*.png`.
 *
 * Usage:
 *   node scripts/capture-readme-example.mjs \
 *     'https://blendsdk.github.io/jsvision/apps/matrix?example=apps%2Fmatrix' \
 *     assets/readme/matrix-rain.png
 *
 * Set `CHROME_BIN` when Chrome is installed somewhere other than `/usr/bin/google-chrome`.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';

const DEBUG_PORT = 9333;
const PAGE_WIDTH = 1440;
const PAGE_HEIGHT = 1000;
const LOAD_WAIT_MS = 8000;
const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const README_ASSET_DIRECTORY = resolve(REPOSITORY_ROOT, 'assets/readme');

/** Wait without blocking Chrome's debugging messages. */
function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

/** Accept the deployed docs site and local preview servers, but reject unrelated capture targets. */
function validateExampleUrl(value) {
  const url = new URL(value);
  const isDeployedDocs =
    url.protocol === 'https:' && url.hostname === 'blendsdk.github.io' && url.pathname.startsWith('/jsvision/');
  const isLocalPreview = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (!isDeployedDocs && !isLocalPreview) {
    throw new Error('URL must target the deployed JSVision docs or a local HTTP preview');
  }
  if (!url.searchParams.has('example')) throw new Error('URL must include an example query parameter');
  return url.href;
}

/** Resolve one lowercase PNG name inside the repository's README asset directory. */
function validateOutputPath(value) {
  const output = resolve(REPOSITORY_ROOT, value);
  if (dirname(output) !== README_ASSET_DIRECTORY || !/^[a-z0-9-]+\.png$/u.test(basename(output))) {
    throw new Error('output must be a lowercase assets/readme/*.png path');
  }
  return output;
}

/** Poll Chrome until it exposes the HTTP page target created for the requested example. */
async function findPageTarget() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      const target = targets.find((candidate) => candidate.type === 'page' && candidate.url.startsWith('http'));
      if (target !== undefined) return target;
    } catch {
      // Chrome has not opened its debugging endpoint yet.
    }
    await delay(100);
  }
  throw new Error('Chrome did not expose the example page');
}

/** Build a request/response helper over one Chrome DevTools Protocol WebSocket. */
function createProtocolClient(socket) {
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id === undefined) return;
    const handlers = pending.get(message.id);
    if (handlers === undefined) return;
    pending.delete(message.id);
    if (message.error === undefined) handlers.resolve(message.result);
    else handlers.reject(new Error(message.error.message));
  });

  return (method, params = {}) =>
    new Promise((resolveRequest, rejectRequest) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
      socket.send(JSON.stringify({ id, method, params }));
    });
}

/** Wait for Vue to mount and open the requested live-example modal, then return its viewport bounds. */
async function findModalBounds(send) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const evaluation = await send('Runtime.evaluate', {
      expression: `(() => {
        const element = document.querySelector('.play-modal');
        if (element === null) return null;
        const bounds = element.getBoundingClientRect();
        return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
      })()`,
      returnByValue: true,
    });
    const bounds = evaluation.result.value;
    if (bounds !== null && bounds !== undefined) return bounds;
    await delay(100);
  }
  throw new Error('live-example modal was not found');
}

/** Remove Chrome's temporary profile after its helper processes finish releasing files. */
async function removeProfile(profile) {
  await delay(1000);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (error) {
    process.stderr.write(`warning: could not remove temporary Chrome profile ${profile}: ${String(error)}\n`);
  }
}

/** Launch Chrome, capture the live-example modal, and write the resulting PNG. */
async function captureExample(url, output) {
  const profile = mkdtempSync(join(tmpdir(), 'jsvision-chrome-'));
  const chromeBinary = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
  const chrome = spawn(
    chromeBinary,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${PAGE_WIDTH},${PAGE_HEIGHT}`,
      '--force-device-scale-factor=1',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      url,
    ],
    { stdio: 'ignore' },
  );
  const chromeExited = new Promise((resolveExit) => chrome.once('exit', resolveExit));

  try {
    const target = await findPageTarget();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true });
      socket.addEventListener('error', rejectOpen, { once: true });
    });
    const send = createProtocolClient(socket);

    await send('Page.enable');
    await send('Runtime.enable');
    await delay(LOAD_WAIT_MS);
    await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
    await delay(250);
    const bounds = await findModalBounds(send);

    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { ...bounds, scale: 1 },
    });
    writeFileSync(output, Buffer.from(screenshot.data, 'base64'));
    socket.close();
  } finally {
    chrome.kill('SIGTERM');
    await Promise.race([chromeExited, delay(2000)]);
    await removeProfile(profile);
  }
}

/** Validate CLI arguments and perform one capture. */
async function main() {
  const [urlValue, outputValue, ...extra] = process.argv.slice(2);
  if (urlValue === undefined || outputValue === undefined || extra.length !== 0) {
    throw new Error('usage: node scripts/capture-readme-example.mjs URL assets/readme/NAME.png');
  }
  const url = validateExampleUrl(urlValue);
  const output = validateOutputPath(outputValue);
  await captureExample(url, output);
  process.stdout.write(`captured ${relative(REPOSITORY_ROOT, output)}\n`);
}

main().catch((error) => {
  process.stderr.write(`capture failed: ${String(error)}\n`);
  process.exitCode = 1;
});
