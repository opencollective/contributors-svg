import { gql } from 'graphql-tag';
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

// An entry is refreshed in the background once it is older than STALE_AFTER, and served meanwhile.
// It is kept much longer than that, so a banner whose cache is stale never waits for GitHub.
const STALE_AFTER = 24 * 60 * 60 * 1000; // 1 day
const EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days, in seconds

// Slugs whose refresh is in progress, so concurrent requests don't start it again
const refreshing = new Set();

const accountQuery = gql /* GraphQL */ `
  query GithubContributors($collectiveSlug: String) {
    account(slug: $collectiveSlug) {
      id
      name
      slug
      githubHandle
      settings
    }
  }
`;

const fetchAccount = async (collectiveSlug) => {
  const result = await graphqlRequest(accountQuery, { collectiveSlug });
  return result.account;
};

// Entries written before `fetchedAt` was introduced are the contributors themselves: served, and stale
const readEntry = (entry) => (entry.fetchedAt && entry.contributors ? entry : { contributors: entry, fetchedAt: 0 });

const refreshInBackground = (collectiveSlug) => {
  if (refreshing.has(collectiveSlug)) {
    return;
  }
  refreshing.add(collectiveSlug);
  logger.info(`Stale. Refreshing contributors for collective '${collectiveSlug}' in the background`);
  fetchAccount(collectiveSlug)
    .then(updateContributors)
    .catch((e) => logger.warn(`Error while refreshing contributors for '${collectiveSlug}': ${e.message}`))
    .finally(() => refreshing.delete(collectiveSlug));
};

export async function fetchContributors({ collectiveSlug }) {
  collectiveSlug = collectiveSlug.toLowerCase();

  if (IGNORE_SLUGS.includes(collectiveSlug)) {
    throw new Error(`No collective found with slug ${collectiveSlug} (ignored)`);
  }

  const cacheKey = `contributors_${collectiveSlug}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    const { contributors, fetchedAt } = readEntry(cached);
    if (Date.now() - fetchedAt > STALE_AFTER) {
      refreshInBackground(collectiveSlug);
    }
    return contributors;
  }

  // Fetch data from Open Collective API
  const account = await fetchAccount(collectiveSlug);

  // Trigger Update
  logger.info(`Triggering contributors update for '${collectiveSlug}'`);
  updateContributors(account);

  // Try 30 times in 10 seconds to check if the data arrived
  let iteration = 1;
  while (iteration <= 30) {
    logger.debug(`Waiting for contributors. Iteration #${iteration}`);
    await sleep(333);
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Available. Contributors ready for for collective '${collectiveSlug}'`);
      return readEntry(cached).contributors;
    }
    iteration++;
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
    return queue
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
    return queue
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

  await cache.set(
    `contributors_${collective.slug}`,
    { contributors: githubContributors, fetchedAt: Date.now() },
    EXPIRES_IN,
  );

  logger.info(`Successfully updated contributors for '${collective.slug}'`);
};
