// graphqlRequest: the real Apollo Client against a fake API, so that Apollo Client upgrades are covered
// (contributors.test.js stubs lib/graphql entirely)
require('@babel/register');

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, beforeEach, test } = require('node:test');

const { gql } = require('graphql-tag');

const { graphqlRequest } = require('../src/server/lib/graphql');

let server;
let respond;
const requests = [];

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const request = { url: req.url, headers: req.headers, body: JSON.parse(body) };
      requests.push(request);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(respond(request)));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  // The client is created on the first request, with these
  process.env.API_URL = `http://localhost:${server.address().port}`;
  process.env.API_KEY = 'test-api-key';
  process.env.OC_APPLICATION = 'contributors-svg';
});

after(() => {
  server.closeAllConnections();
  server.close();
});

beforeEach(() => {
  requests.length = 0;
});

const query = gql`
  query GithubContributors($collectiveSlug: String) {
    Collective(slug: $collectiveSlug) {
      id
      slug
      githubHandle
    }
  }
`;

const collective = { __typename: 'Collective', id: 1, slug: 'babel', githubHandle: 'babel' };

test('sends the query to the API and resolves with the data', async () => {
  respond = () => ({ data: { Collective: collective } });

  const data = await graphqlRequest(query, { collectiveSlug: 'babel' });

  assert.deepEqual(data, { Collective: collective });
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.url, '/graphql/v1?api_key=test-api-key');
  assert.equal(request.headers['oc-application'], 'contributors-svg');
  assert.equal(request.body.operationName, 'GithubContributors');
  assert.deepEqual(request.body.variables, { collectiveSlug: 'babel' });
});

test('every call reaches the API, results are not cached', async () => {
  let githubHandle = 'babel';
  respond = () => ({ data: { Collective: { ...collective, githubHandle } } });

  assert.equal((await graphqlRequest(query, { collectiveSlug: 'babel' })).Collective.githubHandle, 'babel');
  githubHandle = 'babel-renamed';
  assert.equal((await graphqlRequest(query, { collectiveSlug: 'babel' })).Collective.githubHandle, 'babel-renamed');
  assert.equal(requests.length, 2);
});

test('resolves fragments on interfaces (possibleTypes)', async () => {
  respond = () => ({ data: { Collective: collective } });

  const data = await graphqlRequest(
    gql`
      query Collective($collectiveSlug: String) {
        Collective(slug: $collectiveSlug) {
          id
          ... on CollectiveInterface {
            githubHandle
          }
        }
      }
    `,
    { collectiveSlug: 'babel' },
  );

  assert.equal(data.Collective.githubHandle, 'babel');
});

test('rejects with the API error message', async () => {
  // controllers/banner.js matches on this message to answer with a 404
  respond = () => ({ errors: [{ message: 'No collective found with slug nope' }], data: null });

  await assert.rejects(graphqlRequest(query, { collectiveSlug: 'nope' }), (error) => {
    assert.match(error.message, /No collective found/);
    return true;
  });
});
