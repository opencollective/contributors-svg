import debug from 'debug';

import { logger } from '../logger';
import { parseToBooleanDefaultTrue, randomInteger } from '../lib/utils';
import { fetchContributorsWithCache } from '../lib/graphql';
import { generateSvgBanner } from '../lib/svg-banner';

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

  let users;
  try {
    users = await fetchContributorsWithCache(req.params);
  } catch (e) {
    return res.status(404).send('Not found');
  }

  let buttonImage;
  if (showBtn) {
    buttonImage = `${imagesUrl}/static/images/contribute.svg`;
  }

  debugBanner(`generating for ${collectiveSlug} (backerType=${backerType})`);

  const maxAge = oneDayInSeconds + randomInteger(3600);

  return generateSvgBanner(users, {
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
