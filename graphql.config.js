module.exports = {
  projects: {
    default: {
      schema: 'lib/graphql/schemaV2.graphql',
      documents: ['pages/**/*.(ts|tsx)', 'components/**/*.(ts|tsx)'],
      extensions: {
        endpoints: {
          dev: 'http://localhost:3060/graphql/v2',
          prod: 'https://api.opencollective.com/graphql/v2',
        },
        pluckConfig: {
          globalGqlIdentifierName: 'gql',
          gqlMagicComment: 'GraphQLV2',
        },
      },
    },
    graphqlV1: {
      schema: 'lib/graphql/schema.graphql',
      documents: [
        // The following documents only use gqlV1
        //  grep -rl " gqlV1/" ./components ./lib ./pages | xargs grep -rL "gql\`" | sort
        'src/server/lib/contributors.js',
      ],
      extensions: {
        endpoints: {
          dev: 'http://localhost:3060/graphql/v1',
          prod: 'https://api.opencollective.com/graphql/v1',
        },
        pluckConfig: {
          globalGqlIdentifierName: 'gqlV1',
          gqlMagicComment: 'GraphQL',
        },
      },
    },
  },
};
