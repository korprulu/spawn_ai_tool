import * as pty from 'node-pty';
import * as WebSocket from "ws";

const term = pty.spawn("gemini", [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

const wss = new WebSocket.Server({ port: 3000 });
const wsClients: WebSocket[] = [];

wss.on('connection', (ws: WebSocket) => {
  console.log('WebSocket client connected');
  wsClients.push(ws);

  ws.on('message', (message: Buffer) => {
    const command = message.toString();
    console.log('Received command:', command);
    term.write(command);
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    const index = wsClients.indexOf(ws);
    if (index > -1) {
      wsClients.splice(index, 1);
    }
  });

  // Send initial connection message
  ws.send('Connected to PTY terminal\n');
});

term.onData((data: string) => {
  process.stdout.write(data);

  // Send new data to all WebSocket clients
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
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

console.log('WebSocket server listening on port 3000');