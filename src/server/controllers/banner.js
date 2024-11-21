import debug from 'debug';

import { fetchContributors } from '../lib/contributors';
import { generateSvgBanner } from '../lib/svg-banner';
import { parseToBooleanDefaultTrue, randomInteger } from '../lib/utils';
import { logger } from '../logger';

const debugBanner = debug('banner');

const oneDayInSeconds = 60 * 60 * 24;

export default async function banner(req, res) {
  const { collectiveSlug } = req.params;
  const limit = Number(req.query.limit) || Infinity;
  const width = Number(req.query.width) || 0;
  const height = Number(req.query.height) || 0;
  const skip = req.query.skip;
  const { avatarHeight, margin } = req.query;
  const showBtn = parseToBooleanDefaultTrue(req.query.button);

  let skipUsers = skip || [];
  if (!Array.isArray(skipUsers)) {
    skipUsers = [skip];
  }

  let contributors;
  try {
    contributors = await fetchContributors(req.params);
  } catch (error) {
    let code = 500;
    let message = error.message.replace('GraphQL error: ', '');

    logger.error(`Error while fetching contributors: ${message}`);

    if (message.includes('No collective found')) {
      code = 404;
      message = 'Not found';
    } else if (message.includes('Not available')) {
      message = 'Not available';
      code = 503;
    }

    return res.status(code).send(message);
  }

  contributors = Object.keys(contributors)
    .filter((username) => !skipUsers.includes(username))
    .map((username) => {
      return {
        slug: username,
        type: 'GITHUB_USER',
        image: `https://avatars.githubusercontent.com/${username}?s=96`,
        website: `https://github.com/${username}`,
      };
    });

  let buttonImage;
  if (showBtn) {
    buttonImage = `${process.env.CONTRIBUTORS_SVG_URL}/static/images/contribute.svg`;
  }

  debugBanner(`Generating banner for collective '${collectiveSlug}'`);

  const maxAge = oneDayInSeconds + randomInteger(3600);

  return generateSvgBanner(contributors, {
    limit,
    buttonImage,
    width,
    height,
    avatarHeight,
    margin,
    collectiveSlug,
  })
    .then((content) => {
      res.setHeader('Content-Type', 'image/svg+xml;charset=utf-8');
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.send(content);
    })
    .catch((e) => {
      logger.error('>>> collectives.banner error', e);
    });
}
