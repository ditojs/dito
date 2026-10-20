# Validation

Dito.js validates data with [Ajv](https://ajv.js.org/), against JSON schemas
that it builds from your definitions. One validator, `app.validator`, is
shared by all models and controllers, so that schemas can reference each other
by model name.

## What is validated

- **Models**, when data is inserted, updated or patched, and when a model is
  created from data with `Model.fromJson()`. The schema comes from the
  [properties](models.md#properties). Patches only validate the given
  properties: `required` and defaults don't apply to them.
- **Action parameters and responses** of controllers, against their
  `parameters` and `response` schemas, see
  [Controllers](controllers.md#parameters).
- **Filter parameters**, see [Queries](queries.md#parameters).

Data that fails validation throws a `ValidationError`, which the server sends
to the client with status 400:

```json
{
  "message": "The provided data for the Order model is not valid",
  "type": "ModelValidation",
  "errors": {
    "number": [
      {
        "message": "is required",
        "keyword": "format",
        "params": { "format": "required" }
      }
    ],
    "lines/2/quantity": [
      {
        "message": "must be 1 or more",
        "keyword": "minimum",
        "params": { "comparison": ">=", "limit": 1 }
      }
    ]
  }
}
```

`errors` holds the errors by the data path of the value. The admin shows them
next to the fields of these paths. [Errors](errors.md#validation-errors)
shows how to throw such errors yourself.

## Schemas

Schemas are [JSON schemas](https://json-schema.org/understanding-json-schema/)
with some additions, described in [Models: properties](models.md#properties):
`required: true` rejects `null` and `''` too, formats like `email` accept
`''`, as emptiness is checked by `required` only, while formats that describe
dates and times still reject `''`, `nullable: true` accepts
`null`, `type` can name a model or a registered [type](#types-formats-and-keywords),
and objects with `properties` reject properties that aren't listed. Shared
pieces of schemas are described in
[Reusable schemas](models.md#reusable-schemas).

## Variants

Data that comes in several shapes is described with a `oneOf` of variants and
a `discriminator`, whose tag property selects the variant. A book's `edition`
is either a print edition with `pages` or an audio edition with `minutes`, and
both share the properties of a base:

```js
const narration = {
  properties: {
    narrator: { type: 'string', required: true }
  }
}

export class Book extends Model {
  static properties = {
    edition: {
      $ref: '#EditionBase',
      nullable: true,
      discriminator: { propertyName: 'format' },
      oneOf: [
        {
          properties: {
            format: { const: 'print' },
            pages: { type: 'integer', minimum: 1 }
          }
        },
        {
          properties: {
            format: { const: 'audio' },
            minutes: { type: 'integer', minimum: 1 }
          },
          allOf: [narration]
        }
      ],
      definitions: {
        '#EditionBase': {
          type: 'object',
          properties: {
            format: { type: 'string', required: true },
            publisher: { type: 'string' }
          }
        }
      }
    }
  }
}
```

- The base marks the tag as `format: { type: 'string', required: true }`, and
  the outer schema extends it with `$ref`, next to `discriminator` and `oneOf`.
- Each variant fixes the tag with `const` or `enum` directly in its own
  `properties`. A variant can add shared pieces through `allOf`, like
  `narration` here.
- The outer schema rejects unknown properties, and properties of the other
  variants: `{ format: 'print', minutes: 300 }` fails.
- A missing tag, or one that no variant has, fails, also in patches.

Variants written as `allOf: [{ $ref: '#EditionBase' }, { properties: … }]`
don't work with a `discriminator`: Ajv needs the tag in the `properties` of
each variant, and throws `discriminator: oneOf subschemas (or referenced
schemas) must have "properties/format"` when it validates. Without a
`discriminator`, such variants validate, but Ajv tries each of them.
[Schema extensions](../../api/server/validator.md#schema-extensions) lists
how Dito.js closes these schemas.

## Custom validation

`validate` is a function that validates a value in code. It receives the value
as `data`, along with its parent as `parentData` and the root data:

```js
static properties = {
  stock: {
    type: 'integer',
    validate({ data, parentData }) {
      if (parentData.isAvailable && data === 0) {
        throw new Error('needs to be above 0 for available books')
      }
    }
  }
}
```

Returning `false` fails validation. Throwing fails it with the error's message.
Returning nothing or `true` passes.

The [`Validator` API](../../api/server/validator.md#validate) lists all
arguments, among them `app`, the application.

### Validating a whole model

`static schema` is merged into the model's JSON schema. A `validate` function
there receives the whole model's data, to check properties against each
other:

```js
export class Book extends Model {
  static schema = {
    validate({ data }) {
      if (data.isAvailable && !data.publishedAt) {
        throw new Error('An available book needs a publication date')
      }
    }
  }
}
```

### Asynchronous validation

`validate` functions may be async, e.g. to query the database:

```js
static properties = {
  email: {
    type: 'string',
    format: 'email',
    async validate({ data, app }) {
      const Customer = app.getModel('Customer')
      return !(await Customer.findOne({ email: data }))
    }
  }
}
```

Async functions only run in asynchronous validation, and are skipped
otherwise. Asynchronous validation is used for the parameters and responses of
controller actions, by `Model.fromJson(json, { async: true })` and by
`model.$validateGraph()`. Inserts, updates and patches validate synchronously,
without them. To check such properties when saving, validate first:

```js
const customer = await Customer.fromJson(data, { async: true })
await Customer.query().insert(customer)
```

## Types, formats and keywords

Applications can register their own schema types, formats and keywords. Pass
them to a `Validator` and give it to the application:

```js
import { Application, Validator } from '@ditojs/server'

const validator = new Validator({
  types: {
    // `type: 'price'`:
    price: { type: 'number', minimum: 0, multipleOf: 0.01 }
  },

  formats: {
    // `format: 'isbn'`:
    isbn: {
      validate: value => /^97[89]\d{10}$/.test(value),
      message: 'needs to be an ISBN-13'
    }
  },

  keywords: {
    // `maxWords: 300`:
    maxWords: {
      type: 'string',
      metaSchema: { type: 'integer' },
      validate: (max, value) => value.split(/\s+/).length <= max,
      message: 'has too many words'
    }
  }
})

const app = new Application({ config, models, controllers, validator })
```

```js
static properties = {
  price: { type: 'price', required: true },
  isbn: { type: 'string', format: 'isbn' },
  summary: { type: 'text', maxWords: 300 }
}
```

- A **type** is a schema registered under a name. Properties use it as their
  `type`.
- A **format** is an
  [Ajv format definition](https://ajv.js.org/guide/formats.html): an object
  whose `validate` is a function or a regular expression.
- A **keyword** is an [Ajv keyword definition](https://ajv.js.org/keywords.html)
  without its `keyword` name, which is the key.

Formats and keywords take a `message` that replaces Ajv's error message.

Keep them in modules of their own and import them as namespaces:

```js
import * as keywords from './schema/keywords.js'
import * as formats from './schema/formats.js'
import * as types from './schema/types.js'

const validator = new Validator({ keywords, formats, types })
```

The [`Validator` API](../../api/server/validator.md) lists the built-in
keywords, formats and types, and the Ajv options.

## Validating in code

Models validate themselves when they are saved. To validate data without
saving it, create a model from it, or call `$validate()`:

```js
const book = Book.fromJson(data) // Throws a ValidationError
book.$validate()                 // Validates the instance again
```

Other data can be validated with a schema compiled by the application's
validator. `convertSchema()` turns a Dito.js schema into a JSON schema first:

```js
import { convertSchema } from '@ditojs/server'

const validate = app.compileValidator(
  convertSchema({
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email', required: true }
    }
  }),
  { throw: false }
)

if (!validate(data)) {
  console.log(validate.errors)
}
```
