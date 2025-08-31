import * as http from "http";
import * as pty from 'node-pty';

const term = pty.spawn("gemini", [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

let accumulatedOutput = '';

term.onData((data: string) => {
  accumulatedOutput += data;
  process.stdout.write(data);
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
  if (req.method === 'POST' && req.url === '/command') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      term.write(body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Command sent to PTY\n');
    });
  } else if (req.method === 'GET' && req.url === '/output') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(accumulatedOutput || 'No output yet\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

server.listen(3000, () => {
  console.log('HTTP server listening on port 3000');
});