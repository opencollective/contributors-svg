// The banner controller: contributors in order of contributions, skipped users left out.
// The contributors (lib/contributors) and the SVG (lib/svg-banner) are stubbed
require('@babel/register');

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const lib = path.join(__dirname, '..', 'src', 'server', 'lib');
const stub = (file, exports) => {
  const filename = path.join(lib, file);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: { __esModule: true, ...exports } };
};

let contributors = {};
let rendered;
stub('contributors.js', { fetchContributors: async () => contributors });
stub('svg-banner.js', {
  generateSvgBanner: async (list) => {
    rendered = list;
    return '<svg></svg>';
  },
});

const banner = require('../src/server/controllers/banner').default;

const render = async (query = {}) => {
  const res = { setHeader: () => {}, send: () => {}, status: () => res };
  await banner({ params: { collectiveSlug: 'babel' }, query }, res);
  return rendered.map((contributor) => contributor.slug);
};

test('contributors in order of contributions, also with numeric logins', async () => {
  // A login that looks like an integer is always the first key of an object
  contributors = { alice: 50, bob: 20, 2428513107: 3, 42: 1 };
  assert.deepEqual(await render(), ['alice', 'bob', '2428513107', '42']);
});

test('skipped users are left out', async () => {
  contributors = { alice: 50, bob: 20, 42: 1 };
  assert.deepEqual(await render({ skip: 'bob,42' }), ['alice']);
});
