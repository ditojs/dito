// Type definitions for Dito.js utils
// Project: <https://github.com/ditojs/dito/>

/*---------------------------------- base ----------------------------------*/

/**
 * Determines whether both supplied values are the same value, using the
 * SameValue algorithm.
 * @see {@link http://ecma-international.org/ecma-262/5.1/#sec-9.12 The SameValue Algorithm}
 */
export function is(value1: any, value2: any): boolean

/**
 * Determines whether the supplied value is a plain object.
 */
export function isPlainObject(arg: any): boolean

/**
 * Determines whether the supplied value is an object.
 */
export function isObject(arg: any): boolean

/**
 * Determines whether the supplied value is a function.
 */
export function isFunction(arg: any): arg is (...args: any[]) => any

/**
 * Determines whether the supplied value is a number.
 */
export function isNumber(arg: any): arg is number

/**
 * Determines whether the supplied value is a string.
 */
export function isString(arg: any): arg is string | String

/**
 * Determines whether the supplied value is a boolean.
 */
export function isBoolean(arg: any): arg is boolean

/**
 * Determines whether the supplied value is a Date object.
 */
export function isDate(arg: any): arg is Date

/**
 * Determines whether the supplied value is a regular expression (RegExp).
 */
export function isRegExp(arg: any): arg is RegExp

/**
 * Determines whether the supplied value is a Promise.
 */
export function isPromise(arg: any): arg is Promise<any>

/**
 * Determines whether the supplied value is an integer.
 */
export function isInteger(arg: any): boolean

/**
 * Determines whether the supplied value is an async function.
 */
export function isAsync(arg: any): boolean

/**
   * Determines whether the supplied value is array like, i.e. it has a length
   • property between `0` and `Number.MAX_SAFE_INTEGER` and is not a function.
   */
export function isArrayLike(arg: any): arg is any[]

/**
 * Determines whether the supplied value can be considered empty,
 * i.e. undefined, null, an empty string, or an object without properties.
 */
export function isEmpty(o: any): boolean

/**
 * Returns the supplied value as an object. The most frequent use case is to
 * add properties to a primitive. As primitives are immutable, they need to be
 * converted to an object in order to do so.
 *
 * @see {@link https://2ality.com/2011/04/javascript-converting-any-value-to.html JavaScript: converting any value to an object}
 */
export function asObject<O extends {}, T extends any>(arg: T): T & O

/**
 * Returns the supplied value as an array.
 *
 * When the supplied value is an array, the original array is returned. When
 * the supplied value is undefined, an empty array is returned. Otherwise an
 * array is returned containing the supplied value as its only element.
 */
export function asArray<T extends any>(o: T): T extends any[] ? T : T[]

/**
 * Returns the supplied value as a function.
 *
 * When the supplied value is a function, the original function is returned.
 * Otherwise a function is returned that returns the value when called.
 */
export function asFunction<T extends any>(o: T): T extends Function ? T : () => T

/*--------------------------------- object ---------------------------------*/

/**
 * Performs a deep (recursive) clone on the supplied value.
 */
export function clone<T extends any>(arg: T, iteratee?: (arg: any) => void): T

/**
 * Determines whether the supplied values can be considered equal through
 * recursive comparison of object properties and array elements. Non-objects
 * and non-arrays are compared using the SameValue algorithm.
 */
export function equals(arg1: any, arg2: any): boolean

// TODO: document groupBy
export function groupBy<T, K extends string | number | Symbol>(
  list: T[], callback: (item: T) => K
): Record<K, T[]>

// TODO: document merge
export function merge<ArgA, ArgB>(a: ArgA, b: ArgB): ArgA & ArgB
export function merge<ArgA, ArgB, ArgC>(a: ArgA, b: ArgB, c: ArgC): ArgA & ArgB & ArgC
export function merge<ArgA, ArgB, ArgC, ArgD>(
  a: ArgA,
  b: ArgB,
  c: ArgC,
  d: ArgD
): ArgA & ArgB & ArgC & ArgD
export function merge<ArgA, ArgB, ArgC, ArgD, ArgE>(
  a: ArgA,
  b: ArgB,
  c: ArgC,
  d: ArgD,
  e: ArgE
): ArgA & ArgB & ArgC & ArgD & ArgE
export function merge(...args: any[]): any

/**
 * Returns the first argument which is not undefined.
 */
