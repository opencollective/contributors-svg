import graphqlPlugin from '@graphql-eslint/eslint-plugin'; // eslint-disable-line import/no-unresolved
import nodeConfig from 'eslint-config-opencollective/eslint-node.config.cjs';

export default [
  ...nodeConfig,
  {
    files: ['**/*.js'],

    // Lint GraphQL queries embedded in `gql` / `gqlV1` tags against the schemas (see graphql.config.js)
    processor: graphqlPlugin.processor,

    settings: {
      // The TypeScript resolver follows the `exports` field of package.json, like Node: needed for
      // ESM-only packages without a root index.js (e.g. p-queue 9)
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
  },
  {
    rules: {
      'no-console': 'warn',
    },
  },
  {
    files: ['**/*.graphql'],

    languageOptions: {
      parser: graphqlPlugin.parser,
    },
    plugins: {
      '@graphql-eslint': graphqlPlugin,
    },

    rules: {
      '@graphql-eslint/no-deprecated': 'warn',
      '@graphql-eslint/fields-on-correct-type': 'error',
      '@graphql-eslint/no-duplicate-fields': 'error',
      '@graphql-eslint/naming-convention': [
        'error',
        {
          VariableDefinition: 'camelCase',

          OperationDefinition: {
            style: 'PascalCase',
            forbiddenPrefixes: ['get', 'fetch'],
            forbiddenSuffixes: ['Query', 'Mutation', 'Fragment'],
          },
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'src/graphql/*.graphql'],
  },
];
