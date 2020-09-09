/// <reference types="node" />

// Type definitions for Dito.js utils
// Project: <https://github.com/ditojs/dito/>

// Export the entire Utils namespace.

export = Utils

declare namespace Utils {
  /*---------------------------------- base ----------------------------------*/

  /**
   * Determines whether both supplied values are the same value, using the
   * SameValue algorithm.
   * @see {@link http://ecma-international.org/ecma-262/5.1/#sec-9.12 The SameValue Algorithm}
   */
  function is(value1: any, value2: any): boolean

  /**
   * Determines whether the supplied value is a plain object.
   */
  function isPlainObject(arg: any): boolean

  /**
   * Determines whether the supplied value is an object.
   */
  function isObject(arg: any): boolean

  /**
   * Determines whether the supplied value is a function.
   */
  function isFunction(arg: any): arg is (...args: any[]) => any

  /**
   * Determines whether the supplied value is a number.
   */
  function isNumber(arg: any): arg is number

  /**
   * Determines whether the supplied value is a string.
   */
  function isString(arg: any): arg is string | String

  /**
   * Determines whether the supplied value is a boolean.
   */
  function isBoolean(arg: any): arg is boolean

  /**
   * Determines whether the supplied value is a Date object.
   */
  function isDate(arg: any): arg is Date

  /**
   * Determines whether the supplied value is a regular expression (RegExp).
   */
  function isRegExp(arg: any): arg is RegExp

  /**
   * Determines whether the supplied value is a Promise.
   */
  function isPromise(arg: any): arg is Promise<any>

  /**
   * Determines whether the supplied value is an integer.
   */
  function isInteger(arg: any): boolean

  /**
   * Determines whether the supplied value is an async function.
   */
  function isAsync(arg: any): boolean

  /**
   * Determines whether the supplied value is array like, i.e. it has a length
   • property between `0` and `Number.MAX_SAFE_INTEGER` and is not a function.
   */
  function isArrayLike(arg: any): arg is any[]

  /**
   * Determines whether the supplied value can be considered empty,
   * i.e. undefined, null, an empty string, or an object without properties.
   */
  function isEmpty(o: any): boolean

  /**
   * Returns the supplied value as an object. The most frequent use case is to
   * add properties to a primitive. As primitives are immutable, they need to be
   * converted to an object in order to do so.
   *
   * @see {@link https://2ality.com/2011/04/javascript-converting-any-value-to.html JavaScript: converting any value to an object}
   */
  function asObject<O extends {}, T extends any>(arg: T): T & O

  /**
   * Returns the supplied value as an array.
   *
   * When the supplied value is an array, the original array is returned. When
   * the supplied value is undefined, an empty array is returned. Otherwise an
   * array is returned containing the supplied value as its only element.
   */
  function asArray<T extends any>(o: T): T extends any[] ? T : T[]

  /**
   * Returns the supplied value as a function.
   *
   * When the supplied value is a function, the original function is returned.
   * Otherwise a function is returned that returns the value when called.
   */
  function asFunction<T extends any>(o: T): T extends Function ? T : () => T

  /*--------------------------------- object ---------------------------------*/

  /**
   * Performs a deep (recursive) clone on the supplied value.
   */
  function clone<T extends any>(arg: T, iteratee?: (arg: any) => void): T

  /**
   * Determines whether the supplied values can be considered equal through
   * recursive comparison of object properties and array elements. Non-objects
   * and non-arrays are compared using the SameValue algorithm.
   */
  function equals(arg1: any, arg2: any): boolean

  // TODO: document groupBy
  function groupBy<T>(
    collection: List<T>,
    iteratee?: ValueIteratee<T, NotVoid>
  ): Dictionary<T[]>

  function groupBy<T extends object>(
    collection: T,
    iteratee?: ValueIteratee<T, NotVoid>
  ): Dictionary<Array<T[keyof T]>>

