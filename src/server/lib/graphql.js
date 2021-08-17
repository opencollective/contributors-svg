import ApolloClient from 'apollo-boost';

import fetch from './fetch';

const getGraphqlUrl = ({ version = 'v1' } = {}) => {
  const apiKey = process.env.API_KEY;
  const baseApiUrl = process.env.API_URL;
  return `${baseApiUrl}/graphql/${version}${apiKey ? `?api_key=${apiKey}` : ''}`;
};

let client;

function getClient() {
  if (!client) {
    client = new ApolloClient({ fetch, uri: getGraphqlUrl({ version: 'v1' }) });
  }
  return client;
}

export function graphqlRequest(query, variables) {
  // With ApolloClient as client
  return getClient()
    .query({ query, variables, fetchPolicy: 'network-only' })
    .then((result) => result.data);
}
