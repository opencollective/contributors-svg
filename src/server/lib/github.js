import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { Octokit } from '@octokit/rest';
import { get, has, isArray, pick } from 'lodash';

import cache from './cache';
import { logger } from '../logger';

const compactRepo = (repo) => {
  repo = pick(repo, ['name', 'owner', 'stargazers_count']);
  repo.owner = pick(repo.owner, ['login']);
  return repo;
};

export function getOctokit() {
  const octokitParams = {};

  octokitParams.authStrategy = createOAuthAppAuth;
  octokitParams.auth = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  };

  return new Octokit(octokitParams);
}

export function getData(res) {
  if (has(res, ['headers', 'x-ratelimit-remaining'])) {
    logger.debug(`RateLimit Remaining: ${get(res, ['headers', 'x-ratelimit-remaining'])}`);
  }
  return res.data;
}

export async function getAllOrganizationPublicRepos(org, accessToken) {
  const cacheKey = `org_repos_all_${org}`;
  const fromCache = await cache.get(cacheKey);
  if (fromCache) {
    return fromCache;
  }

  const octokit = getOctokit(accessToken);

  // eslint-disable-next-line camelcase
  const parameters = { org, page: 1, per_page: 100, type: 'public' };

  let repos = [];
  let fetchRepos;
  do {
    // https://octokit.github.io/rest.js/v18#repos-list-for-org
    // https://developer.github.com/v3/repos/#list-organization-repositories
    fetchRepos = await octokit.repos.listForOrg(parameters).then(getData);
    repos = [...repos, ...fetchRepos];
    parameters.page++;
  } while (fetchRepos.length === parameters.per_page);

  repos = repos.map(compactRepo);

  cache.set(cacheKey, repos, 5 * 60 /* 5 minutes */);

  return repos;
}

const noContentToArray = (value) => (isArray(value) ? value : []);

const sortObjectByValue = (obj, path) => {
  const sortable = [];
  for (const key in obj) {
    sortable.push([key, obj[key], path ? get(obj[key], path) : obj[key]]);
  }

  sortable.sort((a, b) => {
    return a[2] > b[2] ? -1 : a[2] < b[2] ? 1 : 0;
  });

  const orderedList = {};
  for (let i = 0; i < sortable.length; i++) {
    orderedList[sortable[i][0]] = sortable[i][1];
  }

  return orderedList;
};

export const getAllContributors = async (repo) => {
  const cacheKey = `repos_contributors_${repo.owner}_${repo.repo}`;
  const fromCache = await cache.get(cacheKey);
  if (fromCache) {
    return fromCache;
  }

  const octokit = getOctokit();

  const fetchParameters = { page: 1, per_page: 100 }; // eslint-disable-line camelcase

  let contributors = [];
  let fetchContributors;
  do {
    // https://octokit.github.io/rest.js/v18#repos-list-contributors
    // https://developer.github.com/v3/repos/#list-contributors
    logger.verbose(`Fetching contributors for ${repo.owner}/${repo.repo}, page ${fetchParameters.page}`);
    fetchContributors = await octokit.repos
      .listContributors({ ...repo, ...fetchParameters })
      .then(getData)
      .then(noContentToArray)
      .then((c) => c.map((repo) => pick(repo, ['login', 'contributions'])));
    contributors = [...contributors, ...fetchContributors];
    fetchParameters.page++;
  } while (fetchContributors.length === fetchParameters.per_page);

  cache.set(cacheKey, contributors, 60 * 60 /* 60 minutes */);

  return contributors;
};

export const getRepoData = (repo) => {
  logger.verbose(`Fetching repo data for ${repo.owner}/${repo.repo}`);
  return getAllContributors(repo).then((contributors) => {
    const contributorData = {};
    for (const contributor of contributors) {
      contributorData[contributor.login] = contributor.contributions;
    }
    return { contributorData };
  });
};

export const getOrgData = (org) => {
  logger.verbose(`Fetching org data for ${org}`);
  return getAllOrganizationPublicRepos(org).then(async (repos) => {
    const contributorData = {};
    const repoData = {};
    for (const repo of repos) {
      if (repo.fork) {
        continue;
      }
      const contributors = await getAllContributors({ owner: repo.owner.login, repo: repo.name });
      for (const contributor of contributors) {
        if (contributorData[contributor.login]) {
          contributorData[contributor.login] += contributor.contributions;
        } else {
          contributorData[contributor.login] = contributor.contributions;
        }
      }
      repoData[repo.name] = { stars: repo.stargazers_count };
    }
    return { contributorData, repoData };
  });
};
