// The root config, with TypeScript for the tests outside `src` as well. ESLint
// reads the patterns of the root config relative to this directory.
// eslint-disable-next-line import/default
import tsParser from '@typescript-eslint/parser'
import config from '../../eslint.config.js'

export default [
  ...config,
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: {
      // TypeScript checks these, also for types, which these rules don't know.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off'
    }
  }
]
