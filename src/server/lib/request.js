import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { fetchExternal } from './fetch';

const CACHE_DIR = '/tmp/cached-requests';
const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

const getCachePath = (url) => {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(CACHE_DIR, hash);
};

const readCache = async (url) => {
  try {
    const filePath = getCachePath(url);
    const stat = await fs.stat(filePath);
    if (Date.now() - stat.mtimeMs > oneDayInMilliseconds) {
      await fs.unlink(filePath);
      return null;
    }
    const cached = JSON.parse(await fs.readFile(filePath, 'utf8'));
    cached.body = Buffer.from(cached.body, 'base64');
    return cached;
  } catch {
    return null;
  }
};

const writeCache = async (url, response) => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(getCachePath(url), JSON.stringify({ ...response, body: response.body.toString('base64') }));
  } catch {
    // Silently ignore cache write failures
  }
};

// Fetches an image (our own avatar route, the contribute button): `{ statusCode, headers, body }`
// with a Buffer body. Successful responses are cached on disk for a day when ENABLE_CACHED_REQUEST
// is set, like cached-request did.
export const imageRequest = async (url) => {
  if (process.env.ENABLE_CACHED_REQUEST) {
    const cached = await readCache(url);
    if (cached) {
      return cached;
    }
  }

  const fetchResponse = await fetchExternal(url);
  const response = {
    statusCode: fetchResponse.status,
    statusMessage: fetchResponse.statusText,
    headers: Object.fromEntries(fetchResponse.headers.entries()),
    body: Buffer.from(await fetchResponse.arrayBuffer()),
  };

  if (process.env.ENABLE_CACHED_REQUEST && fetchResponse.ok) {
    await writeCache(url, response);
  }

  return response;
};
