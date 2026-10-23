# @ditojs/utils

```js
import { labelize, getValueAtDataPath, debounce } from '@ditojs/utils'
```

Small, dependency-free helpers used by the server, the admin and the UI, and
available to your own code in Node.js and in the browser. The package has one
entry point, `@ditojs/utils`, an ES module with TypeScript types.

## Contents

| Section | Exports |
| ------- | ------- |
| [Base and type checks](#base-and-type-checks) | `is()`, `isArray()`, `isPlainObject()`, `isPlainArray()`, `isObject()`, `isFunction()`, `isNumber()`, `isString()`, `isBoolean()`, `isModule()`, `isDate()`, `isRegExp()`, `isTypedArray()`, `isPromise()`, `isInteger()`, `isAsync()`, `isArrayLike()`, `isEmpty()`, `asObject()`, `asArray()`, `asFunction()` |
| [Arrays](#arrays) | `flatten()`, `shuffle()` |
| [Objects](#objects) | `clone()`, `equals()`, `groupBy()`, `mapKeys()`, `mapValues()`, `mergeDeeply()`, `assignDeeply()`, `pick()`, `pickBy()` |
| [Strings](#strings) | `camelize()`, `capitalize()`, `decamelize()`, `hyphenate()`, `underscore()`, `labelize()`, `deindent()`, `escapeRegExp()`, `getCommonPrefix()`, `getCommonOffset()`, `isAbsoluteUrl()`, `isUrl()`, `isDomain()`, `isHostname()`, `isEmail()`, `isCreditCard()` |
| [Dates and numbers](#dates-and-numbers) | `format()`, `formatDate()`, `defaultFormats`, `formatPlainDate()`, `parsePlainDate()` |
| [Data paths](#data-paths) | `parseDataPath()`, `normalizeDataPath()`, `resolveDataPath()`, `getValueAtDataPath()`, `getEntriesAtDataPath()`, `setValueAtDataPath()`, `setEntriesAtDataPath()` |
| [HTML](#html) | `html`, `isHtml()`, `asHtml()`, `escapeHtml()`, `stripHtml()` |
| [Functions](#functions) | `deprecate()`, `toAsync()`, `toCallback()`, `toPromiseCallback()` |
| [Timers](#timers) | `debounce()`, `debounceAsync()` |
| [Promises](#promises) | `mapConcurrently()`, `mapSequentially()` |
| [Classes](#classes) | `mixin()` |

The types also export the helper types `ArrayLike<T>`, `Dictionary<T>` and
`RecursiveArray<T>`, and the format option types `DateFormat`, `TimeFormat`
and `NumberFormat` (see [Dates and numbers](#dates-and-numbers)).

For the changes since 3.x, see [Upgrading to 4.x](../upgrading-to-4.x.md).

## Base and type checks

```js
import { isPlainObject, asArray } from '@ditojs/utils'
```

Type checks and conversions. All checks accept any value and return a
boolean; in TypeScript, most of them are type guards.

### Type checks

| Function | Returns `true` for |
| -------- | ------------------ |
| `is(value1, value2)` | The same value by the SameValue algorithm (`Object.is()`): `is(NaN, NaN)` is `true`, `is(0, -0)` is `false`. |
| `isArray(arg)` | Arrays (`Array.isArray()`). |
| `isPlainArray(arg)` | Arrays created by `Array`, not by subclasses. Also arrays from other realms, e.g. another `vm` context. |
| `isPlainObject(arg)` | Objects created by `Object`, object literals and `Object.create(null)`, also from other realms. Not class instances, arrays or ES module namespace objects. |
| `isObject(arg)` | Any non-null object that isn't an array, including class instances and dates. |
| `isFunction(arg)` | Functions, including classes and async functions. |
| `isNumber(arg)` | Numbers and `Number` objects, including `NaN` and `Infinity`. |
| `isString(arg)` | Strings and `String` objects. |
| `isBoolean(arg)` | Booleans and `Boolean` objects. |
| `isModule(arg)` | ES module namespace objects, e.g. from `import * as models`. |
| `isDate(arg)` | `Date` objects, also from other realms. |
| `isRegExp(arg)` | Regular expressions. |
| `isTypedArray(arg)` | Typed arrays, e.g. `Uint8Array`, including Node.js buffers, but not `DataView`. |
| `isPromise(arg)` | Objects with `then()` and `catch()` methods. |
| `isInteger(arg)` | Integer numbers (`Number.isInteger()`). |
| `isAsync(arg)` | Functions declared with `async`. Not regular functions that return promises. |
| `isArrayLike(arg)` | Values with a numeric `length` between `0` and `Number.MAX_SAFE_INTEGER` that aren't functions: arrays, strings, `arguments`, node lists. |
| `isEmpty(arg)` | `null`, `undefined`, array-likes with length `0` (including `''`), a `Map` or `Set` with size `0`, and other objects without own enumerable keys. A `Date`, `0` and `false` aren't empty. |

```js
isPlainObject({ title: 'Orlando' }) // true
isPlainObject(new Date()) // false
isObject(new Date()) // true
isEmpty('') // true
isEmpty({}) // true
isEmpty(0) // false
isEmpty(new Map()) // true
isEmpty(new Date()) // false
```

### asArray()

```js
asArray(arg)
```

Returns arrays as they are, `undefined` as `[]`, and any other value wrapped
in an array, including `null`.

```js
asArray('novel') // ['novel']
asArray(['novel', 'essay']) // ['novel', 'essay']
asArray(undefined) // []
asArray(null) // [null]
```

### asFunction()

```js
asFunction(arg)
```

Returns functions as they are, and any other value as a function that returns
it.

```js
const getPrice = asFunction(12)
getPrice() // 12
```

### asObject()

```js
asObject(arg)
```

Returns `Object(arg)`: primitives become their wrapper objects, so that
properties can be added to them. `null` and `undefined` are returned as they
are.

## Arrays

```js
import { flatten, shuffle } from '@ditojs/utils'
```

### flatten()

```js
flatten(array, maxDepth = Infinity)
```

Returns a new array with the nested arrays of `array` flattened into it, down
to `maxDepth` levels.

```js
flatten([1, [2, [3, [4]]]]) // [1, 2, 3, 4]
flatten([1, [2, [3, [4]]]], 1) // [1, 2, [3, [4]]]
```

### shuffle()

```js
shuffle(array)
```

Returns a new array with the elements of `array` in random order
(Fisher-Yates shuffle). `array` itself isn't changed.

```js
const featured = shuffle(books).slice(0, 3)
```

## Objects

```js
import { clone, equals, mergeDeeply } from '@ditojs/utils'
```

### clone()

```js
clone(value, options?)
```

Returns a deep copy of `value`. Handles circular references, and keeps the
prototype of objects without calling their constructor.

- Dates, regular expressions and typed arrays, including Node.js buffers, are
  copied.
- Objects with a `clone()` method are copied by calling `value.clone(options)`.
- Promises are copied as `value.then()`.
- Other objects get the own keys of `value`, copied recursively. This doesn't
  work for objects that keep their data internally, like maps and sets.
- Primitives and functions are returned as they are.

| Option | Default | Description |
| ------ | ------- | ----------- |
| `shallow` | `false` | Copies only the top level; nested values are shared. |
| `enumerable` | `true` | Copies only own enumerable string keys (`Object.keys()`). With `false`, all own keys, including non-enumerable and symbol keys. |
| `descriptors` | `!enumerable` | Copies the property descriptors, so that getters, setters and read-only properties stay what they are. |
| `transferables` | `null` | An array of values that are kept as references instead of being copied. |
| `processValue` | `null` | `(copy) => value`, called with every copied value. A returned value other than `undefined` replaces the copy. |

```js
const draft = clone(book)
draft.chapters.push({ title: 'Epilogue' }) // `book.chapters` is unchanged
```

### equals()

```js
equals(arg1, arg2)
```

Compares two values deeply: arrays and typed arrays element by element, objects
by their own enumerable keys, and everything else by `valueOf()`, so that dates
with the same time are equal, and so are `NaN` and `NaN`, or `0` and `-0`.
Values of different types are never equal, and there is no type coercion: `1`
and `'1'` differ. Maps, sets and regular expressions aren't supported, as they
have no keys to compare.

```js
equals({ tags: ['novel'] }, { tags: ['novel'] }) // true
equals(new Date(2026, 4, 14), new Date(2026, 4, 14)) // true
equals(1, '1') // false
```

### groupBy()

```js
groupBy(collection, callback)
```

Groups the items of an array, or the values of an object, into an object of
arrays, keyed by what `callback(item)` returns. A string `callback` groups by
that property of the items.

```js
groupBy(books, 'genre')
// { novel: [{ title: 'Orlando', … }, …], essay: [{ … }] }
groupBy(books, book => (book.price > 20 ? 'premium' : 'standard'))
```

### mapKeys()

```js
mapKeys(object, callback)
```

Returns a new object with the values of `object` under the keys returned by
`callback(key, value, object)`.

```js
mapKeys({ orlando: 12, waves: 15 }, key => key.toUpperCase())
// { ORLANDO: 12, WAVES: 15 }
```

### mapValues()

```js
mapValues(object, callback)
```

Returns a new object with the keys of `object` and the values returned by
`callback(value, key, object)`. A string `callback` picks that property of the
values.

```js
mapValues({ orlando: 12, waves: 15 }, price => price * 2)
// { orlando: 24, waves: 30 }
mapValues(booksById, 'title') // { 1: 'Orlando', 2: 'The Waves' }
```

### pick()

```js
pick(...args)
```

Returns the first argument that isn't `undefined`. Unlike `??`, `null` counts
as a value.

```js
pick(options.pageSize, defaults.pageSize, 20)
pick(undefined, null, 20) // null
```

### pickBy()

```js
pickBy(object, callback)
```

Returns a new object with the entries of `object` for which
`callback(value, key, object)` returns a truthy value. A string `callback`
checks that property of the values.

```js
pickBy({ title: 'Orlando', subtitle: '', year: 1928 }, value => !!value)
// { title: 'Orlando', year: 1928 }
pickBy(booksById, 'inStock')
```

### mergeDeeply()

```js
mergeDeeply(target, ...sources)
```

Merges the sources into `target` recursively and returns it:

- Plain objects are merged key by key.
- Arrays are merged index by index where both hold mergeable values (plain
  objects or arrays), and other values of the source are appended.
- Any other value of the source replaces the target's value, including `null`.
- A `null` or `undefined` source is skipped.

`target` itself is changed. Nested objects and arrays of the target are copied
before they're merged into, so they stay unchanged.

```js
mergeDeeply(
  { tags: ['novel'], meta: { pages: 312 } },
  { tags: ['classic'], meta: { year: 1928 } }
)
// { tags: ['novel', 'classic'], meta: { pages: 312, year: 1928 } }
```

### assignDeeply()

```js
assignDeeply(target, ...sources)
```

Like `mergeDeeply()`, but array values of the source replace the target's
values at the same index instead of being appended.

```js
assignDeeply({ sizes: [10, 12] }, { sizes: [14] }) // { sizes: [14, 12] }
```

## Strings

```js
import { labelize, camelize, deindent } from '@ditojs/utils'
```

The case conversions return `''` for an empty, `null` or `undefined` string,
and the checks return `false` for them.

### Case conversion

| Function | Description | Example |
| -------- | ----------- | ------- |
| `camelize(str, pascalCase = false)` | Converts words separated by spaces, hyphens or underscores to camel case, or to pascal case with `pascalCase`. | `camelize('page-count')` → `'pageCount'`, `camelize('page count', true)` → `'PageCount'` |
| `decamelize(str, sep = ' ')` | Splits camel case into lower-case words, separated by `sep`. Also replaces whitespace between words with `sep`. | `decamelize('pageCount')` → `'page count'` |
| `hyphenate(str)` | `decamelize(str, '-')` | `hyphenate('pageCount')` → `'page-count'` |
| `underscore(str)` | `decamelize(str, '_')` | `underscore('pageCount')` → `'page_count'` |
| `capitalize(str)` | Upper-cases the first letter of every word. | `capitalize('the waves')` → `'The Waves'` |
| `labelize(str)` | Turns camel-cased, hyphenated and underscored names into title-cased labels. This is how dito derives labels from names. | `labelize('publishedAt')` → `'Published At'`, `labelize('isbn13')` → `'Isbn 13'` |

### deindent()

```js
deindent`…`
deindent(string)
```

A template tag that removes the common indentation of all lines, and the
first line break if the string starts with one. Interpolated values that span
several lines are indented to the position where they're inserted. A `\` at
the end of a line joins it with the next one.

```js
const text = deindent`
  Dear ${customer.name},
    your order has shipped.
`
// 'Dear Ada,\n  your order has shipped.\n'
```

### escapeRegExp()

```js
escapeRegExp(string)
```

Escapes the characters that have a meaning in regular expressions, so that
`string` can be matched literally.

```js
new RegExp(`^${escapeRegExp('1.5 (paperback)')}$`)
```

### getCommonPrefix()

```js
getCommonPrefix(...strings)
```

Returns the longest prefix that all `strings` share, `''` without strings.

```js
getCommonPrefix('/books/1/title', '/books/2/title') // '/books/'
```

### getCommonOffset()

```js
getCommonOffset(...strings)
```

Returns the length of the longest common prefix of `strings`, `0` without
strings.

### Checks

| Function | Returns `true` for |
| -------- | ------------------ |
| `isAbsoluteUrl(str)` | Strings starting with a scheme followed by `:`, e.g. `https:` or `mailto:`, or with `//` (protocol-relative). |
| `isUrl(str)` | URLs with or without scheme, e.g. `'bookshop.example'` and `'https://bookshop.example/books?page=2'`. Schemes: `http`, `https`, `ftp`, `ftps`, `mailto`, `rtsp`, `mms`. |
| `isDomain(str)` | Domain names, including internationalized ones, e.g. `'bücher.example'`. Not URLs, hosts with ports or paths. |
| `isHostname(str)` | Host names as in RFC 1123, e.g. `'localhost'` or `'shop.example.com'`. |
| `isEmail(str)` | Email addresses with a domain that has a top-level domain of two letters or more. |
| `isCreditCard(str)` | Numbers of the common credit card schemes that pass the Luhn check. Spaces and hyphens are ignored. |

Note that `isUrl()` accepts URLs without scheme, which `isAbsoluteUrl()`
rejects.

## Dates and numbers

```js
import { format, formatDate, formatPlainDate } from '@ditojs/utils'
```

Formatting with the `Intl` API, and conversion of plain dates.

### format()

```js
format(value, { locale = 'en-US', number, date, time, defaults } = {})
```

Formats a number or a date as a string in `locale`.

- Without `number`, `date` and `time`, numbers and dates are formatted with
  the defaults (see [`defaultFormats`](#defaultformats)).
- With `number`, `value` is parsed as a number if it isn't one.
- With `date` or `time`, `value` is converted to a `Date` if it isn't one, and
  only the parts given are formatted: `{ date: true }` formats the date
  without the time.
- Each of `number`, `date` and `time` is `true` for the defaults, `false` to
  leave the part out, or an object of `Intl` options merged over the
  defaults. A `false` option removes a default, e.g. `{ second: false }`.
- An object can have a `format(value, type, options)` callback, called for
  each part of `Intl`'s `formatToParts()`. A returned string replaces the
  part's value.
- `defaults` replaces [`defaultFormats`](#defaultformats).

Other values are returned through `toLocaleString()`, `null` and `undefined`
as they are.

```js
format(1234.5) // '1,234.5'
format(1234.5, { number: { style: 'currency', currency: 'EUR' } })
// '€1,234.50'
format('12.5', { number: { minimumFractionDigits: 2 } }) // '12.50'

const date = new Date(2026, 9, 13, 14, 5)
format(date) // 'October 13, 2026 at 02:05:00 PM'
format(date, { date: true }) // 'October 13, 2026'
format(date, { date: { month: 'short' } }) // 'Oct 13, 2026'
format(date, { time: { second: false } }) // '02:05 PM'
format(date, { locale: 'de-DE' }) // '13. Oktober 2026 um 14:05:00'

// Swiss thousands separator:
format(1234.5, {
  number: { format: (value, type) => (type === 'group' ? "'" : undefined) }
}) // "1'234.5"
```

The option types are `NumberFormat` (`Intl.NumberFormatOptions` with
`format`), `DateFormat` (`day`, `month`, `year`, `format`) and `TimeFormat`
(`hour`, `minute`, `second`, `format`).

### formatDate()

```js
formatDate(value, { locale = 'en-US', date = true, time = true } = {})
```

Formats `value` as a date with time, converting it with `new Date(value)` if
it isn't a `Date`. `date` and `time` work as in `format()`.

```js
formatDate(order.createdAt) // 'October 13, 2026 at 02:05:00 PM'
formatDate(order.createdAt, { time: false }) // 'October 13, 2026'
```

### defaultFormats

The default options of `format()`:

```js
{
  number: { style: 'decimal' },
  date: { day: 'numeric', month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
}
```

### formatPlainDate()

```js
formatPlainDate(date)
```

Returns the local date of `date` as `'YYYY-MM-DD'`, without time and time
zone. Unlike `date.toISOString().slice(0, 10)`, it can't shift to another day.

```js
formatPlainDate(new Date(2026, 4, 14, 23, 30)) // '2026-05-14'
```

### parsePlainDate()

```js
parsePlainDate(string)
```

Parses a `'YYYY-MM-DD'` string as local midnight, where `new Date(string)`
would parse it as UTC midnight. Returns `null` for anything else, including
dates that don't exist, e.g. `'2026-02-30'`.

```js
parsePlainDate('2026-05-14') // May 14, 2026, 00:00 local time
parsePlainDate('2026-02-30') // null
```

## Data paths

```js
import { getValueAtDataPath, resolveDataPath } from '@ditojs/utils'
```

A data path addresses a value inside nested objects and arrays, e.g. the
title of the second item of an order:

```js
const order = {
  customer: { name: 'Ada' },
  items: [
    { book: { title: 'Orlando' }, quantity: 1 },
    { book: { title: 'The Waves' }, quantity: 2 }
  ]
}

getValueAtDataPath(order, 'items/1/book/title') // 'The Waves'
```

### Formats

All functions accept these forms, also mixed, except that `resolveDataPath()`
takes strings only:

| Form | Example |
| ---- | ------- |
| Slash-separated | `'items/1/book/title'` |
| JSON pointer | `'/items/1/book/title'` |
| Property access | `'items[1].book.title'`, `"items[1]['book'].title"` |
| Array of keys | `['items', '1', 'book', 'title']` |

A leading `/` makes no difference to the functions that read and write values,
which always start at the object they receive. Only `resolveDataPath()` treats
it as the root, as opposed to a relative path. Keys that contain `/`, `.` or
`[` can only be given in arrays.

`.` and `..` refer to the current and the parent level. `normalizeDataPath()`
and `resolveDataPath()` resolve them; the functions that read and write values
don't.

#### Wildcards

The read functions `getValueAtDataPath()` and `getEntriesAtDataPath()` support
wildcards, which work like in `.gitignore`:

- `*` matches every key of one level, of objects and arrays alike:
  `items/*/quantity`.
- `**` in the middle matches zero or more levels: `items/**/title` matches
  `items/title`, `items/0/title` and `items/0/book/title`.
- `**` at the end matches everything inside, at all levels, but not the value
  itself: `items/**` matches `items/0`, `items/0/book`, … but not `items`.

A value that `**` reaches in several ways is returned once.

### parseDataPath()

```js
parseDataPath(path)
```

Returns the keys of `path` as a new array of strings. `.` and `..` stay in it.

```js
parseDataPath('items[1].book.title') // ['items', '1', 'book', 'title']
parseDataPath('/items/0/../1') // ['items', '0', '..', '1']
```

### normalizeDataPath()

```js
normalizeDataPath(path)
```

Returns `path` as a slash-separated string without leading or trailing slash,
with `.` and `..` resolved. It throws if a `..` leads above the root. A `//`
inside the path starts again from the root, so that joined absolute paths
resolve to the last one.

```js
normalizeDataPath('items[1].book.title') // 'items/1/book/title'
normalizeDataPath('/items/0/../1/quantity') // 'items/1/quantity'
normalizeDataPath('../items')
// Error: Invalid data path: '../items' leads above the root.
```

### resolveDataPath()

```js
resolveDataPath(dataPath, path)
```

Resolves `path` relative to `dataPath`, or from the root if `path` starts with
`/`, and normalizes the result with `normalizeDataPath()`, which throws if it
leads above the root. Wildcards are kept.

```js
resolveDataPath('items/0', 'quantity') // 'items/0/quantity'
resolveDataPath('items/0', '../1/quantity') // 'items/1/quantity'
resolveDataPath('items/0', '/customer/name') // 'customer/name'
resolveDataPath('items/0', '../../..')
// Error: Invalid data path: 'items/0/../../..' leads above the root.
```

### getValueAtDataPath()

```js
getValueAtDataPath(obj, path, handleError?)
```

Returns the value at `path` inside `obj`.

If a key along the path doesn't exist, `handleError(obj, key, index)` is
called with the object where the lookup failed, the key and its index in the
path, and its return value is returned. Without `handleError`, it throws
`Invalid path: <path>`.

With wildcards, it returns an array of all matched values: for `*`, the values
of each child at the rest of the path, merged into one array if the rest has
wildcards too; for `**`, all matches depth-first, leaving out what doesn't
exist.

```js
getValueAtDataPath(order, 'items/0/quantity') // 1
getValueAtDataPath(order, 'items/*/book/title') // ['Orlando', 'The Waves']
getValueAtDataPath(order, '**/title') // ['Orlando', 'The Waves']
getValueAtDataPath(order, 'items/5/quantity', () => null) // null
```

### getEntriesAtDataPath()

```js
getEntriesAtDataPath(obj, path, handleError?)
```

Like `getValueAtDataPath()`, but returns an object of the matched values keyed
by their normalized data paths. Without wildcards, the object has one entry.
`handleError` works the same; when it returns `undefined`, the entry is left
out.

```js
getEntriesAtDataPath(order, 'items/*/quantity')
// { 'items/0/quantity': 1, 'items/1/quantity': 2 }
getEntriesAtDataPath(order, 'items/**/title')
// { 'items/0/book/title': 'Orlando', 'items/1/book/title': 'The Waves' }
```

### setValueAtDataPath()

```js
setValueAtDataPath(obj, path, value)
```

Sets `value` at `path` inside `obj` and returns `obj`. The parent of the last
key must exist and be an object or array, otherwise it throws. Missing levels
aren't created, and wildcards aren't supported.

```js
setValueAtDataPath(order, 'items/0/quantity', 3)
```

### setEntriesAtDataPath()

```js
setEntriesAtDataPath(obj, entries)
```

Sets each value of `entries` at its data path key with `setValueAtDataPath()`,
and returns `obj`. It takes what `getEntriesAtDataPath()` returns.

```js
const quantities = getEntriesAtDataPath(order, 'items/*/quantity')
// … change the values, then write them back:
setEntriesAtDataPath(order, quantities)
```

## HTML

```js
import { html, isHtml, asHtml, escapeHtml, stripHtml } from '@ditojs/utils'
```

### html

```js
html`<b>${value}</b>`
```

A tagged template that creates HTML, an `Html` value that dito's admin renders
as HTML, where it renders strings as text, see
[Text and HTML](./admin/schemas.md#text-and-html). Interpolated values are
escaped with `escapeHtml()`, except `Html` values, so templates nest. Arrays
are joined, escaping each item unless it's `Html`, and `null`, `undefined` and
`false` render as empty. `value` and `toString()` return the HTML string.

```js
const title = html`<b>${'Tom & Jerry'}</b>`
html`<p>${title} by ${['Hanna', html`<br>`, 'Barbera']}</p>`.value
// '<p><b>Tom &amp; Jerry</b> by Hanna<br>Barbera</p>'
```

Trusted HTML from elsewhere, e.g. the value of a `markup` field, passes as an
array of strings, like the strings of a template, and isn't escaped:
`html([item.description])`.

Escaping makes values safe as text and as attribute values in quotes, but not
as URLs: `` html`<a href="${url}">` `` still runs a `javascript:` URL when the
link is clicked, so check the scheme of URLs that users enter.

### isHtml()

```js
isHtml(value)
```

Returns `true` if the value was created by `html`. The check uses the brand
`Symbol.for('dito.html')`, so it recognizes `Html` values of other copies of
`@ditojs/utils` too.

### asHtml()

```js
asHtml(value)
```

Returns the HTML of an `Html` value, and escapes any other value as text with
`escapeHtml()`, so that content that can be either is inserted as HTML.

```js
asHtml(html`<b>${'Tom & Jerry'}</b>`) // '<b>Tom &amp; Jerry</b>'
asHtml('<b>Tom & Jerry</b>') // '&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;'
```

### escapeHtml()

```js
escapeHtml(html)
```

Escapes `"`, `'`, `&`, `<` and `>` as HTML entities, so that a string can be
inserted into HTML as text or as an attribute value in quotes. Returns
`''` for `null` and `undefined`, and converts other values with `toString()`.

```js
escapeHtml('<b>Tom & "Jerry"</b>')
// '&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;'
```

### stripHtml()

```js
stripHtml(html)
```

Returns the text of an HTML string: `<br>` and `</p>` become line breaks, all
other tags are removed, and the result is trimmed. Entities aren't decoded.
Returns `''` for `null` and `undefined`.

```js
stripHtml('<p>A <b>modernist</b> novel.</p><p>First published 1928.</p>')
// 'A modernist novel.\nFirst published 1928.'
```

`stripHtml()` is meant for display, e.g. of rich text in lists, not for
sanitizing untrusted input.

## Functions

```js
import { deprecate, toAsync, toCallback } from '@ditojs/utils'
```

### deprecate()

```js
deprecate(message)
```

Logs `message` with `console.warn()`, once per distinct message.

```js
deprecate('`Book.findByIsbn()` is deprecated, use `Book.query().findOne()`.')
```

### toAsync()

```js
toAsync(callbackFunction)
```

Converts a function that takes an error-first callback `(err, result)` as its
last argument into one that returns a promise, like Node's
`util.promisify()`.

```js
import { readFile } from 'node:fs'

const readFileAsync = toAsync(readFile)
const text = await readFileAsync('catalog.txt', 'utf8')
```

### toCallback()

```js
toCallback(asyncFunction)
```

The opposite of `toAsync()`: converts a function that returns a promise into
one that takes an error-first callback as its last argument.

```js
const findBook = toCallback(id => Book.query().findById(id))
findBook(1, (err, book) => { /* … */ })
```

### toPromiseCallback()

```js
toPromiseCallback(resolve, reject)
```

Returns an error-first callback `(err, res)` that calls `reject(err)` if `err`
is truthy, and `resolve(res)` otherwise.

```js
const text = await new Promise((resolve, reject) =>
  readFile('catalog.txt', 'utf8', toPromiseCallback(resolve, reject))
)
```

## Timers

```js
import { debounce, debounceAsync } from '@ditojs/utils'
```

### debounce()

```js
debounce(func, delay)
debounce(func, { delay, immediate = false })
```

Returns a function that calls `func` once calls to it have paused for `delay`
milliseconds, with the arguments and `this` of the last call. With
`immediate`, `func` is called right away on the first call, and not again
until calls have paused for `delay`.

The returned function returns the result of the last call of `func`, so
without `immediate`, the result of an earlier call.

`debounced.cancel()` cancels a pending call, and returns whether there was
one.

```js
const updatePreview = debounce(text => {
  preview.textContent = text
}, 300)
textarea.addEventListener('input', () => updatePreview(textarea.value))
```

### debounceAsync()

```js
debounceAsync(func, delay)
debounceAsync(func, { delay, immediate = false })
```

Like `debounce()`, for functions that return promises: each call returns a
promise that resolves to the result of the call of `func` that ends the
pause. If that call fails, the promise of the last call is rejected, and the
others resolve to `undefined`. With `immediate`, calls within `delay` of the
leading call resolve to its result.

`debounced.cancel()` cancels a pending call, resolves the promises waiting for
it to `undefined`, and returns whether there was one. Later calls work as
before.

```js
const searchBooks = debounceAsync(async query => {
  const response = await fetch(`/api/books?search=${query}`)
  return response.json()
}, 300)
const [first, second] = await Promise.all([
  searchBooks('orl'),
  searchBooks('orlando')
])
// Both resolve to the results for 'orlando'.
```

## Promises

```js
import { mapConcurrently, mapSequentially } from '@ditojs/utils'
```

Both functions take an array, or a promise that resolves to one, and resolve
to an array of the results in the order of the input.

### mapConcurrently()

```js
mapConcurrently(input, callback, { concurrency = 0 } = {})
```

Calls `callback(value, index, array)` for each element and waits for all
results. With `concurrency`, at most that many calls run at the same time;
with `0`, all run at once, like `Promise.all(array.map(callback))`. Rejects
with the first error.

```js
const covers = await mapConcurrently(
  books,
  book => fetchCover(book),
  { concurrency: 4 }
)
```

### mapSequentially()

```js
mapSequentially(input, callback)
```

Calls `callback(value, index)` for each element, one after the other, each
waiting for the previous one to resolve. Rejects with the first error, and
doesn't call `callback` for the remaining elements.

```js
const receipts = await mapSequentially(orders, order => sendReceipt(order))
```

## Classes

```js
import { mixin } from '@ditojs/utils'
```

### mixin()

```js
mixin(mixinFunction)
```

Turns `mixinFunction`, a function that takes a base class and returns a class
that extends it, into a mixin. Calling the mixin with a class returns the
extended class, unless the class already has the mixin somewhere in its
inheritance chain, in which case the class is returned as it is. This way a
mixin is applied only once, also when several mixins include it.

```js
import { Model } from '@ditojs/server'
import { mixin } from '@ditojs/utils'

const Priced = mixin(
  Base =>
    class extends Base {
      get priceWithTax() {
        return this.price * (1 + this.taxRate)
      }
    }
)

class Book extends Priced(Model) {}
class Ebook extends Priced(Book) {} // Priced(Book) returns Book
```

The model mixins of `@ditojs/server`, e.g. `TimestampedMixin`, are made with
`mixin()`.
