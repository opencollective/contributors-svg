import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';

import fetch from './fetch';

const getGraphqlUrl = ({ version = 'v1' } = {}) => {
  const apiKey = process.env.API_KEY;
  const baseApiUrl = process.env.API_URL;
  return `${baseApiUrl}/graphql/${version}${apiKey ? `?api_key=${apiKey}` : ''}`;
};

let client;

function getClient({ version = 'v1' } = {}) {
  if (!client) {
    client = new ApolloClient({
      link: new HttpLink({ uri: getGraphqlUrl({ version }), fetch }),
      cache: new InMemoryCache({
        possibleTypes: {
          Transaction: ['Expense', 'Order', 'Debit', 'Credit'],
          CollectiveInterface: ['Collective', 'Event', 'Project', 'Fund', 'Organization', 'User', 'Vendor'],
          Account: ['Collective', 'Host', 'Individual', 'Fund', 'Project', 'Bot', 'Event', 'Organization', 'Vendor'],
          AccountWithHost: ['Collective', 'Event', 'Fund', 'Project'],
          AccountWithParent: ['Event', 'Project'],
          AccountWithContributions: ['Collective', 'Organization', 'Event', 'Fund', 'Project', 'Host'],
        },
      }),
    });
  }
  return client;
}

export function graphqlRequest(query, variables) {
  // With ApolloClient as client
  return getClient()
    .query({ query, variables, fetchPolicy: 'network-only' })
    .then((result) => result.data);
}
