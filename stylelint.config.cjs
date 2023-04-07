module.exports = {
  plugins: [
    // https://github.com/prettier/stylelint-prettier
    'stylelint-prettier',
    // https://github.com/kristerkari/stylelint-scss
    'stylelint-scss'
  ],
  extends: [
    // https://github.com/stylelint-scss/stylelint-config-standard-scss
    'stylelint-config-standard-scss',
    // https://github.com/pascalduez/stylelint-config-css-modules
    'stylelint-config-css-modules',
    // https://github.com/prettier/stylelint-prettier
    'stylelint-prettier/recommended'
  ],
  overrides: [
    {
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss'
    },
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html'
    }
  ],
  rules: {
    'prettier/prettier': true,
    'at-rule-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: ['after-comment'],
        ignoreAtRules: [
          'use',
          'import',
          'include',
          'if',
          'else',
          'each',
          'return'
        ]
      }
    ],
    'rule-empty-line-before': [
      'always',
      {
        except: ['first-nested', 'after-single-line-comment'],
        ignore: ['after-comment']
      }
    ],
    'color-hex-length': 'long',
    'comment-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: ['stylelint-commands'],
        ignoreComments: [/autoprefixer/]
      }
    ],
    'custom-property-empty-line-before': [
      'always',
      {
        except: ['first-nested', 'after-comment', 'after-custom-property']
      }
    ],
    'declaration-empty-line-before': [
      'always',
      {
        except: ['first-nested', 'after-comment', 'after-declaration']
      }
    ],
    'length-zero-no-unit': [true, { ignore: ['custom-properties'] }],
    'no-descending-specificity': [null, { ignore: ['selectors-within-list'] }],
    'no-duplicate-selectors': null,
    // Allow newlines inside class attribute values
    'string-no-newline': null,
    // Limit the number of universal selectors in a selector,
    // to avoid very slow selectors
    'selector-max-universal': 1,
    'scss/at-else-closing-brace-newline-after': 'always-last-in-chain',
    'scss/at-else-closing-brace-space-after': 'always-intermediate',
    'scss/at-else-empty-line-before': 'never',
    'scss/at-if-closing-brace-newline-after': 'always-last-in-chain',
    'scss/at-if-closing-brace-space-after': 'always-intermediate',
    'scss/at-import-no-partial-leading-underscore': null,
    'scss/at-import-partial-extension': null,
    'scss/comment-no-empty': null,
    'scss/dollar-variable-colon-space-after': 'always',
    'scss/dollar-variable-colon-space-before': 'never',
    'scss/dollar-variable-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: [
          'after-comment',
          'inside-single-line-block',
          'after-dollar-variable'
        ]
      }
    ],
    'scss/dollar-variable-no-missing-interpolation': true,
    'scss/dollar-variable-pattern': /^[a-z0-9-]+$/,
    'scss/double-slash-comment-empty-line-before': null,
    'scss/double-slash-comment-whitespace-inside': 'always',
    'scss/function-no-unknown': null,
    'scss/operator-no-newline-after': null,
    'scss/operator-no-newline-before': true,
    'scss/operator-no-unspaced': true,
    'scss/selector-no-redundant-nesting-selector': null,
    // Allow SCSS and CSS module keywords beginning with `@`
    'at-rule-no-unknown': null,
    'scss/at-rule-no-unknown': true,
    // Compatibility while update stylelint-config-standard to 24.0.0
    // TODO: Review those rules and enable the one that make sense.
    'font-family-name-quotes': null,
    'value-keyword-case': ['lower', { camelCaseSvgKeywords: true }],
    'value-no-vendor-prefix': null,
    'selector-class-pattern': null,
    'keyframes-name-pattern': null,
    'alpha-value-notation': null,
    'function-url-quotes': null,
    'shorthand-property-no-redundant-values': null,
    'property-no-vendor-prefix': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'custom-property-pattern': null,
    'hue-degree-notation': null,
    'function-no-unknown': null,
    'function-calc-no-unspaced-operator': null,
    'color-function-notation': null
  }
}
