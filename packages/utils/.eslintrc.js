// http://eslint.org/docs/user-guide/configuring
var isProduction = process.env.NODE_ENV === 'production'

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  env: {
    node: true
  },
  // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
  extends: 'standard',
  rules: {
    'array-bracket-spacing': ['error', 'never'],
    // Allow paren-less arrow functions.
    'arrow-parens': ['error', 'as-needed'],
    // Allow async-await.
    'generator-star-spacing': 'off',
    'max-len': ['error', 80, 2, {
      ignoreUrls: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true
    }],
    // Allow debugger during development.
    'no-debugger': isProduction ? 'error' : 'warn',
    'no-constant-condition': isProduction ? 'error' : 'warn',
    'no-unused-vars': [isProduction ? 'error' : 'warn', {
      args: 'after-used',
      argsIgnorePattern: '^_',
      ignoreRestSiblings: true
    }],
    'no-cond-assign': 'error',
    'no-new': 'off',
    'no-new-func': 'off',
    'no-mixed-operators': 'off',
    'no-return-assign': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'standard/object-curly-even-spacing': ['off'],
    'object-curly-spacing': ['error', 'always'],
    'prefer-const': ['error', {
      destructuring: 'all'
    }],
    'quote-props': ['error', 'consistent-as-needed'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'space-in-parens': ['error', 'never'],
    'indent': ['error', 2, {
      flatTernaryExpressions: true,
      ignoredNodes: ['TemplateLiteral > *']
    }]
  }
}
