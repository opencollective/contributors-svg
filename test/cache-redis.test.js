// The Redis cache, used in production (REDIS_URL). Needs a Redis server that can be flushed:
// TEST_REDIS_URL (CI runs one), skipped otherwise
require('@babel/register');

const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const makeRedisProvider = require('../src/server/lib/cache/redis').default;

const { TEST_REDIS_URL } = process.env;

describe('Redis cache', { skip: !TEST_REDIS_URL && 'TEST_REDIS_URL is not set' }, () => {
  let cache;

  before(async () => {
    cache = makeRedisProvider({ serverUrl: TEST_REDIS_URL });
    await cache.clear();
  });

  after(() => cache.quit());

  test('set, get, has and del, JSON serialized', async () => {
    await cache.set('a', { x: 1, list: ['y'] }, 60);
    assert.deepEqual(await cache.get('a'), { x: 1, list: ['y'] });
    assert.equal(await cache.has('a'), true);
    await cache.del('a');
    assert.equal(await cache.get('a'), undefined);
    assert.equal(await cache.has('a'), false);
  });

  test('set without expiration, undefined is not stored', async () => {
    await cache.set('b', 2);
    assert.equal(await cache.get('b'), 2);
    await cache.set('c', undefined, 60);
    assert.equal(await cache.has('c'), false);
  });

  test('entries expire after expirationInSeconds', async () => {
    await cache.set('d', 'value', 1);
    assert.equal(await cache.get('d'), 'value');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(await cache.get('d'), undefined);
  });

  test('clear', async () => {
    await cache.set('e', 1, 60);
    await cache.clear();
    assert.equal(await cache.get('e'), undefined);
  });

  test('invalid JSON is read as undefined', async () => {
    await cache.set('f', 'not json', 60, { serialize: (value) => value });
    assert.equal(await cache.get('f'), undefined);
  });
});
