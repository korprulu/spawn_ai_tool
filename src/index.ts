import * as http from "http";
import * as pty from 'node-pty';

const term = pty.spawn("gemini", [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

const sseClients: http.ServerResponse[] = [];

term.onData((data: string) => {
  process.stdout.write(data);
  // Send new data to all SSE clients
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
});

term.onExit(({ exitCode }: { exitCode: number }) => {
  console.log(`PTY exited with code ${exitCode}`);
  process.exit(exitCode);
});

process.stdin.setRawMode(true);
process.stdin.on('data', (data) => {
  term.write(data.toString());
});

const server = http.createServer((req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/command') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      term.write(body);
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'access-control-allow-origin': '*'
      });
      res.end('Command sent to PTY\n');
    });
  } else if (req.method === 'GET' && req.url === '/output') {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    res.write('data: connected\n\n');
    // Add to clients
    sseClients.push(res);
    req.on('close', () => {
      const index = sseClients.indexOf(res);
      if (index > -1) sseClients.splice(index, 1);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

server.listen(3000, () => {
  console.log('HTTP server listening on port 3000');
});