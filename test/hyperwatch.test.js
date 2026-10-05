// Hyperwatch only runs when enabled with a secret: never exposed (nor logging) without authentication
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { startServer } = require('./helpers');

const status = async (url, auth) => {
  const headers = auth ? { authorization: `Basic ${Buffer.from(auth).toString('base64')}` } : {};
  return (await fetch(`${url}/_hyperwatch/status`, { headers })).status;
};

test('enabled without a secret: not mounted, no request logging, a warning', async () => {
  const server = await startServer({ env: { HYPERWATCH_ENABLED: 'true', HYPERWATCH_SECRET: '', LOG_LEVEL: 'info' } });
  try {
    assert.equal(await status(server.url), 404);
    assert.match(server.output(), /HYPERWATCH_SECRET is not set, Hyperwatch is disabled/);
    // Hyperwatch's access log would have a line for this request
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.doesNotMatch(server.output(), /GET \/_hyperwatch\/status/);
  } finally {
    server.stop();
  }
});

test('enabled with a secret: mounted behind basic auth', async () => {
  const server = await startServer({ env: { HYPERWATCH_ENABLED: 'true', HYPERWATCH_SECRET: 's3cret' } });
  try {
    assert.equal(await status(server.url), 401);
    assert.equal(await status(server.url, 'opencollective:wrong'), 401);
    assert.equal(await status(server.url, 'opencollective:s3cret'), 200);
  } finally {
    server.stop();
  }
});

test('disabled: not mounted', async () => {
  const server = await startServer({ env: { HYPERWATCH_ENABLED: '', HYPERWATCH_SECRET: 's3cret' } });
  try {
    assert.equal(await status(server.url, 'opencollective:s3cret'), 404);
  } finally {
    server.stop();
  }
});
