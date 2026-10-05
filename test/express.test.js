// Express behaviors the app relies on beyond routing (see routes.test.js), with stubbed controllers
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { startServer } = require('./helpers');

let server;

before(async () => {
  server = await startServer({ preload: [path.join(__dirname, 'stub-controllers.js')] });
});

after(() => server?.stop());

test('an error thrown by an async controller answers 500, the server keeps running', async () => {
  const res = await fetch(`${server.url}/async-error/contributors.svg`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 500);
  const next = await fetch(`${server.url}/babel/contributors.svg`);
  assert.equal(next.status, 200);
});

test('HEAD requests are answered by GET routes, without a body', async () => {
  for (const url of ['/', '/robots.txt', '/babel/contributors.svg', '/static/images/contribute.svg']) {
    const res = await fetch(`${server.url}${url}`, { method: 'HEAD' });
    assert.equal(res.status, 200, url);
    assert.equal((await res.arrayBuffer()).byteLength, 0, url);
  }
});

test('static files: no path traversal', async () => {
  for (const url of ['/static/../package.json', '/static/%2e%2e/package.json', '/static/..%2fpackage.json']) {
    const res = await fetch(`${server.url}${url}`);
    assert.equal(res.status, 404, url);
  }
});

test('static files: unknown file 404, POST not allowed on routes', async () => {
  assert.equal((await fetch(`${server.url}/static/images/nope.svg`)).status, 404);
  assert.equal((await fetch(`${server.url}/babel/contributors.svg`, { method: 'POST' })).status, 404);
});

test('client IP: X-Forwarded-For is trusted through Cloudflare and private proxies only', async () => {
  const ip = async (forwardedFor) => {
    const res = await fetch(`${server.url}/babel/contributors.svg`, { headers: { 'x-forwarded-for': forwardedFor } });
    return (await res.json()).ip;
  };
  // client, Cloudflare, Heroku router (private network); the test connects from loopback
  assert.equal(await ip('203.0.113.7, 173.245.48.1, 10.1.2.3'), '203.0.113.7');
  assert.equal(await ip('203.0.113.7, 2606:4700::1'), '203.0.113.7');
  // An address outside Cloudflare's ranges in the chain is the client: anything before it could be spoofed
  assert.equal(await ip('203.0.113.7, 198.51.100.9'), '198.51.100.9');
});
