// Image downloads for the banner: response shape, no internal headers, and the file cache enabled by
// ENABLE_CACHED_REQUEST (on in production)
require('@babel/register');

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, beforeEach, test } = require('node:test');

const { imageRequest } = require('../src/server/lib/request');

let server;
let baseUrl;
const hits = {};
const received = {};

before(async () => {
  server = http.createServer((req, res) => {
    hits[req.url] = (hits[req.url] || 0) + 1;
    received[req.url] = req.headers;
    if (req.url.endsWith('/missing.png')) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    } else {
      res.writeHead(200, { 'content-type': 'image/png' }).end(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff]));
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  // A unique path per run, so that the file cache of a previous run is never hit
  baseUrl = `http://localhost:${server.address().port}/${process.pid}-${Date.now()}`;
});

after(() => server.close());

beforeEach(() => {
  delete process.env.ENABLE_CACHED_REQUEST;
});

test('returns status, headers and a Buffer body', async () => {
  const res = await imageRequest(`${baseUrl}/a.png`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/png');
  assert.ok(Buffer.isBuffer(res.body));
  assert.deepEqual([...res.body], [0x89, 0x50, 0x4e, 0x47, 0xff]);
});

test('does not send the oc-* headers meant for the API', async () => {
  process.env.OC_SECRET = 'secret';
  process.env.OC_APPLICATION = 'contributors-svg';
  await imageRequest(`${baseUrl}/headers.png`);
  const headers = received[new URL(`${baseUrl}/headers.png`).pathname];
  assert.equal(headers['oc-secret'], undefined);
  assert.equal(headers['oc-application'], undefined);
  assert.equal(headers['user-agent'], 'contributors-svg/1.0');
});

test('with ENABLE_CACHED_REQUEST, serves successful responses from the cache', async () => {
  process.env.ENABLE_CACHED_REQUEST = '1';
  const url = `${baseUrl}/cached.png`;
  const first = await imageRequest(url);
  const second = await imageRequest(url);
  assert.equal(hits[new URL(url).pathname], 1);
  assert.equal(second.statusCode, 200);
  assert.equal(second.headers['content-type'], 'image/png');
  assert.deepEqual(second.body, first.body);
});

test('with ENABLE_CACHED_REQUEST, errors are not cached', async () => {
  process.env.ENABLE_CACHED_REQUEST = '1';
  const url = `${baseUrl}/missing.png`;
  assert.equal((await imageRequest(url)).statusCode, 404);
  assert.equal((await imageRequest(url)).statusCode, 404);
  assert.equal(hits[new URL(url).pathname], 2);
});

test('without ENABLE_CACHED_REQUEST, always fetches', async () => {
  const url = `${baseUrl}/uncached.png`;
  await imageRequest(url);
  await imageRequest(url);
  assert.equal(hits[new URL(url).pathname], 2);
});
