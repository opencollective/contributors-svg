import { LRUCache } from 'lru-cache';

const makeMemoryProvider = (opts) => {
  const lruCache = new LRUCache(opts);
  return {
    clear: async () => lruCache.clear(),
    del: async (key) => lruCache.delete(key),
    get: async (key) => lruCache.get(key),
    has: async (key) => lruCache.has(key),
    set: async (key, value, expirationInSeconds) => lruCache.set(key, value, { ttl: expirationInSeconds * 1000 }),
  };
};

export default makeMemoryProvider;
