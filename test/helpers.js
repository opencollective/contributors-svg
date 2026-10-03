const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const root = path.join(__dirname, '..');

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

// Starts the server from the source (compiled on the fly by @babel/register, with .babelrc) in its
// own process, and waits until it answers
async function startServer({ preload = [], env = {} } = {}) {
  const port = await getFreePort();
  const requires = ['@babel/register', ...preload].flatMap((module) => ['--require', module]);
  const child = spawn(process.execPath, [...requires, 'src/server/index.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => (output += data));
  child.stderr.on('data', (data) => (output += data));
  let exited = false;
  child.on('exit', () => (exited = true));

  const url = `http://localhost:${port}`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`Server exited before answering:\n${output}`);
    }
    try {
      await fetch(`${url}/robots.txt`);
      return { url, stop: () => child.kill(), output: () => output };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  child.kill();
  throw new Error(`Server did not answer within 15s:\n${output}`);
}

module.exports = { startServer };
