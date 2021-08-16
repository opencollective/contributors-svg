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

  // Special route for GitHub avatars
  app.get(
    '/github/:githubUsername/:image(avatar)/:style(rounded|square)?/:height?.:format(png)',
    maxAgeOneDay,
    controllers.logo,
  );

  app.get('/:collectiveSlug/:backerType(contributors).svg', controllers.banner);
};
