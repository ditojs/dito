// http://eslint.org/docs/user-guide/configuring
import fs from 'fs'
import path from 'path'
import globals from 'globals'
import vueParser from 'vue-eslint-parser'
// eslint-disable-next-line import/default
import tsParser from '@typescript-eslint/parser'
import pluginJs from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVuePug from 'eslint-plugin-vue-pug/flat'
import pluginImport from 'eslint-plugin-import'
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

const isProduction = process.env.NODE_ENV === 'production'

const globalsNode = {
  ...globals.node,
  ...globals.jest
}

const globalsBrowser = {
  ...globals.browser,
  ...globals.es2022
}

export default [
  {
    ignores: [
      'node_modules/**/*',
      'packages/**/dist/**/*',
      'packages/**/*.test.js.snap',
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.vue']
  },
  pluginJs.configs.recommended,
  pluginPrettierRecommended,
  ...pluginVue.configs['flat/recommended'],
  pluginVuePug.configs['vue3-recommended'],
  pluginImport.flatConfigs.errors,
  pluginImport.flatConfigs.typescript,
  {
    languageOptions: {
      globals: globals.node,
      parser: vueParser,
      ecmaVersion: 2022,
      sourceType: 'module'
    },

    settings: {
      'import/resolver': {
        typescript: {
          project: '*/jsconfig.json',
          extensions: ['.js', '.vue']
        }
      }
    },

    rules: {
      ...getJsRules(),
      ...getVueRules()
    }
  },
  {
    files: ['packages/server/**/*'],
    languageOptions: {
      globals: globalsNode
    }
  },
  {
    files: ['packages/router/**/*'],
    languageOptions: {
      globals: globalsNode
    }
  },
  {
    files: ['packages/utils/**/*'],
    languageOptions: {
      globals: globalsNode
    }
  },
  {
    files: ['packages/admin/**/*'],
    languageOptions: {
      globals: globalsBrowser
    }
  },
  {
    files: ['packages/ui/**/*'],
    languageOptions: {
      globals: globalsBrowser
    }
  },
  {
    files: ['**/*.test.*'],

    languageOptions: {
      globals: globalsBrowser
    }
  },
  {
    files: ['**/*.d.ts'],

    languageOptions: {
      parser: tsParser
    },

    rules: {
      'import/export': 'off',
      'no-dupe-class-members': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-use-before-define': 'off'
    }
  }
]

function getJsRules() {
  return {
    'prettier/prettier': 'error',
    'array-bracket-spacing': ['error', 'never'],
    'dot-notation': 'error',

    'eqeqeq': ['error', 'always', { null: 'ignore' }],

    'generator-star-spacing': 'off',

    'lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true }
    ],

    'max-len': [
      'error',
      {
        code: 80,
        comments: 80,
        tabWidth: 2,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }
    ],

    'new-cap': [
      'error',
      {
        newIsCap: true,
        capIsNew: true,
        capIsNewExceptions: ['Knex'],
        capIsNewExceptionPattern: 'Mixin$'
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

    'no-async-promise-executor': 'off',
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-constant-condition': isProduction ? 'error' : 'warn',

    // Allow debugger during development.
    'no-debugger': isProduction ? 'error' : 'warn',
    'no-dupe-keys': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-fallthrough': ['error', { allowEmptyCase: true }],
    'no-prototype-builtins': 'off',
    'no-return-assign': 'error',
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
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.name='parseInt']:not(CallExpression[arguments.length=2])",
        message: 'Avoid using parseInt() without a radix. Use Number() instead.'
      },
      {
        selector: "CallExpression[callee.name='parseInt'] > Literal[value=10]",
        message:
          'Avoid using parseInt() with a radix of 10. Use Number() instead.'
      },
      {
        selector:
          "MemberExpression[object.property.name='to'][object.object.callee.name='expect']",
        message:
          'Avoid using Chai BDD-style `expect(...).to.<anything>`. Use Jest-style assertions like `toBe()`, `toEqual()`, `toThrow()`, etc.'
      },
      {
        selector:
          "MemberExpression[object.property.name='to'][object.object.object.callee.name='expect'][object.object.property.name='not']",
        message:
          'Avoid using Chai BDD-style `expect(...).not.to.<anything>`. Use Jest-style assertions like `not.toBe()`, `not.toEqual()`, `not.toThrow()`, etc.'
      }
    ]
  }
}

function getVueRules() {
  return {
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
  }
}
