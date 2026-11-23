// fetchContributors: API lookup, GitHub fetch through the queue (p-queue, 5 at a time), cache.
// The API (lib/graphql) and GitHub (lib/github) are stubbed; the in-memory cache is used.
require('@babel/register');

const assert = require('node:assert/strict');
const path = require('node:path');
const { beforeEach, test } = require('node:test');

delete process.env.REDIS_URL;

const lib = path.join(__dirname, '..', 'src', 'server', 'lib');
const stub = (file, exports) => {
  const filename = path.join(lib, file);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: { __esModule: true, ...exports } };
};

const collectives = {};
const calls = { graphql: 0, org: [], repo: [] };
let running = 0;
let maxRunning = 0;

const githubData = async (contributorData) => {
  running++;
  maxRunning = Math.max(maxRunning, running);
  await new Promise((resolve) => setTimeout(resolve, 150));
  running--;
  return { contributorData };
};

stub('graphql.js', {
  graphqlRequest: async (query, { collectiveSlug }) => {
    calls.graphql++;
    if (!collectives[collectiveSlug]) {
      // The API's error for an unknown slug, which the banner controller turns into a 404
      throw new Error(`No collective found with slug ${collectiveSlug}`);
    }
    return { account: collectives[collectiveSlug] };
  },
});
stub('github.js', {
  getOrgData: async (org) => {
    calls.org.push(org);
    return githubData({ alice: 3, bob: 10, carol: 1 });
  },
  getRepoData: async (options) => {
    calls.repo.push(options);
    return githubData({ dave: 2 });
  },
});

const { fetchContributors } = require('../src/server/lib/contributors');

beforeEach(() => {
  calls.graphql = 0;
  calls.org = [];
  calls.repo = [];
  maxRunning = 0;
});

test('organization: contributors sorted by contributions, then served from the cache', async () => {
  collectives.babel = { id: 1, slug: 'babel', githubHandle: 'babel', settings: {} };
  const contributors = await fetchContributors({ collectiveSlug: 'Babel' });
  assert.deepEqual(Object.keys(contributors), ['bob', 'alice', 'carol']);
  assert.deepEqual(calls.org, ['babel']);

  const again = await fetchContributors({ collectiveSlug: 'babel' });
  assert.deepEqual(again, contributors);
  assert.equal(calls.graphql, 1);
});

test('repository: owner and repo from githubHandle', async () => {
  collectives.webpack = { id: 2, slug: 'webpack', githubHandle: 'webpack/webpack-cli', settings: {} };
  const contributors = await fetchContributors({ collectiveSlug: 'webpack' });
  assert.deepEqual(Object.keys(contributors), ['dave']);
  assert.deepEqual(calls.repo, [{ owner: 'webpack', repo: 'webpack-cli' }]);
});

test('GitHub fetches run through the queue, at most 5 at a time', async () => {
  const slugs = Array.from({ length: 8 }, (_, i) => `collective-${i}`);
  for (const slug of slugs) {
    collectives[slug] = { id: slug, slug, githubHandle: `org-${slug}`, settings: {} };
  }
  const results = await Promise.all(slugs.map((collectiveSlug) => fetchContributors({ collectiveSlug })));
  assert.equal(results.length, 8);
  assert.equal(calls.org.length, 8);
  assert.equal(maxRunning, 5);
});

test('unknown slug: fails with the API error, without fetching GitHub', async () => {
  await assert.rejects(fetchContributors({ collectiveSlug: 'no-such-collective' }), /No collective found/);
  assert.equal(calls.graphql, 1);
  assert.deepEqual(calls.org, []);
  assert.deepEqual(calls.repo, []);
});

const cache = require('../src/server/lib/cache').default;

const DAY = 24 * 60 * 60 * 1000;

const waitFor = async (check) => {
  for (let i = 0; i < 50; i++) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out');
};

test('fresh entry: served without calling the API', async () => {
  collectives.fresh = { id: 3, slug: 'fresh', githubHandle: 'fresh', settings: {} };
  await cache.set('contributors_fresh', { contributors: { erin: 4 }, fetchedAt: Date.now() - 1000 }, 60);
  assert.deepEqual(await fetchContributors({ collectiveSlug: 'fresh' }), { erin: 4 });
  assert.equal(calls.graphql, 0);
  assert.deepEqual(calls.org, []);
});

test('stale entry: served at once, refreshed once in the background', async () => {
  collectives.stale = { id: 4, slug: 'stale', githubHandle: 'stale', settings: {} };
  await cache.set('contributors_stale', { contributors: { erin: 4 }, fetchedAt: Date.now() - 2 * DAY }, 60);

  const results = await Promise.all([1, 2, 3].map(() => fetchContributors({ collectiveSlug: 'stale' })));
  for (const contributors of results) {
    assert.deepEqual(contributors, { erin: 4 });
  }

  await waitFor(async () => (await cache.get('contributors_stale')).fetchedAt > Date.now() - DAY);
  assert.deepEqual(Object.keys(await fetchContributors({ collectiveSlug: 'stale' })), ['bob', 'alice', 'carol']);
  assert.equal(calls.graphql, 1);
  assert.deepEqual(calls.org, ['stale']);
});

test('entry from before fetchedAt: served, then refreshed', async () => {
  collectives.legacy = { id: 5, slug: 'legacy', githubHandle: 'legacy', settings: {} };
  await cache.set('contributors_legacy', { erin: 4 }, 60);

  assert.deepEqual(await fetchContributors({ collectiveSlug: 'legacy' }), { erin: 4 });
  await waitFor(async () => (await cache.get('contributors_legacy')).fetchedAt);
  assert.deepEqual(Object.keys(await fetchContributors({ collectiveSlug: 'legacy' })), ['bob', 'alice', 'carol']);
});

test('stale entry of an account gone from the API: still served, the refresh error is logged', async () => {
  await cache.set('contributors_gone', { contributors: { erin: 4 }, fetchedAt: Date.now() - 2 * DAY }, 60);
  assert.deepEqual(await fetchContributors({ collectiveSlug: 'gone' }), { erin: 4 });
  await waitFor(() => calls.graphql === 1);
  assert.deepEqual(await fetchContributors({ collectiveSlug: 'gone' }), { erin: 4 });
});
