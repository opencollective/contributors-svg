// Starts the whole server with its real controllers: catches code that crashes at boot (e.g. a
// router rejecting a path pattern, or a compile setup leaving ES modules)
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const { startServer } = require('./helpers');

let server;

before(async () => {
  server = await startServer();
});

after(() => server?.stop());

test('home page', async () => {
  const res = await fetch(`${server.url}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Contributors\.svg server/);
});

test('robots.txt', async () => {
  const res = await fetch(`${server.url}/robots.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  assert.equal(await res.text(), 'User-agent: *\nAllow: /');
});

test('static files', async () => {
  const res = await fetch(`${server.url}/static/images/contribute.svg`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^image\/svg\+xml/);
});

test('unknown route', async () => {
  const res = await fetch(`${server.url}/nope`);
  assert.equal(res.status, 404);
});
