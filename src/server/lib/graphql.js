import debug from 'debug';

import gql from 'graphql-tag';
import ApolloClient from 'apollo-boost';
import { pick } from 'lodash';

// Alternative setup with GraphQLClient from graphql-request
// import { GraphQLClient } from 'graphql-request';

import cache from './cache';
import fetch from './fetch';
import { queryString, md5, sleep, randomInteger } from './utils';

const thirtyMinutesInSeconds = 30 * 60;

const oneMinuteInSeconds = 60;

const debugGraphql = debug('graphql');

const getGraphqlUrl = ({ version = 'v1' } = {}) => {
  const apiKey = process.env.API_KEY;
  const baseApiUrl = process.env.API_URL;
  return `${baseApiUrl}/graphql/${version}${apiKey ? `?api_key=${apiKey}` : ''}`;
};

let client;

function getClient() {
  if (!client) {
    // client = new GraphQLClient(getGraphqlUrl(), { headers });
    client = new ApolloClient({ fetch, uri: getGraphqlUrl({ version: 'v1' }) });
  }
  return client;
}

function graphqlRequest(query, variables) {
  // With GraphQLClient from graphql-request
  // return getClient().request(query, variables);

  // With ApolloClient as client
  return getClient()
    .query({ query, variables, fetchPolicy: 'network-only' })
    .then((result) => result.data);
}

export async function fetchContributors({ collectiveSlug }) {
  const query = gql`
    query GithubContributors($collectiveSlug: String) {
      Collective(slug: $collectiveSlug) {
        githubContributors
      }
    }
  `;

  const result = await graphqlRequest(query, {
    collectiveSlug,
  });

  const contributors = result.Collective.githubContributors;

  return Object.keys(contributors).map((username) => {
    return {
      slug: username,
      type: 'GITHUB_USER',
      image: `https://avatars.githubusercontent.com/${username}?s=96`,
      website: `https://github.com/${username}`,
    };
  });
}

export async function fetchContributorsWithCache(params) {
  params = pick(params, ['collectiveSlug']);
  const cacheKey = `contributors_${md5(queryString.stringify(params))}`;
  const cacheKeyFetching = `${cacheKey}_fetching`;
  let contributors = await cache.get(cacheKey);
  if (!contributors) {
    debugGraphql(`fetchContributorsWithCache ${params.collectiveSlug} ${cacheKey} miss`);
    let fetching = await cache.has(cacheKeyFetching);
    if (fetching) {
      while (fetching) {
        debugGraphql(`fetchContributorsWithCache ${params.collectiveSlug} ${cacheKey} waiting`);
        await sleep(100);
        fetching = await cache.has(cacheKeyFetching);
      }
      debugGraphql(`fetchContributorsWithCache ${params.collectiveSlug} ${cacheKey} available`);
      contributors = await cache.get(cacheKey);
    }
    if (!contributors) {
      debugGraphql(`fetchContributorsWithCache ${params.collectiveSlug} ${cacheKey} fetching`);
      cache.set(cacheKeyFetching, true, oneMinuteInSeconds);
      try {
        contributors = await fetchContributors(params);
        cache.set(cacheKey, contributors, thirtyMinutesInSeconds + randomInteger(300));
        debugGraphql(`fetchContributorsWithCache ${params.collectiveSlug} ${cacheKey} set`);
        cache.del(cacheKeyFetching);
      } catch (e) {
        cache.del(cacheKeyFetching);
        throw e;
      }
    }
  } else {
    debugGraphql(`fetchContributorsWithCache ${params.collectiveSlug} ${cacheKey} hit`);
  }
  return contributors;
}
