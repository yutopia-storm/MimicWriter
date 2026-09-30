import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const server = await createServer({
  server: { host: '127.0.0.1', port: 5173, strictPort: false }
});
await server.listen();

const address = server.httpServer?.address();
if (!address || typeof address === 'string') throw new Error('Vite did not provide a local development address.');
const developmentUrl = `http://127.0.0.1:${address.port}`;
console.log(`Renderer ready at ${developmentUrl}`);

const desktop = spawn(electronPath, ['.'], {
  cwd: process.cwd(),
  env: { ...process.env, VITE_DEV_SERVER_URL: developmentUrl },
  stdio: 'inherit'
});

let closing = false;
async function close(exitCode = 0) {
  if (closing) return;
  closing = true;
  if (!desktop.killed) desktop.kill();
  await server.close();
  process.exitCode = exitCode;
}

desktop.once('exit', (code) => void close(code ?? 0));
desktop.once('error', (error) => {
  console.error(`Unable to launch Electron: ${error.message}`);
  void close(1);
});
process.once('SIGINT', () => void close(0));
process.once('SIGTERM', () => void close(0));
