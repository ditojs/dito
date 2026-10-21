// @ts-check
/// <reference types="@prettier/plugin-pug/src/prettier" />

/**
 * @type {import('prettier').Options}
 */
export default {
  plugins: ['@prettier/plugin-pug', 'prettier-plugin-penere'],
  printWidth: 80,
  semi: false,
  singleQuote: true,
  quoteProps: 'consistent',
  arrowParens: 'avoid',
  trailingComma: 'none',
  wrap: 'preserve',
  pugFramework: 'vue',
  pugSingleQuote: false,
  pugAttributeSeparator: 'none',
  pugCommentPreserveSpaces: 'trim-all',
  pugWrapAttributesThreshold: 1,
  pugWrapAttributesPattern: '^(@|v-)',
  overrides: [
    {
      // Keep the content of `html` templates, whose whitespace is content. Not
      // in Vue files, where the option turns off formatting of their blocks:
      files: '*.{js,ts}',
      options: { embeddedLanguageFormatting: 'off' }
    }
  ]
}
