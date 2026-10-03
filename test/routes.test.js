// Pins what the router matches and passes to the controllers (params and query), with the real
// app setup and stubbed controllers: catches routing changes in Express upgrades
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { startServer } = require('./helpers');

let server;

before(async () => {
  server = await startServer({ preload: [path.join(__dirname, 'stub-controllers.js')] });
});

after(() => server?.stop());

const get = async (url) => {
  const res = await fetch(`${server.url}${url}`);
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
};

const logo = (params) => ({ status: 200, controller: 'logo', params });
const banner = (params) => ({ status: 200, controller: 'banner', params });
const notFound = { status: 404 };

const cases = {
  // GitHub avatars: optional style and height, png only
  '/github/octocat/avatar.png': logo({ githubUsername: 'octocat', image: 'avatar', format: 'png' }),
  '/github/octocat/avatar/64.png': logo({ githubUsername: 'octocat', image: 'avatar', height: '64', format: 'png' }),
  '/github/octocat/avatar/rounded.png': logo({
    githubUsername: 'octocat',
    image: 'avatar',
    style: 'rounded',
    format: 'png',
  }),
  '/github/octocat/avatar/square/64.png': logo({
    githubUsername: 'octocat',
    image: 'avatar',
    style: 'square',
    height: '64',
    format: 'png',
  }),
  '/github/foo.bar/avatar/rounded/64.png': logo({
    githubUsername: 'foo.bar',
    image: 'avatar',
    style: 'rounded',
    height: '64',
    format: 'png',
  }),
  // Case-insensitive and non-strict (trailing slash), like Express's defaults
  '/GitHub/octocat/Avatar/64.PNG/': logo({ githubUsername: 'octocat', image: 'Avatar', height: '64', format: 'PNG' }),
  '/github/octocat/avatar/64.jpg': notFound,
  '/github/octocat/logo/64.png': notFound,
  '/github/octocat/avatar/rounded/64/32.png': notFound,
  // Contributors banner
  '/babel/contributors.svg': banner({ collectiveSlug: 'babel', backerType: 'contributors' }),
  '/Babel/Contributors.SVG/': banner({ collectiveSlug: 'Babel', backerType: 'Contributors' }),
  '/babel/backers.svg': notFound,
  '/babel/contributors.png': notFound,
  '/babel/x/contributors.svg': notFound,
};

for (const [url, expected] of Object.entries(cases)) {
  test(`GET ${url}`, async () => {
    const { status, body } = await get(url);
    assert.equal(status, expected.status);
    if (expected.status === 200) {
      assert.equal(body.controller, expected.controller);
      assert.deepEqual(body.params, expected.params);
    }
  });
}

test('query string: repeated and bracketed keys become arrays', async () => {
  for (const query of ['skip=a&skip=b', 'skip[]=a&skip[]=b']) {
    const { body } = await get(`/babel/contributors.svg?${query}&width=890`);
    assert.deepEqual(body.query, { skip: ['a', 'b'], width: '890' }, query);
  }
});
