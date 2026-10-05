import nodeConfig from 'eslint-config-opencollective/eslint-node.config.cjs';

export default [
  ...nodeConfig,
  {
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
    ignores: ['dist/**'],
  },
];
