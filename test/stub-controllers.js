// Preloaded with `node --require`: replaces the controllers with ones that echo what the router
// matched, so the route tests need neither GitHub nor the API
const path = require('node:path');

const controllersPath = path.join(__dirname, '..', 'src', 'server', 'controllers', 'index.js');

const echo = (controller) => (req, res) => res.json({ controller, params: { ...req.params }, query: req.query });

require.cache[controllersPath] = {
  id: controllersPath,
  filename: controllersPath,
  loaded: true,
  exports: { __esModule: true, default: { banner: echo('banner'), logo: echo('logo') } },
};
