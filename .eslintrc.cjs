// http://eslint.org/docs/user-guide/configuring
const isProduction = process.env.NODE_ENV === 'production'

module.exports = {
  root: true,
  parser: 'vue-eslint-parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022
  },
  env: {
    es6: true
  },
  // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
  extends: [
    // https://github.com/standard/standard/blob/master/docs/RULES-en.md#javascript-standard-style
    'standard',
    // https://github.com/vuejs/eslint-plugin-vue#priority-c-recommended-minimizing-arbitrary-choices-and-cognitive-overhead
    'plugin:vue/recommended'
  ],
  plugins: ['vue'],
  rules: {
    'accessor-pairs': 'error',
    'array-bracket-spacing': ['error', 'never'],
    // Allow paren-less arrow functions.
    'arrow-parens': ['error', 'as-needed'],
    'eqeqeq': ['error', 'always', {
      null: 'ignore'
    }],
    // Allow async-await.
    'generator-star-spacing': 'off',
    'indent': ['error', 2, {
      flatTernaryExpressions: true,
      ignoredNodes: ['TemplateLiteral > *']
    }],
    'lines-between-class-members': ['error', 'always', {
      exceptAfterSingleLine: true
    }],
    'max-len': ['error', 80, 2, {
      ignoreUrls: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true
    }],
    'multiline-ternary': 'off',
    'new-cap': ['error', {
      newIsCap: true,
      capIsNew: true,
      capIsNewExceptions: ['Knex'],
      capIsNewExceptionPattern: 'Mixin'
    }],
    'no-console': [isProduction ? 'error' : 'warn', {
      allow: [
        'info',
        'warn',
        'error'
      ]
    }],
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-constant-condition': isProduction ? 'error' : 'warn',
    // Allow debugger during development.
    'no-debugger': isProduction ? 'error' : 'warn',
    'no-mixed-operators': 'off',
    'no-new': 'off',
    'no-new-func': 'off',
    'no-prototype-builtins': 'off',
    'no-return-assign': 'error',
    'no-this-before-super': 'error',
    'no-undef': isProduction ? 'error' : 'warn',
    'no-unreachable': isProduction ? 'error' : 'warn',
    'no-unused-vars': [isProduction ? 'error' : 'warn', {
      args: 'after-used',
      argsIgnorePattern: '^_',
      ignoreRestSiblings: true
    }],
    'no-var': 'error',
    'object-shorthand': 'error',
    'standard/object-curly-even-spacing': 'off',
    'object-curly-spacing': ['error', 'always'],
    'prefer-const': ['error', {
      destructuring: 'all'
    }],
    'quotes': ['error', 'single', {
      allowTemplateLiterals: true,
      avoidEscape: true
    }],
    'quote-props': ['error', 'consistent-as-needed'],
    'space-before-function-paren': ['error', {
      anonymous: 'never',
      named: 'never',
      asyncArrow: 'always'
    }],
    'space-in-parens': ['error', 'never'],
    'valid-typeof': 'error',
    'vue/component-definition-name-casing': ['error', 'kebab-case'],
    'vue/component-tags-order': ['error', {
      order: ['template', 'style', 'script']
    }],
    'vue/no-async-in-computed-properties': 'off',
    'vue/no-side-effects-in-computed-properties': 'off',
    'vue/require-default-prop': 'off',
    'vue/return-in-computed-property': 'off',
    'vue/multi-word-component-names': 'off'
  }
}
