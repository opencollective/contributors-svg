import debug from 'debug';

import { logger } from '../logger';
import { parseToBooleanDefaultTrue, randomInteger } from '../lib/utils';

import { generateSvgBanner } from '../lib/svg-banner';

import { fetchContributors } from '../lib/contributors';

const imagesUrl = process.env.IMAGES_URL;

const debugBanner = debug('banner');

const oneDayInSeconds = 60 * 60 * 24;

export default async function banner(req, res) {
  const { collectiveSlug, backerType } = req.params;
  const limit = Number(req.query.limit) || Infinity;
  const width = Number(req.query.width) || 0;
  const height = Number(req.query.height) || 0;
  const { avatarHeight, margin } = req.query;
  const showBtn = parseToBooleanDefaultTrue(req.query.button);

  let contributors;
  try {
    contributors = await fetchContributors(req.params);
  } catch (error) {
    if (error.message.includes('No collective found')) {
      return res.status(404).send(error.message.replace('GraphQL error: ', ''));
    }
    if (error.message.includes('Not available')) {
      return res.status(503).send(error.message);
    }
  }

  let buttonImage;
  if (showBtn) {
    buttonImage = `${imagesUrl}/static/images/contribute.svg`;
  }

  debugBanner(`generating for ${collectiveSlug} (backerType=${backerType})`);

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