export function pick<ArgA, ArgB>(a: ArgA, b: ArgB): ArgA | ArgB
export function pick<ArgA, ArgB, ArgC>(a: ArgA, b: ArgB, c: ArgC): ArgA | ArgB | ArgC
export function pick<ArgA, ArgB, ArgC, ArgD>(
  a: ArgA,
  b: ArgB,
  c: ArgC,
  d: ArgD
): ArgA | ArgB | ArgC | ArgD
export function pick<ArgA, ArgB, ArgC, ArgD, ArgE>(
  a: ArgA,
  b: ArgB,
  c: ArgC,
  d: ArgD,
  e: ArgE
): ArgA | ArgB | ArgC | ArgD | ArgE
export function pick(...args: any[]): any
/**
 * Creates an object composed of the object properties predicate returns
 * truthy for.
 * @param object The source object.
 * @param callback Callback invoked with three arguments: (value, key, item).
 */
 export function pickBy<T extends Dictionary<any>>(
  object: T,
  callback?: (value: T[keyof T], key: keyof T, object: T) => any
): Partial<T>

export function mapKeys<T extends Dictionary<any>, K extends keyof any>(
  object: T,
  callback?: (key: keyof T, value: T[keyof T], object: T) => K
): Record<K, T[keyof T]>

export function mapValues<T extends Dictionary<any>, K>(
  object: T,
  callback?: (value: T[keyof T], key: keyof T, object: T) => K
): Record<keyof T, K>

/*--------------------------------- string ---------------------------------*/

/**
 * Converts a string seperated by spaces, dashes and underscores to camel-case
 * (`'camelCase'`) or optionally pascal-case (`'CamelCase'`).
 */
export function camelize(str: string, pascalCase?: boolean): string
/**
 * Capitalizes words in a string.
 */
export function capitalize(str: string): string
/**
 * Convert a string from camel-case to a string seperated by spaces or a
 * supplied seperator string.
 *
 * @param str The string to decamelize.
 * @param {string} [sep=' '] -  The string to seperate the decamelized words with.
 */
export function decamelize(str: string, sep?: string): string
/**
 * Converts a camelized string to a string seperated by dashes.
 */
export function hyphenate(str: string): string
/**
 * Converts a camelized string to a string seperated by underscores.
 */
export function underscore(str: string): string
/**
 * ES6 string tag that strips indentation from multi-line strings.
 *
 * @example
 * const str = deindent`Such a long string that you need to break it
 *                      over multiple lines. Such a long string that
 *                      you need to break it over multiple lines.`
 * console.log(str)
 */
export function deindent(strings: OrArrayOf<string>, ...values: Array<string>): string
/**
 * Returns the longest prefix string that is common to both supplied strings.
 */
export function getCommonPrefix(str1: string, str2: string): string
/**
 * Returns the offset of the longest prefix string that is common to both
 * supplied strings.
 */
export function getCommonOffset(str1: string, str2: string): number
/**
 * Determines whether the supplied string is an absolute url.
 *
 * A URL is considered absolute if it begins with "<scheme>://" or "//"
 * (protocol-relative URL).  RFC 3986 defines scheme name as a sequence of
 * characters beginning with a letter and followed by any combination of
 * letters, digits, plus, period, or hyphen.
 */
export function isAbsoluteUrl(str: string): boolean
/**
 * Determines whether the supplied string is a valid creditcard number.
 */
export function isCreditCard(str: string): boolean
/**
 * Determines whether the supplied string is a valid email address.
 */
export function isEmail(str: string): boolean
/**
 * Determines whether the string is a valid hostname.
 */
export function isHostname(str: string): boolean
/**
 * Determines whether the string is a valid url.
 */
export function isUrl(str: string): boolean
/**
 * Expands hyphenated, underscored and camel-cased strings to title case.
 */
export function labelize(str: string | undefined): string

/*---------------------------------- array ---------------------------------*/

/**
 * Recursively flattens a nested array.
 *
 * @param array The array to recursively flatten.
 * @param [maxDepth] The maximum recursion depth.
 * @return Returns the new flattened array.
 */
export function flatten<T>(array: RecursiveArray<T>, maxDepth?: number): T[]

/**
 * Shuffle an array using the Fisher-Yates (aka Knuth) Shuffle.
 *
 * @param array The array to shuffle.
 * @returns Returns the newly shuffled array.
 */
export function shuffle<T>(array: T[]): T[]

/*---------------------------------- date ----------------------------------*/

export interface TimeFormat {
  /**
   * @defaultValue `'2-digit'`
   */
  hour?: boolean | 'numeric' | '2-digit'
  /**
   * @defaultValue `'2-digit'`
   */
  minute?: boolean | 'numeric' | '2-digit'
  /**
   * @defaultValue `'2-digit'`
   */
  second?: boolean | 'numeric' | '2-digit'