  // TODO: document merge
  function merge<ArgA, ArgB>(a: ArgA, b: ArgB): ArgA & ArgB
  function merge<ArgA, ArgB, ArgC>(
    a: ArgA,
    b: ArgB,
    c: ArgC
  ): ArgA & ArgB & ArgC
  function merge<ArgA, ArgB, ArgC, ArgD>(
    a: ArgA,
    b: ArgB,
    c: ArgC,
    d: ArgD
  ): ArgA & ArgB & ArgC & ArgD
  function merge<ArgA, ArgB, ArgC, ArgD, ArgE>(
    a: ArgA,
    b: ArgB,
    c: ArgC,
    d: ArgD,
    e: ArgE
  ): ArgA & ArgB & ArgC & ArgD & ArgE
  function merge(...args: any[]): any

  /**
   * Returns the first argument which is not undefined.
   */
  function pick<ArgA, ArgB>(a: ArgA, b: ArgB): ArgA | ArgB
  function pick<ArgA, ArgB, ArgC>(a: ArgA, b: ArgB, c: ArgC): ArgA | ArgB | ArgC
  function pick<ArgA, ArgB, ArgC, ArgD>(
    a: ArgA,
    b: ArgB,
    c: ArgC,
    d: ArgD
  ): ArgA | ArgB | ArgC | ArgD
  function pick<ArgA, ArgB, ArgC, ArgD, ArgE>(
    a: ArgA,
    b: ArgB,
    c: ArgC,
    d: ArgD,
    e: ArgE
  ): ArgA | ArgB | ArgC | ArgD | ArgE
  function pick(...args: any[]): any
  /**
   * Creates an object composed of the object properties predicate returns
   * truthy for.
   * @param object The source object.
   * @param iteratee The key accessed per property or the function invoked with
   * three arguments: (value, key, item).
   */
  function pickBy<T extends Dictionary<any>>(
    object: T,
    iteratee?: ValueIteratee<T, boolean>
  ): Partial<T>

  /*--------------------------------- string ---------------------------------*/

  /**
   * Converts a string seperated by spaces, dashes and underscores to camel-case
   * (`'camelCase'`) or optionally pascal-case (`'CamelCase'`).
   */
  function camelize(str: string, pascalCase?: boolean): string
  /**
   * Capitalizes words in a string.
   */
  function capitalize(str: string): string
  /**
   * Convert a string from camel-case to a string seperated by spaces or a
   * supplied seperator string.
   *
   * @param str The string to decamelize.
   * @param {string} [sep=' '] -  The string to seperate the decamelized words with.
   */
  function decamelize(str: string, sep?: string): string
  /**
   * Converts a camelized string to a string seperated by dashes.
   */
  function hyphenate(str: string): string
  /**
   * Converts a camelized string to a string seperated by underscores.
   */
  function underscore(str: string): string
  /**
   * ES6 string tag that strips indentation from multi-line strings.
   *
   * @example
   * const str = deindent`Such a long string that you need to break it
   *                      over multiple lines. Such a long string that
   *                      you need to break it over multiple lines.`
   * console.log(str)
   */
  function deindent(
    strings: OrArrayOf<string>,
    ...values: Array<string>
  ): string
  /**
   * Returns the longest prefix string that is common to both supplied strings.
   */
  function getCommonPrefix(str1: string, str2: string): string
  /**
   * Returns the offset of the longest prefix string that is common to both
   * supplied strings.
   */
  function getCommonOffset(str1: string, str2: string): number
  /**
   * Determines whether the supplied string is an absolute url.
   *
   * A URL is considered absolute if it begins with "<scheme>://" or "//"
   * (protocol-relative URL).  RFC 3986 defines scheme name as a sequence of
   * characters beginning with a letter and followed by any combination of
   * letters, digits, plus, period, or hyphen.
   */
  function isAbsoluteUrl(str: string): boolean
  /**
   * Determines whether the supplied string is a valid creditcard number.
   */
  function isCreditCard(str: string): boolean
  /**
   * Determines whether the supplied string is a valid email address.
   */
  function isEmail(str: string): boolean
  /**
   * Determines whether the string is a valid hostname.
   */
  function isHostname(str: string): boolean
  /**
   * Determines whether the string is a valid url.
   */
  function isUrl(str: string): boolean
  /**
   * Expands hyphenated, underscored and camel-cased strings to title case.
   */
  function labelize(str: string): string

