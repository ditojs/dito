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
    'no-debugger': isProduction ? 'error' : 'off',
    'no-constant-condition': isProduction ? 'error' : 'off',
    'no-unused-vars': isProduction ? 'error' : 'off',
    'no-cond-assign': 'error',
    'no-new': 'off',
    'no-new-func': 'off',
    'no-mixed-operators': 'off',
    'no-return-assign': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-const': ['error', {
      destructuring: 'all'
    }],
    'prefer-destructuring': ['error', {
      VariableDeclarator: {
        object: true,
        array: false
      }
    }],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'indent': ['error', 2, {
      flatTernaryExpressions: true
    }]
  }
}