  format?: (
    value: string,
    type: Intl.DateTimeFormatPartTypes,
    options: Omit<TimeFormat, 'format'>
  ) => string
}

export interface DateFormat {
  /**
   * @defaultValue `'numeric'`
   */
  day?: boolean | 'numeric' | '2-digit'
  /**
   * @defaultValue `'long'`
   */
  month?: boolean | 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
  /**
   * @defaultValue `'numeric'`
   */
  year?: boolean | 'numeric' | '2-digit'
  /**
   * Format date in a custom way.
   */
  format?: (
    value: string,
    type: Intl.DateTimeFormatPartTypes,
    options: Omit<DateFormat, 'format'>
  ) => string
}

export interface NumberFormat extends Intl.NumberFormatOptions {
  format?: (
    value: string,
    type: Intl.NumberFormatPartTypes,
    options: Intl.NumberFormatOptions
  ) => string | undefined
}

/**
 * Formats the value as a string.
 */
export function format(
  value: Date,
  options?: {
    /**
     * @default 'en-US'
     */
    locale?: string
    date?: boolean | DateFormat
    time?: boolean | TimeFormat
    number?: boolean | NumberFormat
  }
): string
/*-------------------------------- function --------------------------------*/

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a cancel method to cancel
 * delayed invocations. Provide an options object to indicate that func
 * should be invoked on the leading edge of the wait timeout. Subsequent
 * calls to the debounced function return the result of the last func
 * invocation.
 *
 * @param func The function to debounce.
 * @param options The options object or the number of milliseconds to delay.
 * @param options.delay The number of milliseconds to delay.
 * @param options.immediate Specify invoking on the leading edge of the timeout.
 * @return Returns the new debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  options:
    | number
    | {
        delay: number
        immediate?: boolean
      }
): T & { cancel: () => boolean }

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
 *
 * Each time the debounced function is called, it returns a promise
 * which will resolve to the value that the debounced async function resolves
 * to. If the async function throws an error, the last waiting promise is
 * rejected and all others are resolved with undefined.
 *
 * The debounced function comes with a cancel method to cancel
 * delayed invocations. Provide an options object to indicate that func
 * should be invoked on the leading edge of the wait timeout.
 *
 * @param func The function to debounce.
 * @param options The options object or the number of milliseconds to delay.
 * @param options.delay The number of milliseconds to delay.
 * @param options.immediate Specify invoking on the leading edge of the timeout.
 * @return Returns the new debounced function.
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  options:
    | number
    | {
        delay: number
        immediate?: boolean
      }
): T & { cancel: () => boolean }

// Adjusted version of @types/node's promisify (which includes support for overloaded
// node function types), excluding the custom promisified function
// functionality, which toAsync does not support:
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/fa723dee727e433add7e700420523f0f90e87a01/types/node/util.d.ts#L86
export interface CustomPromisifyLegacy<TCustom extends Function> extends Function {
  __promisify__: TCustom
}
type CustomToAsync<TCustom extends Function> = CustomPromisifyLegacy<TCustom>
/**
 * Takes a function following the common error-first callback style, i.e.
 * taking an (err, value) => ... callback as the last argument, and returns a
 * version that returns promises.
 *
 * @param fn function following the error-first callback style
 */
