// http://eslint.org/docs/user-guide/configuring
var isProduction = process.env.NODE_ENV === 'production'

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    browser: true,
  },
  // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
  extends: 'standard',
  // required to lint *.vue files
  plugins: [
    'html'
  ],
  // add your custom rules here
  'rules': {
    // allow paren-less arrow functions
    'arrow-parens': ['error', 'as-needed'],
    // allow async-await
    'generator-star-spacing': 0,
    // allow debugger during development
    'no-debugger': isProduction ? 2 : 0,
    'no-unused-vars': isProduction ? 2 : 0,
    'no-constant-condition': isProduction ? 2 : 0,
    'max-len': ['error', 80, 2, {
      'ignoreUrls': true,
      'ignoreTemplateLiterals': true,
      'ignoreRegExpLiterals': true
    }],
    'no-cond-assign': 'error',
    'no-new': 0,
    'no-new-func': 0,
    'no-mixed-operators': 0,
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always'
    }],
    'indent': ['error', 2, {
      'flatTernaryExpressions': true
    }]
  }
}
