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
  pugWrapAttributesPattern: '^(@|v-)'
}
