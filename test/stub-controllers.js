// Preloaded with `node --require`: replaces the controllers with ones that echo what the router
// matched, so the route tests need neither GitHub nor the API
const path = require('node:path');

const controllersPath = path.join(__dirname, '..', 'src', 'server', 'controllers', 'index.js');

const echo = (controller) => async (req, res) => {
  // An error thrown by an async controller, to test the error handling
  if (req.params.collectiveSlug === 'async-error') {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error('Async controller error');
  }
  res.json({ controller, params: { ...req.params }, query: req.query, ip: req.ip });
};

require.cache[controllersPath] = {
  id: controllersPath,
  filename: controllersPath,
  loaded: true,
  exports: { __esModule: true, default: { banner: echo('banner'), logo: echo('logo') } },
};
