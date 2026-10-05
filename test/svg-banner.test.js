// The banner measures every avatar (image-size) to keep its aspect ratio, skips anything that isn't an
// image, and downloads at most 20 avatars at a time (p-limit). Image downloads are stubbed
require('@babel/register');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, test } = require('node:test');

const sharp = require('sharp');

const requestPath = path.join(__dirname, '..', 'src', 'server', 'lib', 'request.js');
const images = {};
let running = 0;
let maxRunning = 0;
require.cache[requestPath] = {
  id: requestPath,
  filename: requestPath,
  loaded: true,
  exports: {
    __esModule: true,
    imageRequest: async (url) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running--;
      const image = images[url.split('/').at(-4)] || images[url];
      return image
        ? { statusCode: 200, body: image.body, headers: { 'content-type': image.type } }
        : { statusCode: 404, body: Buffer.alloc(0), headers: {} };
    },
  },
};

const { generateSvgBanner } = require('../src/server/lib/svg-banner');

const button = path.join(__dirname, '..', 'src', 'static', 'images', 'contribute.svg');

before(async () => {
  // 200x100: rendered 128 wide at the default 64px height
  const wide = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();
  images.wide = { body: wide, type: 'image/png' };
  images.square = { body: await sharp(wide).resize(50, 50).png().toBuffer(), type: 'image/png' };
  images.broken = { body: Buffer.from('not an image'), type: 'image/png' };
  images[button] = { body: fs.readFileSync(button), type: 'image/svg+xml' };
});

const users = (...slugs) => slugs.map((slug) => ({ slug, website: `https://github.com/${slug}` }));

const imageTags = (svg) =>
  [...svg.matchAll(/<a [^>]*id="([^"]+)"><image x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map(
    ([, id, x, y, width, height]) => ({ id, x: +x, y: +y, width: +width, height: +height }),
  );

test('avatars keep their aspect ratio, broken and missing images are skipped', async () => {
  const svg = await generateSvgBanner(users('wide', 'broken', 'missing', 'square'), {
    limit: Infinity,
    collectiveSlug: 'babel',
  });
  assert.deepEqual(imageTags(svg), [
    { id: 'wide', x: 5, y: 5, width: 128, height: 64 },
    { id: 'square', x: 138, y: 5, width: 64, height: 64 },
  ]);
  assert.match(svg, /^<svg [^>]*width="207" height="74"/);
});

test('the contribute button (SVG) is measured too', async () => {
  const { width, height } = await sharp(images[button].body).metadata();
  const svg = await generateSvgBanner(users('square'), {
    limit: Infinity,
    collectiveSlug: 'babel',
    buttonImage: button,
  });
  const tags = imageTags(svg);
  assert.equal(tags.length, 2);
  assert.deepEqual(tags[1], { id: 'babel', x: 74, y: 5, width: Math.round((width / height) * 64), height: 64 });
});

test('wraps to a new line at the requested width', async () => {
  const svg = await generateSvgBanner(users('square', 'square', 'square'), {
    limit: Infinity,
    collectiveSlug: 'babel',
    width: 150,
  });
  assert.deepEqual(
    imageTags(svg).map(({ x, y }) => [x, y]),
    [
      [5, 5],
      [74, 5],
      [5, 74],
    ],
  );
});

test('downloads at most 20 avatars at a time', async () => {
  maxRunning = 0;
  const svg = await generateSvgBanner(users(...Array.from({ length: 30 }, () => 'square')), {
    limit: Infinity,
    collectiveSlug: 'babel',
  });
  assert.equal(imageTags(svg).length, 30);
  assert.equal(maxRunning, 20);
});
