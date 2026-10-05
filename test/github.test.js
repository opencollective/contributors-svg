// lib/github: organization and repository contributors through Octokit, with the GitHub API stubbed
// on fetch (Octokit uses the global fetch). Pagination, aggregation, empty repositories, auth, cache.
require('@babel/register');

const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');

delete process.env.REDIS_URL;
process.env.CLIENT_ID = 'client-id';
process.env.CLIENT_SECRET = 'client-secret';

const { getOrgData, getRepoData } = require('../src/server/lib/github');

const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

// A fake GitHub: repositories of each org, contributors of each repository
const orgs = {
  babel: [
    ...range(100, (i) => ({ name: `repo-${i}`, owner: { login: 'babel' }, stargazers_count: i })),
    { name: 'babel', owner: { login: 'babel' }, stargazers_count: 1000 },
  ],
};
const contributors = {
  'babel/babel': range(150, (i) => ({ login: `user-${i}`, contributions: i + 1, id: i })),
  'babel/repo-0': [{ login: 'user-0', contributions: 10 }],
  'babel/empty': null, // 204 No Content
};

const requests = [];
const realFetch = globalThis.fetch;

const json = (body, page, perPage) => {
  const items = body.slice((page - 1) * perPage, page * perPage);
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '4999' },
  });
};

before(() => {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const headers = new Headers(init.headers);
    requests.push({ path: `${url.pathname}${url.search}`, authorization: headers.get('authorization') });
    const page = Number(url.searchParams.get('page') || 1);
    const perPage = Number(url.searchParams.get('per_page') || 30);
    let match;
    if ((match = url.pathname.match(/^\/orgs\/([^/]+)\/repos$/))) {
      return json(orgs[match[1]] || [], page, perPage);
    }
    if ((match = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/contributors$/))) {
      const list = contributors[match[1]];
      if (list === null) {
        return new Response(null, { status: 204 });
      }
      return json(list || [], page, perPage);
    }
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  };
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  requests.length = 0;
});

test('repository: all pages of contributors, with the OAuth app credentials', async () => {
  const { contributorData } = await getRepoData({ owner: 'babel', repo: 'babel' });
  assert.equal(Object.keys(contributorData).length, 150);
  assert.equal(contributorData['user-149'], 150);
  assert.deepEqual(
    requests.map((r) => r.path),
    ['/repos/babel/babel/contributors?page=1&per_page=100', '/repos/babel/babel/contributors?page=2&per_page=100'],
  );
  const basic = `basic ${Buffer.from('client-id:client-secret').toString('base64')}`;
  assert.ok(requests.every((r) => r.authorization === basic));
});

test('repository: cached for the next call', async () => {
  await getRepoData({ owner: 'babel', repo: 'babel' });
  assert.equal(requests.length, 0);
});

test('repository without contributors (204 No Content)', async () => {
  const { contributorData } = await getRepoData({ owner: 'babel', repo: 'empty' });
  assert.deepEqual(contributorData, {});
});

test('organization: all pages of public repositories, contributions summed across them', async () => {
  const { contributorData, repoData } = await getOrgData('babel');
  assert.equal(
    requests
      .filter((r) => r.path.startsWith('/orgs/'))
      .map((r) => r.path)
      .join(' '),
    '/orgs/babel/repos?page=1&per_page=100&type=public /orgs/babel/repos?page=2&per_page=100&type=public',
  );
  assert.equal(Object.keys(repoData).length, 101);
  assert.deepEqual(repoData.babel, { stars: 1000 });
  // user-0: 1 in babel/babel, 10 in babel/repo-0
  assert.equal(contributorData['user-0'], 11);
  assert.equal(contributorData['user-149'], 150);
});
