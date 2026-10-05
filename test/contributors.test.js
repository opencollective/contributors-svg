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
    return { Collective: collectives[collectiveSlug] };
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
