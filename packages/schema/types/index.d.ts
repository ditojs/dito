// Type definitions for Dito.js schema
// Project: <https://github.com/ditojs/dito/>

/**
 * A format definition: validates values without a setting.
 */
export interface Format {
  validate(value: unknown): boolean
  message: string
}

/**
 * A keyword definition: validates values against the keyword's setting, and
 * describes the setting in its message.
 */
export interface Keyword<Setting = unknown> {
  validate(value: unknown, setting: Setting): boolean
  message: string | ((setting: Setting) => string)
}

/** The formats of Dito.js schemas. */
export const formats: {
  color: Format
  empty: Format
  required: Format
}

/**
 * The standard JSON Schema keywords and Dito.js's own ones. Keywords that are
 * reserved words are exported with a leading `_`.
 */
export const keywords: {
  type: Keyword<string | string[]>
  _enum: Keyword<unknown[]>
  minimum: Keyword<number>
  maximum: Keyword<number>
  range: Keyword<[number, number]>
  multipleOf: Keyword<number>
  decimals: Keyword<number | '*' | undefined>
  minLength: Keyword<number>
  maxLength: Keyword<number>
  pattern: Keyword<string>
  minItems: Keyword<number>
  maxItems: Keyword<number>
}
