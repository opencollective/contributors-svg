import gql from 'graphql-tag';
import { get } from 'lodash';
import PQueue from 'p-queue';

import { logger } from '../logger';

import cache from './cache';
import { getOrgData, getRepoData } from './github';
import { graphqlRequest } from './graphql';
import { sleep, sortObjectByValue } from './utils';

const CONCURRENCY = 5;

const IGNORE_SLUGS = (process.env.IGNORE_SLUGS || '').split(',');

const queue = new PQueue({ concurrency: CONCURRENCY });

export async function fetchContributors({ collectiveSlug }) {
  collectiveSlug = collectiveSlug.toLowerCase();

  if (IGNORE_SLUGS.includes(collectiveSlug)) {
    throw new Error(`No collective found with slug ${collectiveSlug} (ignored)`);
  }

  const cacheKey = `contributors_${collectiveSlug}`;

  const contributors = await cache.get(cacheKey);
  if (contributors) {
    return contributors;
  }

  // Fetch data from Open Collective API
  const query = gql`
    query GithubContributors($collectiveSlug: String) {
      Collective(slug: $collectiveSlug) {
        id
        name
        slug
        githubHandle
        settings
        githubContributors
      }
    }
  `;

  const result = await graphqlRequest(query, { collectiveSlug });

  // Trigger Update
  logger.info(`Triggering contributors update for '${collectiveSlug}'`);
  updateContributors(result.Collective);

  // Try 30 times in 10 seconds to check if the data arrived
  let iteration = 1;
  while (iteration <= 30) {
    logger.debug(`Waiting for contributors. Iteration #${iteration}`);
    await sleep(333);
    const contributors = await cache.get(cacheKey);
    if (contributors) {
      logger.info(`Available. Contributors ready for for collective '${collectiveSlug}'`);
      return contributors;
    }
    iteration++;
  }

  // Fallback with results from Open Collective API
  if (result.Collective.githubContributors && Object.keys(result.Collective.githubContributors).length > 0) {
    logger.warn(`Not available. Using fallback for collective '${collectiveSlug}'`);
    return result.Collective.githubContributors;
  }

  throw new Error(`Not available. Fetching contributors for collective '${collectiveSlug}'`);
}

const updateContributors = async (collective) => {
  let org = get(collective, 'settings.githubOrg');
  let repo = get(collective, 'settings.githubRepo');

  if (collective.githubHandle) {
    if (collective.githubHandle.includes('/')) {
      repo = collective.githubHandle;
    } else {
      org = collective.githubHandle;
    }
  }

  if (org) {
    queue
      .add(() => getOrgData(org).then((data) => updateCollectiveGithubData(collective, data)))
      .catch((e) => {
        logger.error(`Error while fetching org '${org}' for collective '${collective.slug}'`);
        logger.debug(e);
      });
  } else if (repo) {
    const split = repo.split('/');
    if (split.length !== 2) {
      logger.warn(`Invalid GitHub information (githubRepo) for collective '${collective.slug}'`);
      return;
    }
    const options = {
      owner: split[0],
      repo: split[1],
    };
    queue
      .add(() => getRepoData(options).then((data) => updateCollectiveGithubData(collective, data)))
      .catch((e) => {
        logger.error(
          `Error while fetching repo '${options.owner}/${options.repo}' for collective '${collective.slug}'`,
        );
        logger.debug(e);
      });
  } else {
    logger.warn(`No GitHub information available for collective '${collective.slug}'`);
  }
};

const updateCollectiveGithubData = async (collective, githubData) => {
  const githubContributors = sortObjectByValue(githubData.contributorData);

  await cache.set(`contributors_${collective.slug}`, githubContributors, 60 * 60 * 24 /* 1 day */);

  logger.info(`Successfully updated contributors for '${collective.slug}'`);
};