  /*---------------------------------- array ---------------------------------*/

  /**
   * Recursively flattens a nested array.
   *
   * @param array The array to recursively flatten.
   * @param [maxDepth] The maximum recursion depth.
   * @return Returns the new flattened array.
   */
  function flatten<T>(array: RecursiveArray<T>, maxDepth?: number): T[]

  /**
   * Shuffle an array using the Fisher-Yates (aka Knuth) Shuffle.
   *
   * @param array The array to shuffle.
   * @returns Returns the newly shuffled array.
   */
  function shuffle<T>(array: T[]): T[]

  /*---------------------------------- date ----------------------------------*/

  const defaultDateFormat: {
    day: 'numeric'
    month: 'long'
    year: 'numeric'
  }

  const defaultTimeFormat: {
    hour: '2-digit'
    minute: '2-digit'
    second: '2-digit'
  }

  interface TimeFormat {
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

  interface DateFormat {
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

  /**
   * Formats the date as a string.
   */
  function formatDate(
    date: Date,
    options?: {
      locale: string
      date?: boolean | DateFormat
      time?: boolean | TimeFormat
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
  function debounce<T extends (...args: any[]) => any>(
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
  function debounceAsync<T extends (...args: any[]) => Promise<any>>(
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
  interface CustomPromisifyLegacy<TCustom extends Function> extends Function {
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
  function toAsync<TCustom extends Function>(
    fn: CustomToAsync<TCustom>
  ): TCustom
  function toAsync<R>(
    fn: (callback: (err: any, result: R) => void) => void
  ): () => Promise<R>
  function toAsync(
    fn: (callback: (err?: any) => void) => void
  ): () => Promise<void>
  function toAsync<T1, R>(
    fn: (arg1: T1, callback: (err: any, result: R) => void) => void
  ): (arg1: T1) => Promise<R>
  function toAsync<T1>(
    fn: (arg1: T1, callback: (err?: any) => void) => void
  ): (arg1: T1) => Promise<void>
  function toAsync<T1, T2, R>(
    fn: (arg1: T1, arg2: T2, callback: (err: any, result: R) => void) => void
  ): (arg1: T1, arg2: T2) => Promise<R>
  function toAsync<T1, T2>(
    fn: (arg1: T1, arg2: T2, callback: (err?: any) => void) => void
  ): (arg1: T1, arg2: T2) => Promise<void>
  function toAsync<T1, T2, T3, R>(
    fn: (
      arg1: T1,
      arg2: T2,
      arg3: T3,
      callback: (err: any, result: R) => void
    ) => void
  ): (arg1: T1, arg2: T2, arg3: T3) => Promise<R>
  function toAsync<T1, T2, T3>(
    fn: (arg1: T1, arg2: T2, arg3: T3, callback: (err?: any) => void) => void
  ): (arg1: T1, arg2: T2, arg3: T3) => Promise<void>
  function toAsync<T1, T2, T3, T4, R>(
    fn: (
      arg1: T1,
      arg2: T2,
      arg3: T3,
      arg4: T4,
      callback: (err: any, result: R) => void
    ) => void
  ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<R>
  function toAsync<T1, T2, T3, T4>(
    fn: (
      arg1: T1,
      arg2: T2,
      arg3: T3,
      arg4: T4,
      callback: (err?: any) => void
    ) => void
  ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>
  function toAsync<T1, T2, T3, T4, T5, R>(
    fn: (
      arg1: T1,
      arg2: T2,
      arg3: T3,
      arg4: T4,
      arg5: T5,
      callback: (err: any, result: R) => void
    ) => void
  ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<R>
  function toAsync<T1, T2, T3, T4, T5>(
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
  function toCallback(
    fn: () => Promise<void>
  ): (callback: (err: any) => void) => void
  function toCallback<R>(
    fn: () => Promise<R>
  ): (callback: (err: any, result: R) => void) => void
  function toCallback<T1>(
    fn: (arg1: T1) => Promise<void>
  ): (arg1: T1, callback: (err: any) => void) => void
  function toCallback<T1, R>(
    fn: (arg1: T1) => Promise<R>
  ): (arg1: T1, callback: (err: any, result: R) => void) => void
  function toCallback<T1, T2>(
    fn: (arg1: T1, arg2: T2) => Promise<void>
  ): (arg1: T1, arg2: T2, callback: (err: any) => void) => void
  function toCallback<T1, T2, R>(
    fn: (arg1: T1, arg2: T2) => Promise<R>
  ): (
    arg1: T1,
    arg2: T2,
    callback: (err: any | null, result: R) => void
  ) => void
  function toCallback<T1, T2, T3>(
    fn: (arg1: T1, arg2: T2, arg3: T3) => Promise<void>
  ): (arg1: T1, arg2: T2, arg3: T3, callback: (err: any) => void) => void
  function toCallback<T1, T2, T3, R>(
    fn: (arg1: T1, arg2: T2, arg3: T3) => Promise<R>
  ): (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    callback: (err: any | null, result: R) => void
  ) => void
  function toCallback<T1, T2, T3, T4>(
    fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>
  ): (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    callback: (err: any) => void
  ) => void
  function toCallback<T1, T2, T3, T4, R>(
    fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<R>
  ): (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    callback: (err: any | null, result: R) => void
  ) => void
  function toCallback<T1, T2, T3, T4, T5>(
    fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<void>
  ): (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    arg5: T5,
    callback: (err: any) => void
  ) => void
  function toCallback<T1, T2, T3, T4, T5, R>(
    fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<R>
  ): (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    arg5: T5,
    callback: (err: any | null, result: R) => void
  ) => void
  function toCallback<T1, T2, T3, T4, T5, T6>(
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
  function toCallback<T1, T2, T3, T4, T5, T6, R>(
    fn: (
      arg1: T1,
      arg2: T2,
      arg3: T3,
      arg4: T4,
      arg5: T5,
      arg6: T6
    ) => Promise<R>
  ): (
    arg1: T1,
    arg2: T2,
    arg3: T3,
    arg4: T4,
    arg5: T5,
    arg6: T6,
    callback: (err: any | null, result: R) => void
  ) => void

  function toPromiseCallback<T extends any, R extends any>(
    resolve: (value: T) => void,
    reject: (reason: R) => void
  ): (err: R, res: T) => void

  /*-------------------------------- dataPath --------------------------------*/

  function getDataPath(
    obj: any,
    path: OrArrayOf<string>,
    handleError?: (obj: any, part: string, index: number) => void
  ): any

  function normalizeDataPath(path: OrArrayOf<string>): string

  function parseDataPath(path: OrArrayOf<string>): string

  function setDataPath<O>(obj: O, path: OrArrayOf<string>, value: any): O

  /*---------------------------------- html ----------------------------------*/

  /**
   * Escapes quotes, ampersands, and smaller/greater than signs (`&<>'"`).

   * @param html The html to escape.
   * @returns The newly escaped html.
   */
  function escapeHtml(html: string): string

  /**
   * Strips HTML tags from the string.
   * @param html The string to strip.
   * @returns The newly stripped string.
   */
  function stripTags(html: string): string

  /*-------------------------- typescript utilities --------------------------*/
  type PropertyName = string | number | symbol
  type NotVoid = {} | null | undefined
  type ValueIteratee<T, R> =
    | ((value: T[keyof T], key: keyof T, object: T) => R)
    | PropertyName
  type List<T> = ArrayLike<T>
  interface ArrayLike<T> {
    readonly length: number
    readonly [n: number]: T
  }
  interface Dictionary<T> {
    [index: string]: T
  }
  interface RecursiveArray<T> extends Array<T | RecursiveArray<T>> {}
  type OrArrayOf<T> = T | T[]
}
