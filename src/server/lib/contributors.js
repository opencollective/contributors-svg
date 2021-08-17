import gql from 'graphql-tag';
import { get } from 'lodash';
import PQueue from 'p-queue';

import { logger } from '../logger';

import cache from './cache';
import { getOrgData, getRepoData } from './github';
import { graphqlRequest } from './graphql';
import { sortObjectByValue } from './utils';

const CONCURRENCY = 5;

const queue = new PQueue({ concurrency: CONCURRENCY });

export async function fetchContributors({ collectiveSlug }) {
  const contributors = await cache.get(`contributors_${collectiveSlug}`);
  if (contributors) {
    return Object.keys(contributors).map((username) => {
      return {
        slug: username,
        type: 'GITHUB_USER',
        image: `https://avatars.githubusercontent.com/${username}?s=96`,
        website: `https://github.com/${username}`,
      };
    });
  }

  // Fetch data from Open Collective API
  const query = gql`
    query GithubContributors($collectiveSlug: String) {
      Collective(slug: $collectiveSlug) {
        id
        name
        slug
        settings
        githubContributors
      }
    }
  `;

  const result = await graphqlRequest(query, { collectiveSlug });

  // Trigger Update
  updateContributors(result.Collective);

  // Fallback with results from Open Collective API
  if (result.Collective.githubContributors && Object.keys(result.Collective.githubContributors).length > 0) {
    return result.Collective.githubContributors;
  }

  throw new Error('Not available. Contributors list is being refreshed.');
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
        console.log(e);
        logger.error(`Error while fetching org data for collective '${collective.slug}'`);
        logger.debug(e);
      });
  } else {
    const split = repo.split('/');
    if (split.length !== 2) {
      logger.warn(collective.name, 'Incorrect format of githubRepo');
      return;
    }
    const options = {
      owner: split[0],
      repo: split[1],
    };
    queue
      .add(() => getRepoData(options).then((data) => updateCollectiveGithubData(collective, data)))
      .catch((e) => {
        logger.error(`Error while fetching ${options.owner}/${options.repo} for collective '${collective.slug}'`);
        logger.debug(e);
      });
  }
};

const updateCollectiveGithubData = async (collective, githubData) => {
  const githubContributors = sortObjectByValue(githubData.contributorData);

  await cache.set(`contributors_${collective.slug}`, githubContributors);

  logger.info(`Successfully updated contribution data for '${collective.name}'`);
};
