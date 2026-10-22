// Type definitions for Dito.js schema
// Project: <https://github.com/ditojs/dito/>

/**
 * A keyword definition: validates values against the keyword's setting, and
 * describes the setting in its message.
 */
export interface Keyword<Setting = unknown> {
  validate(value: unknown, setting: Setting): boolean
  message: string | ((setting: Setting) => string)
  /** Validate empty values too, which the admin skips for other definitions. */
  validatesEmptyValues?: boolean
}

/**
 * A format definition: a keyword without a setting.
 */
export interface Format extends Keyword<undefined> {
  validate(value: unknown): boolean
  message: string
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
  _enum: Pick<Keyword<unknown[]>, 'message'>
  minimum: Keyword<number>
  maximum: Keyword<number>
  range: Keyword<[number, number]>
  multipleOf: Pick<Keyword<number>, 'message'>
  decimals: Keyword<number | '*' | undefined>
  minLength: Keyword<number>
  maxLength: Keyword<number>
  pattern: Keyword<string>
  minItems: Keyword<number>
  maxItems: Keyword<number>
}
