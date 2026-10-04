// The in-memory cache, used when REDIS_URL is not set. The cache wrapper logs and swallows provider
// errors, so a broken provider doesn't crash: the banner would wait for contributors that never
// get cached and answer 503
require('@babel/register');

const assert = require('node:assert/strict');
const { test } = require('node:test');

const makeMemoryProvider = require('../src/server/lib/cache/memory').default;

test('set, get, has, del and clear', async () => {
  const cache = makeMemoryProvider({ max: 10 });
  await cache.set('a', { x: 1 }, 60);
  await cache.set('b', 2, 60);
  assert.deepEqual(await cache.get('a'), { x: 1 });
  assert.equal(await cache.has('a'), true);
  await cache.del('a');
  assert.equal(await cache.get('a'), undefined);
  assert.equal(await cache.has('a'), false);
  await cache.clear();
  assert.equal(await cache.get('b'), undefined);
});

test('entries expire after expirationInSeconds', async () => {
  const cache = makeMemoryProvider({ max: 10 });
  await cache.set('a', 1, 0.2);
  assert.equal(await cache.get('a'), 1);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(await cache.get('a'), undefined);
});

test('keeps at most max entries', async () => {
  const cache = makeMemoryProvider({ max: 2 });
  await cache.set('a', 1, 60);
  await cache.set('b', 2, 60);
  await cache.set('c', 3, 60);
  assert.equal(await cache.get('a'), undefined);
  assert.equal(await cache.get('c'), 3);
});
