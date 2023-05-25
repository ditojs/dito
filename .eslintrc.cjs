// http://eslint.org/docs/user-guide/configuring
const isProduction = process.env.NODE_ENV === 'production'

module.exports = {
  root: true,
  parser: 'vue-eslint-parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
    templateTokenizer: {
      pug: 'vue-eslint-parser-template-tokenizer-pug'
    }
  },
  env: {
    es2022: true
  },
  extends: [
    'standard',
    'plugin:prettier/recommended',
    'plugin:vue/vue3-recommended',
    'plugin:vue-pug/vue3-recommended',
    'plugin:import/errors',
    'plugin:import/typescript'
  ],
  settings: {
    'import/ignore': [
      // objection struggles with the default export.
      'objection'
    ],
    'import/resolver': {
      typescript: {
        project: 'packages/*/jsconfig.json',
        extensions: ['.js', '.vue']
      }
    }
  },
  plugins: ['vue'],
  rules: {
    'prettier/prettier': 'error',
    'array-bracket-spacing': ['error', 'never'],
    'dot-notation': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    // Allow async-await.
    'generator-star-spacing': 'off',
    'lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true }
    ],
    'max-len': [
      'error',
      80,
      2,
      {
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }
    ],
    'multiline-ternary': 'off',
    'new-cap': [
      'error',
      {
        newIsCap: true,
        capIsNew: true,
        capIsNewExceptions: ['Knex'],
        capIsNewExceptionPattern: 'Mixin\\d*$'
      }
    ],
    'no-console': [
      isProduction ? 'error' : 'warn',
      {
        allow: [
          'info',
          'warn',
          'error'
        ]
      }
    ],
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-constant-condition': isProduction ? 'error' : 'warn',
    // Allow debugger during development.
    'no-debugger': isProduction ? 'error' : 'warn',
    'no-dupe-keys': 'error',
    'no-prototype-builtins': 'off',
    'no-return-assign': 'error',
    'no-this-before-super': 'error',
    'no-throw-literal': 'error',
    'no-undef': isProduction ? 'error' : 'warn',
    'no-unreachable': isProduction ? 'error' : 'warn',
    'no-unused-vars': [
      isProduction ? 'error' : 'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }
    ],
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-const': [
      'error',
      { destructuring: 'all' }
    ],
    'valid-typeof': 'error',
    'vue/order-in-components': [
      'error',
      {
        order: [
          'el',
          'name',
          'key',
          'parent',
          'functional',
          ['delimiters', 'comments'],
          'extends',
          'mixins',
          ['components', 'directives', 'filters'],
          'emits',
          ['inject', 'provide'],
          'model',
          ['props', 'propsData'],
          'setup',
          'data',
          'computed',
          'watch',
          'ROUTER_GUARDS',
          'LIFECYCLE_HOOKS',
          'methods',
          ['template', 'render'],
          'renderError'
        ]
      }
    ],
    'vue/attributes-order': [
      'error',
      {
        order: [
          'LIST_RENDERING',
          'CONDITIONALS',
          'DEFINITION',
          'RENDER_MODIFIERS',
          'GLOBAL',
          ['UNIQUE', 'SLOT'],
          'TWO_WAY_BINDING',
          'OTHER_DIRECTIVES',
          'OTHER_ATTR',
          'EVENTS',
          'CONTENT'
        ],
        alphabetical: false
      }
    ],
    'vue-pug/no-pug-control-flow': 'off',
    'vue-pug/component-name-in-template-casing': [
      'error',
      'PascalCase',
      {
        registeredComponentsOnly: false,
        ignores: ['component']
      }
    ],
    'vue/prop-name-casing': ['error', 'camelCase'],
    'vue/attribute-hyphenation': ['error', 'never'],
    'vue/v-on-event-hyphenation': [
      'error',
      'always',
      {
        ignore: ['update:modelValue']
      }
    ],
    'vue/require-v-for-key': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'vue/no-v-text-v-html-on-component': 'off',
    // prettier/plugin-pug handles this:
    'vue/html-quotes': 'off'
  },
  overrides: [
    {
      files: ['*.d.ts'],
      parser: '@typescript-eslint/parser',
      rules: {
        'import/export': 'off',
        'no-dupe-class-members': 'off',
        'no-redeclare': 'off',
        'no-unused-vars': 'off',
        'no-use-before-define': 'off'
      }
    }
  ]
}
