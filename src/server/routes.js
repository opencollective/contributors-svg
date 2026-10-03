import controllers from './controllers';
import { maxAge } from './middlewares';

const maxAgeOneDay = maxAge(24 * 60 * 60);

export const loadRoutes = (app) => {
  app.get('/', (req, res) => {
    res.send('This is the Contributors.svg server.');
  });

  /**
   * Prevent indexation from search engines
   * (out of 'production' environment)
   */
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    if (process.env.NODE_ENV !== 'production' || process.env.ROBOTS_DISALLOW) {
      res.send('User-agent: *\nDisallow: /');
    } else {
      res.send('User-agent: *\nAllow: /');
    }
  });

  // Express 5 (path-to-regexp v8) dropped optional and regex-constrained params from string patterns.
  // These routes keep the exact Express 4 matching with regular expressions; named groups populate
  // req.params like before. The `i` flag and the optional trailing slash mirror Express's default
  // case-insensitive, non-strict routing.

  // Special route for GitHub avatars
  app.get(
    /^\/github\/(?<githubUsername>[^/]+?)\/(?<image>avatar)(?:\/(?<style>rounded|square))?(?:\/(?<height>[^/]+?))?\.(?<format>png)\/?$/i,
    maxAgeOneDay,
    controllers.logo,
  );

  app.get(/^\/(?<collectiveSlug>[^/]+?)\/(?<backerType>contributors)\.svg\/?$/i, controllers.banner);
};