export function toAsync<TCustom extends Function>(fn: CustomToAsync<TCustom>): TCustom
export function toAsync<R>(
  fn: (callback: (err: any, result: R) => void) => void
): () => Promise<R>
export function toAsync(
  fn: (callback: (err?: any) => void) => void
): () => Promise<void>
export function toAsync<T1, R>(
  fn: (arg1: T1, callback: (err: any, result: R) => void) => void
): (arg1: T1) => Promise<R>
export function toAsync<T1>(
  fn: (arg1: T1, callback: (err?: any) => void) => void
): (arg1: T1) => Promise<void>
export function toAsync<T1, T2, R>(
  fn: (arg1: T1, arg2: T2, callback: (err: any, result: R) => void) => void
): (arg1: T1, arg2: T2) => Promise<R>
export function toAsync<T1, T2>(
  fn: (arg1: T1, arg2: T2, callback: (err?: any) => void) => void
): (arg1: T1, arg2: T2) => Promise<void>
export function toAsync<T1, T2, T3, R>(
  fn: (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    callback: (err: any, result: R) => void
  ) => void
): (arg1: T1, arg2: T2, arg3: T3) => Promise<R>
export function toAsync<T1, T2, T3>(
  fn: (arg1: T1, arg2: T2, arg3: T3, callback: (err?: any) => void) => void
): (arg1: T1, arg2: T2, arg3: T3) => Promise<void>
export function toAsync<T1, T2, T3, T4, R>(
  fn: (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    callback: (err: any, result: R) => void
  ) => void
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<R>
export function toAsync<T1, T2, T3, T4>(
  fn: (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    callback: (err?: any) => void
  ) => void
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>
export function toAsync<T1, T2, T3, T4, T5, R>(
  fn: (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    arg5: T5,
    callback: (err: any, result: R) => void
  ) => void
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<R>
export function toAsync<T1, T2, T3, T4, T5>(
  fn: (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    arg5: T5,
    callback: (err?: any) => void
  ) => void
): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<void>

/**
 * Takes an async function (or a function that returns a Promise) and returns
 * a function following the error-first callback style, i.e. taking an
 * (err, value) => ... callback as the last argument.
 */
export function toCallback(
  fn: () => Promise<void>
): (callback: (err: any) => void) => void
export function toCallback<R>(
  fn: () => Promise<R>
): (callback: (err: any, result: R) => void) => void
export function toCallback<T1>(
  fn: (arg1: T1) => Promise<void>
): (arg1: T1, callback: (err: any) => void) => void
export function toCallback<T1, R>(
  fn: (arg1: T1) => Promise<R>
): (arg1: T1, callback: (err: any, result: R) => void) => void
export function toCallback<T1, T2>(
  fn: (arg1: T1, arg2: T2) => Promise<void>
): (arg1: T1, arg2: T2, callback: (err: any) => void) => void
export function toCallback<T1, T2, R>(
  fn: (arg1: T1, arg2: T2) => Promise<R>
): (arg1: T1, arg2: T2, callback: (err: any | null, result: R) => void) => void
export function toCallback<T1, T2, T3>(
  fn: (arg1: T1, arg2: T2, arg3: T3) => Promise<void>
): (arg1: T1, arg2: T2, arg3: T3, callback: (err: any) => void) => void
export function toCallback<T1, T2, T3, R>(
  fn: (arg1: T1, arg2: T2, arg3: T3) => Promise<R>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  callback: (err: any | null, result: R) => void
) => void
export function toCallback<T1, T2, T3, T4>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  arg4: T4,
  callback: (err: any) => void
) => void
export function toCallback<T1, T2, T3, T4, R>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<R>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  arg4: T4,
  callback: (err: any | null, result: R) => void
) => void
export function toCallback<T1, T2, T3, T4, T5>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<void>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  arg4: T4,
  arg5: T5,
  callback: (err: any) => void
) => void
export function toCallback<T1, T2, T3, T4, T5, R>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<R>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  arg4: T4,
  arg5: T5,
  callback: (err: any | null, result: R) => void
) => void
export function toCallback<T1, T2, T3, T4, T5, T6>(
  fn: (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    arg5: T5,
    arg6: T6
  ) => Promise<void>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  arg4: T4,
  arg5: T5,
  arg6: T6,
  callback: (err: any) => void
) => void
export function toCallback<T1, T2, T3, T4, T5, T6, R>(
  fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, arg6: T6) => Promise<R>
): (
  arg1: T1,
  arg2: T2,
  arg3: T3,
  arg4: T4,
  arg5: T5,
  arg6: T6,
  callback: (err: any | null, result: R) => void
) => void

export function toPromiseCallback<T extends any, R extends any>(
  resolve: (value: T) => void,
  reject: (reason: R) => void
): (err: R, res: T) => void

/*-------------------------------- dataPath --------------------------------*/

export function getDataPath(
  obj: any,
  path: OrArrayOf<string>,
  handleError?: (obj: any, part: string, index: number) => void
): any

export function normalizeDataPath(path: OrArrayOf<string>): string

export function parseDataPath(path: OrArrayOf<string>): string

export function setDataPath<O>(obj: O, path: OrArrayOf<string>, value: any): O

/*---------------------------------- html ----------------------------------*/

/**
   * Escapes quotes, ampersands, and smaller/greater than signs (`&<>'"`).

   * @param html The html to escape.
   * @returns The newly escaped html.
   */
export function escapeHtml(html: string): string

/**
 * Strips HTML tags from the string.
 * @param html The string to strip.
 * @returns The newly stripped string.
 */
export function stripTags(html: string): string

/*-------------------------- typescript utilities --------------------------*/
type PropertyName = string | number | symbol
type NotVoid = {} | null | undefined
type List<T> = ArrayLike<T>
export interface ArrayLike<T> {
  readonly length: number
  readonly [n: number]: T
}
export interface Dictionary<T> {
  [index: string]: T
}
export interface RecursiveArray<T> extends Array<T | RecursiveArray<T>> {}
type OrArrayOf<T> = T | T[]
