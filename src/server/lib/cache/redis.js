import debug from 'debug';
import { createClient } from 'redis';

import { logger } from '../../logger';

const debugCache = debug('cache');

const makeRedisProvider = ({ serverUrl }) => {
  serverUrl = serverUrl.replace('://h:', '://:'); // Remove fake username that used to be added by Heroku
  const options = { url: serverUrl };
  if (serverUrl.includes('rediss://')) {
    // Heroku Redis uses a self-signed certificate
    options.socket = { tls: true, rejectUnauthorized: false };
  }
  const client = createClient(options);
  // Without a listener, a connection error would crash the process. The client reconnects on its own.
  client.on('error', (err) => logger.warn(`Redis error: ${err.message || err.code}`));
  // Commands sent before the connection is ready are queued
  client.connect().catch((err) => logger.error(`Redis connection failed: ${err.message}`));

  return {
    clear: async () => client.flushAll(),
    del: async (key) => client.del(key),
    get: async (key, { unserialize = JSON.parse } = {}) => {
      const value = await client.get(key);
      if (value) {
        try {
          return unserialize(value);
        } catch (err) {
          debugCache(`Invalid JSON (${value}): ${err}`);
        }
      } else {
        return undefined;
      }
    },
    has: async (key) => {
      const value = await client.get(key);
      return value !== null;
    },
    set: async (key, value, expirationInSeconds, { serialize = JSON.stringify } = {}) => {
      if (value !== undefined) {
        if (expirationInSeconds) {
          return client.set(key, serialize(value), { EX: expirationInSeconds });
        } else {
          return client.set(key, serialize(value));
        }
      }
    },
    quit: async () => client.quit(),
  };
};

export default makeRedisProvider;
