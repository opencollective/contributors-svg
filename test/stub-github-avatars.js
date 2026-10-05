// Preloaded with `node --require`: replaces node-fetch with a stub serving GitHub avatars, so the
// logo tests need no network. `ghost` is a missing user.
const path = require('node:path');

const sharp = require('sharp');

const nodeFetchPath = require.resolve('node-fetch', { paths: [path.join(__dirname, '..', 'src')] });

const avatar = sharp({ create: { width: 460, height: 460, channels: 3, background: '#36c' } })
  .png()
  .toBuffer();

const fetch = async (url) => {
  if (!url.startsWith('https://avatars.githubusercontent.com/')) {
    throw new Error(`Unexpected request in tests: ${url}`);
  }
  if (url.startsWith('https://avatars.githubusercontent.com/ghost?')) {
    return { ok: false, status: 404, statusText: 'Not Found' };
  }
  const body = await avatar;
  // Only the standard Body methods: node-fetch 3 deprecates response.buffer()
  const arrayBuffer = async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  return { ok: true, status: 200, statusText: 'OK', arrayBuffer };
};

require.cache[nodeFetchPath] = {
  id: nodeFetchPath,
  filename: nodeFetchPath,
  loaded: true,
  exports: Object.assign(fetch, { default: fetch, __esModule: true }),
};
