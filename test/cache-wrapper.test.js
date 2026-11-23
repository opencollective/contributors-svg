// The cache wrapper (lib/cache): a failing provider is logged and treated as a miss, never thrown
require('@babel/register');

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

delete process.env.REDIS_URL;

const filename = path.join(__dirname, '..', 'src', 'server', 'lib', 'cache', 'memory.js');
const fail = async () => {
  throw new Error('Connection lost');
};
require.cache[filename] = {
  id: filename,
  filename,
  loaded: true,
  exports: { __esModule: true, default: () => ({ clear: fail, del: fail, get: fail, has: fail, set: fail }) },
};

const cache = require('../src/server/lib/cache').default;

test('provider errors are swallowed', async () => {
  assert.equal(await cache.get('a'), undefined);
  assert.equal(await cache.has('a'), undefined);
  assert.equal(await cache.set('a', 1, 60), undefined);
  assert.equal(await cache.del('a'), undefined);
  assert.equal(await cache.clear(), undefined);
});
