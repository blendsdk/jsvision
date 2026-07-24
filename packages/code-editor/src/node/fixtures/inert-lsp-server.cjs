'use strict';

let buffered = Buffer.alloc(0);

if (process.argv.includes('--oversized-frame')) {
  process.stdout.write('Content-Length: 4096\r\n\r\n');
}

process.stdin.on('data', (chunk) => {
  buffered = Buffer.concat([buffered, chunk]);
  readMessages();
});

function readMessages() {
  while (true) {
    const headerEnd = buffered.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const header = buffered.subarray(0, headerEnd).toString('ascii');
    const match = /Content-Length: ([0-9]+)/iu.exec(header);
    if (match === null) process.exit(2);
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffered.length < bodyStart + length) return;
    const body = buffered.subarray(bodyStart, bodyStart + length).toString('utf8');
    buffered = buffered.subarray(bodyStart + length);
    handle(JSON.parse(body));
  }
}

function handle(message) {
  if (message.method === 'initialize') {
    respond(message.id, {
      capabilities: {
        hoverProvider: true,
        completionProvider: {},
        documentFormattingProvider: true,
      },
    });
  } else if (message.method === 'textDocument/hover') {
    respond(message.id, { contents: 'inert hover' });
  } else if (message.method === 'shutdown') {
    respond(message.id, null);
  } else if (message.method === 'exit') {
    process.exit(0);
  }
}

function respond(id, result) {
  const body = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
