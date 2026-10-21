# `class` Validator

```js
import { Validator } from '@ditojs/server'
```

The `Validator` validates models, action parameters and responses with
[Ajv](https://ajv.js.org/) (JSON Schema draft 2020-12, plus the formats of
`ajv-formats`), extended by Dito.js keywords, formats and types. One instance is
shared by the application, as `app.validator`; model schemas are added to it so
that they can reference each other by model name. See
[Validation](../../guide/server/validation.md) for how to use it.

## Constructor

```js
const validator = new Validator({ options, keywords, formats, types })
```

Creates a validator with custom Ajv options, keywords, formats and types,
merged over the built-in ones. Pass it to the
[`Application`](application.md#constructor) as `validator`; without one, the
application creates a `new Validator()`. All options are optional.

#### Parameters

| Name       | Type                      | Description                                                                         |
| ---------- | ------------------------- | ----------------------------------------------------------------------------------- |
| `options`  | `object`                  | Ajv options for all Ajv instances, merged over the defaults below.                  |
| `keywords` | `Record<string, Keyword>` | Custom [keywords](#keyword), merged over the [built-in ones](#built-in-keywords).   |
| `formats`  | `Record<string, Format>`  | Custom [formats](#format), merged over the [built-in ones](#built-in-formats).      |
| `types`    | `Record<string, Schema>`  | Custom [types](#types), merged over the [built-in ones](#built-in-types).           |

Names may start with `_` to avoid clashes with reserved words
(`_instanceof`); Ajv receives them without it.

Default Ajv options: `strictSchema: true`, `strictNumbers: true`,
`strictTuples: true`, `strictTypes: false`, `strictRequired: false`,
`allErrors: true`, `discriminator: true`, `ownProperties: true`,
`passContext: true`, `useDefaults: true`, `validateSchema: true`. With
`strictSchema`, unknown keywords throw when a schema is compiled, for model
schemas when the app sets up its models; pass
`options: { strictSchema: false }` to ignore them.

#### Example

```js
import { Application, Validator } from '@ditojs/server'

const app = new Application({
  validator: new Validator({
    keywords: { isbn: isbnKeyword },
    formats: {
      sku: { validate: /^[A-Z]{3}-\d{4}$/, message: 'needs to be a SKU' }
    },
    types: { price: { type: 'number', minimum: 0, multipleOf: 0.01 } }
  })
})
```

## Properties

| Name       | Type                      | Description                                                      |
| ---------- | ------------------------- | ---------------------------------------------------------------- |
| `app`      | `Application`             | The application that uses the validator, set by its constructor. |
| `options`  | `object`                  | The Ajv options, with the defaults merged in.                    |
| `keywords` | `Record<string, Keyword>` | All keywords, built-in and custom.                               |
| `formats`  | `Record<string, Format>`  | All formats, built-in and custom.                                |
| `types`    | `Record<string, Schema>`  | All types, built-in and custom.                                  |

## Validation options

`compile()` and model validation take these options. Each combination gets
its own cached Ajv instance; other options don't select one.

| Option                | Default | Description                                                                                                            |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `async`               | `false` | Asynchronous validation, needed for async `validate` functions and async keywords; those are removed in synchronous validation. |
| `patch`               | `false` | Ignores `required` and the `required` format, and applies no defaults.                                                 |
| `$data`               | `false` | Ajv option.                                                                                                            |
| `$comment`            | `false` | Ajv option.                                                                                                            |
| `coerceTypes`         | `false` | Ajv option. Action parameters use `'array'`.                                                                           |
| `discriminator`       | `true`  | Ajv option.                                                                                                            |
| `multipleOfPrecision` | `false` | Ajv option.                                                                                                            |
| `ownProperties`       | `true`  | Ajv option.                                                                                                            |
| `removeAdditional`    | `false` | Ajv option.                                                                                                            |
| `uniqueItems`         | `true`  | Ajv option.                                                                                                            |
| `useDefaults`         | `true`  | Ajv option.                                                                                                            |
| `verbose`             | `false` | Ajv option.                                                                                                            |

## Methods

### compile()

```js
const validate = validator.compile(schema, options?)
```

Compiles a JSON schema into a validation function. The function passes its
`this` to Ajv as the context of [`validate`](#validate) functions, which read
`app`, `validator` and `options` from it: models and action parameters do
this. When calling it directly on a schema with `validate` functions, pass
the context with `validate.call({ app, validator, options }, data)`.

#### Parameters

| Name            | Type      | Description                                                                                                              |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `schema`        | `Schema`  | A JSON schema, after [`convertSchema()`](#convertschema).                                                                |
| `options`       | `object`  | [Validation options](#validation-options), plus `throw`.                                                                 |
| `options.throw` | `boolean` | Default `true`: failures throw an `Ajv.ValidationError` with `errors`. With `false`, the function returns `false` and sets `validate.errors`. |

Returns `(data) => boolean`, or `(data) => Promise<boolean>` with `async`.

#### Example

```js
import { convertSchema } from '@ditojs/server'

const schema = convertSchema({
  type: 'object',
  properties: {
    title: { type: 'string', required: true }
  }
})
const validate = app.validator.compile(schema, { throw: false })
validate({ title: '' }) // false, validate.errors holds the errors
```

### addSchema()

```js
validator.addSchema(schema)
```

Adds a schema with an `$id` to all current and future Ajv instances, so
other schemas can reference it. The application adds every model's schema.

### getAjv()

```js
const ajv = validator.getAjv(options?)
```

Returns the cached Ajv instance for the [validation
options](#validation-options), creating it with [`createAjv()`](#createajv) if
needed. Returns `Ajv`.

### createAjv()

```js
const ajv = validator.createAjv(options)
```

Creates an Ajv instance with the keywords, formats, types and schemas added so
far. *Hook.* Returns `Ajv`.

### processSchema()

```js
const processed = validator.processSchema(schema, { patch, async })
```

Returns a copy of `schema` prepared for the options: without `required` for
`patch`, with `$async` for `async`, async `validate` functions moved to
`validateAsync`, and async keywords removed for synchronous validation. Returns
`Schema`.

### parseErrors()

```js
const errors = validator.parseErrors(ajvErrors, { dataPath }?)
```

Converts Ajv errors to an object of error arrays keyed by data path, e.g. `{
'chapters/0/title': [{ message, keyword, params }] }`, prefixed with
`options.dataPath`. Errors of the root object, such as unknown properties, use
the key `''`. Applies the `message` of keywords and formats, and to Ajv's
errors of standard keywords the messages of the [shared
definitions](#shared-definitions). Leaves out duplicates, `$` keywords, macro
keywords and `silent` definitions. Returns
`Record<string, { message, keyword, params }[]>`.

### prefixInstancePaths()

```js
const prefixed = validator.prefixInstancePaths(errors, '/items/0')
```

Returns copies of the Ajv errors with the prefix prepended to their
`instancePath`. Returns `ErrorObject[]`.

### getKeyword()

```js
const keyword = validator.getKeyword('range')
```

Returns a keyword definition by its Ajv name, so `'instanceof'` finds
`_instanceof`. Returns [`Keyword`](#keyword) `| undefined`.

### getFormat()

```js
const format = validator.getFormat('color')
```

Returns a format definition by its Ajv name. Returns [`Format`](#format) `|
undefined`.

## Internal members

`beforeValidate()` and `validate()` implement Objection's `Validator`
interface for model validation, and `schemas` and `ajvCache` hold the added
schemas and the Ajv instances.

## Keyword

An [Ajv keyword definition](https://ajv.js.org/keywords.html) without
`keyword` (the key is its name), plus:

| Property  | Type      | Description                                           |
| --------- | --------- | ----------------------------------------------------- |
| `message` | `string`  | Error message replacing Ajv's.                        |
| `silent`  | `boolean` | Leaves the keyword's errors out of `parseErrors()`.   |
| `async`   | `boolean` | Ajv async keyword; removed in synchronous validation. |

```js
const isbnKeyword = {
  type: 'string',
  metaSchema: { type: 'boolean' },
  validate: (isEnabled, value) => !isEnabled || /^97[89]\d{10}$/.test(value),
  message: 'needs to be an ISBN-13'
}
// properties: { isbn: { type: 'string', isbn: true } }
```

## Format

An [Ajv format definition](https://ajv.js.org/guide/formats.html):
`validate` is a function `value => boolean` or a regular expression, plus
`message` and `silent` as on keywords.

```js
const slug = {
  validate: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  message: 'needs to be a slug'
}
// properties: { slug: { type: 'string', format: 'slug' } }
```

## Types

Types are schemas registered under their name, so that properties can use the
name as `type`: `{ type: 'price' }` becomes a `$ref` to the type's schema.

## Built-in keywords

| Keyword         | Value                         | Description                                                                                                                       |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `validate`      | `function(params)`            | Custom validation, see [below](#validate).                                                                                        |
| `validateAsync` | `async function(params)`      | Asynchronous custom validation; async `validate` functions are moved here.                                                        |
| `instanceof`    | `string \| function \| array` | The value is an instance of one of the types: names of JS constructors (`'Date'`, `'Buffer'`, …), model names or constructors.    |
| `range`         | `[min, max]`                  | Shorthand for `minimum` and `maximum`.                                                                                            |
| `primary`       | `boolean`                     | Metadata: primary key column.                                                                                                     |
| `foreign`       | `boolean`                     | Metadata: foreign key column.                                                                                                     |
| `unique`        | `boolean \| string`           | Metadata: unique constraint; properties with the same string form a composite one.                                                |
| `index`         | `boolean`                     | Metadata: indexed column.                                                                                                         |
| `unsigned`      | `boolean`                     | Metadata: unsigned number column.                                                                                                 |
| `specificType`  | `string`                      | Metadata: database column type.                                                                                                   |
| `computed`      | `boolean`                     | Metadata: computed property, not stored.                                                                                          |
| `hidden`        | `boolean`                     | Metadata: left out of the JSON data.                                                                                              |
| `relate`        | `string`                      | Internal: validates relation references (`{ id }`) of the named model.                                                            |

Metadata keywords don't validate; models and migrations read them, see
[`Model`](model.md).

### validate

```js
properties: {
  stock: {
    type: 'integer',
    validate({ data, parentData }) {
      if (parentData.isAvailable && !(data > 0)) {
        throw new Error('needs to be positive for available books')
      }
    }
  }
}
```

The function receives one object:

| Property                    | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `data`                      | The value.                                                         |
| `parentData`                | The object or array holding the value.                             |
| `rootData`                  | The root data.                                                     |
| `instancePath`              | JSON pointer of the value, e.g. `/items/0/name`.                   |
| `parentKey` / `parentIndex` | The key in an object, or the index in an array, of the value.      |
| `app`                       | The application.                                                   |
| `validator`                 | The validator.                                                     |
| `options`                   | The validation options, e.g. `graph` in `$validateGraph()`.        |
| `ctx`                       | The validation context.                                            |

Returning `false` fails validation; returning nothing or `true` passes.
Throwing fails with the error's message, or with its `errors` if it holds Ajv
errors. Async functions run only in asynchronous validation (`async: true`),
e.g. of action parameters and responses and of `$validateGraph()`;
synchronous validation skips them.

## Built-in formats

| Format     | Validates                                                                    |
| ---------- | ---------------------------------------------------------------------------- |
| `color`    | Hex colors: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.                       |
| `required` | Neither `null`, `undefined` nor `''`. Used for `required: true` properties.  |
| `empty`    | A falsy value.                                                               |

Plus the formats of `ajv-formats` in full mode (`date-time`, `email`, `uri`,
`uuid`, …).

## Shared definitions

The built-in formats and the messages of standard keywords come from
[`@ditojs/schema`](../../../packages/schema/README.md), which defines them for
the server and the admin as plain `{ validate(value, setting), message }`
objects, without Ajv. `formats` holds `color`, `empty` and `required`,
`keywords` the standard keywords `type`, `enum`, `minimum`, `maximum`,
`multipleOf`, `minLength`, `maxLength`, `pattern`, `minItems` and `maxItems`,
and dito's `range` and `decimals`. `message` is a string or a function of the
setting:

```js
import { keywords } from '@ditojs/schema'

keywords.minLength.validate('ab', 3) // false
keywords.minLength.message(3) // 'must be at least 3 characters long'
```

The server registers the formats with Ajv, and [parseErrors()](#parseerrors)
uses the messages of the keywords. Keywords that are reserved words are
exported with a leading `_`, e.g. `_enum`.

## Built-in types

| Type    | Schema                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `color` | `{ type: 'string', format: 'color' }`: hex colors only, no color names. Colors in object formats (`rgb`, `hsl`, …) need `type: 'object'`.  |
| `asset` | An asset file object: `key`, `name`, `type`, `size` (required), `url`, `width`, `height`.                                                     |

## Schema extensions

Dito.js schemas are JSON schemas with additions that
[`convertSchema()`](#convertschema) translates:

| Addition                                       | Translation                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `required: true` on a property                 | The `required` format plus an entry in the parent's `required` array, added to the entries the parent lists itself. A JSON Schema `required` array doesn't make the property itself required. |
| `type: 'text'`                                 | `type: 'string'`.                                                                                               |
| `type: 'date' \| 'datetime' \| 'timestamp'`    | `type: ['string', 'object']` with the `date-time` format; accepts `Date` objects.                               |
| `type: '<Model>'` or a type name               | `$ref` to the model or [type](#types).                                                                          |
| `nullable: true`                               | Also accepts `null`, also with `$ref` and `enum`.                                                               |
| `default: 'now()'`                             | Removed for validation; a database default.                                                                     |
| `properties`, `additionalProperties` or `patternProperties` | `unevaluatedProperties: false`: objects reject unknown properties, unless the schema sets `unevaluatedProperties: true`. |
| `type: 'object'` with `allOf`, `anyOf` or `oneOf` | `unevaluatedProperties: false` at this outer level, where it sees the properties of all parts. Parts without a `type` aren't closed on their own. |
| `definitions` with names starting with `#`     | Collected at the root schema; reference them as `{ $ref: '#Price' }`. Definitions don't close themselves, so they can serve as bases. Object definitions without properties, e.g. `{ type: 'object' }`, get `unevaluatedProperties: true` and stay open wherever they're used. |
| `$ref` to a definition                         | `unevaluatedProperties: false`: closed where it's used, unless the schema sets `unevaluatedProperties` itself or is a direct part of `allOf`, `anyOf` or `oneOf`. Non-object values aren't affected. |
| `discriminator`                                | `unevaluatedProperties: false`, with `discriminator` and `oneOf` moved into an `allOf` part, as Ajv applies the discriminator after `unevaluatedProperties`. The tag is required, also in patches. Without a `type`, the schema gets `type: 'object'`. See [Validation](../../guide/server/validation.md#variants). |

## Functions

### convertSchema()

```js
import { convertSchema } from '@ditojs/server'

const jsonSchema = convertSchema(schema, options?)
```

Converts a Dito.js schema into a JSON schema, see [Schema
extensions](#schema-extensions). With `options.useInstanceOf`, model types
become `instanceof` checks instead of `$ref`s. Returns `object`: the JSON
schema.

## Exports

`keywords`, `formats` and `types` export the built-in definitions. The
`instanceof` keyword is exported as `_instanceof`.

```js
import { formats } from '@ditojs/server'

formats.color.validate('#ff8800') // true
```
