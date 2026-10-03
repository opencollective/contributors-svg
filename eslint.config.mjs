import nodeConfig from 'eslint-config-opencollective/eslint-node.config.cjs';

export default [
  ...nodeConfig,
  {
    rules: {
      'no-console': 'warn',
    },
  },
  {
    ignores: ['dist/**'],
  },
];
