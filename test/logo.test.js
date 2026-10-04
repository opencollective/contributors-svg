// GitHub avatars (/github/:username/avatar…), with the real controller: sharp resizing and styles,
// and the Content-Type from mime-types. GitHub is stubbed.
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');

const sharp = require('sharp');

const { startServer } = require('./helpers');

let server;

before(async () => {
  server = await startServer({ preload: [path.join(__dirname, 'stub-github-avatars.js')] });
});

after(() => server?.stop());

const get = async (url) => {
  const res = await fetch(`${server.url}${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  return { res, body, meta: res.ok ? await sharp(body).metadata() : null };
};

test('rounded avatar: PNG at the requested height, with transparency', async () => {
  const { res, meta } = await get('/github/octocat/avatar/rounded/64.png');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=86400');
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 64);
  assert.equal(meta.height, 64);
  assert.equal(meta.hasAlpha, true);
});

test('height from the query, default style', async () => {
  const { res, meta } = await get('/github/octocat/avatar.png?height=32');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(meta.height, 32);
});

test('default height: 128', async () => {
  const { meta } = await get('/github/octocat/avatar.png');
  assert.equal(meta.height, 128);
});

test('uppercase extension: still a PNG', async () => {
  const { res, meta } = await get('/github/octocat/avatar/64.PNG');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(meta.format, 'png');
});

test('missing GitHub user: 404', async () => {
  const { res } = await get('/github/ghost/avatar/rounded/64.png');
  assert.equal(res.status, 404);
});
