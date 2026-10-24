# Errors

```js
import { ResponseError, NotFoundError } from '@ditojs/server'
```

All errors that Dito.js sends as responses extend `ResponseError`. The error
middleware responds with the error's `status` and, when the client accepts
JSON, with `error.toJSON()` as body. A model validation error, e.g. for an
empty `title`:

```json
{
  "message": "The provided data for the Book model is not valid",
  "type": "ModelValidation",
  "errors": {
    "title": [
      {
        "message": "is required",
        "keyword": "format",
        "params": { "format": "required" }
      }
    ]
  }
}
```

Controller actions wrap other errors they throw in a `ResponseError`, which
keeps their `message`, `status` (default 500) and `code`. Errors from elsewhere
respond with their `status` or 500 and `{ message }`. Either way, the message of
a plain `Error` reaches the client: throw a `ResponseError` for messages meant
for clients, and keep internals out of plain errors. All errors are emitted as
`'error'` events on the application. See [Errors](../../guide/server/errors.md)
for how to throw and handle them.

| Class                                         | Status        | Default message                |
| --------------------------------------------- | ------------- | ------------------------------ |
| [`ResponseError`](#responseerror)             | 500           | `'Response error'`             |
| [`AssetError`](#asseterror)                   | 400           | `'Asset error'`                |
| [`AuthenticationError`](#authenticationerror) | 401           | `'Authentication error'`       |
| [`AuthorizationError`](#authorizationerror)   | 401           | `'Unauthorized Access'`        |
| [`ControllerError`](#controllererror)         | 400           | `'Controller <name>: <error>'` |
| [`DatabaseError`](#databaseerror)             | 400, 409, 500 | The wrapped error's message    |
| [`GraphError`](#grapherror)                   | 400           | `'Graph error'`                |
| [`ModelError`](#modelerror)                   | 400           | `"Model '<name>': <error>"`    |
| [`NotFoundError`](#notfounderror)             | 404           | `'Not-found error'`            |
| [`NotImplementedError`](#notimplementederror) | 501           | `'Method not implemented'`     |
| [`QueryBuilderError`](#querybuildererror)     | 400           | `'Query-builder error'`        |
| [`RelationError`](#relationerror)             | 400           | `'Relation error'`             |
| [`ValidationError`](#validationerror)         | 400           | `'Validation error'`           |

## ResponseError

```js
new ResponseError(error?, defaults?, overrides?)
```

The base class of all errors sent as responses.

#### Parameters

| Name        | Type                        | Description                                                                                                                 |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `error`     | `string \| object \| Error` | A message, an object with `message`, `status`, `cause` and further data, or an error to wrap.                               |
| `defaults`  | `{ message?, status?, … }`  | Values that `error` doesn't provide. Default: `{ message: 'Response error', status: 500 }`, replaced as a whole when given. |
| `overrides` | `object`                    | Values that replace those of `error`, e.g. `message` or `stack`.                                                            |

`error`, `defaults` and `overrides` are merged in this order:

- A string becomes `message`.
- A wrapped `Error` contributes its `message`, its `toJSON()` data, and its
  `status` and `code` when set; it becomes the `cause`.
- `message`, `status`, `expose`, `stack` and `cause` are taken out; all other
  properties become `data`.

#### Properties

| Name      | Type                   | Description                                                                                                            |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `message` | `string`               | The message.                                                                                                           |
| `status`  | `number`               | The HTTP status.                                                                                                       |
| `expose`  | `boolean \| undefined` | `false` keeps the message and data out of the response, see [Plain errors](../../guide/server/errors.md#plain-errors). |
| `data`    | `object \| undefined`  | Additional data sent with the response, e.g. `code` or `errors`.                                                       |
| `cause`   | `unknown`              | The wrapped error.                                                                                                     |

### toJSON()

```js
const body = error.toJSON()
```

Returns `object`: `{ message, ...data }`, the response body.

#### Example

```js
throw new ResponseError('The book is checked out', { status: 409 })

throw new ResponseError({
  message: 'The book is checked out',
  status: 409,
  code: 'checked_out',
  bookId: book.id
})
// Responds 409 with { message, code: 'checked_out', bookId }
```

Application errors can extend it with their own defaults:

```js
class ConflictError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Conflict', status: 409 })
  }
}
```

The subclasses below take one argument, `error`, as `ResponseError` does,
unless noted otherwise. A `status` in `error` replaces the default status.

## AssetError

```js
new AssetError(error?)
```

400. Invalid asset files, e.g. unsigned files from sources not in
     `allowedImports`, see [`convertAssetFile()`](storage.md#convertassetfile).

## AuthenticationError

```js
new AuthenticationError(error?)
```

401. Failed authentication, e.g. invalid login credentials.

## AuthorizationError

```js
new AuthorizationError(error?)
```

401. A denied [`authorize`](controllers.md#authorize) setting.

## ControllerError

```js
new ControllerError(controller, error)
```

400. Errors in the configuration of a controller. The message is prefixed
     with the class name.

#### Parameters

| Name         | Type                              | Description                  |
| ------------ | --------------------------------- | ---------------------------- |
| `controller` | `Controller \| Class<Controller>` | The controller or its class. |
| `error`      | `string`                          | The message.                 |

#### Example

```js
new ControllerError(BooksController, 'Missing handler')
// 'Controller BooksController: Missing handler'
```

## DatabaseError

```js
new DatabaseError(error, overrides?)
```

Wraps Objection database errors, with their message. `data.type` is the
class name of the wrapped error, `cause` its native driver error. Errors with
status 500 or higher set `expose: false`: their message is only logged.

| Wrapped error                                                                         | Status |
| ------------------------------------------------------------------------------------- | ------ |
| `CheckViolationError`, `NotNullViolationError`, `DataError`                           | 400    |
| `ConstraintViolationError` (incl. `UniqueViolationError`, `ForeignKeyViolationError`) | 409    |
| other `DBError`                                                                       | 500    |
| any other error                                                                       | 400    |

#### Parameters

| Name        | Type      | Description                 |
| ----------- | --------- | --------------------------- |
| `error`     | `DBError` | The Objection error.        |
| `overrides` | `object`  | E.g. `{ message, status }`. |

Models convert database errors of their queries with
[`app.createDatabaseError()`](application.md#createdatabaseerror), which
removes the SQL from the message and keeps it as `data.sql` when
`config.log.errors.sql` is set.

## GraphError

```js
new GraphError(error?)
```

400. Invalid graphs, e.g. Objection's `InvalidGraph` errors or unsupported
     graph control properties in the data.

## ModelError

```js
new ModelError(model, error)
```

400. Errors in the definition of a model. The message is prefixed with the
     model's class name.

#### Parameters

| Name    | Type                    | Description             |
| ------- | ----------------------- | ----------------------- |
| `model` | `Model \| Class<Model>` | The model or its class. |
| `error` | `string`                | The message.            |

#### Example

```js
new ModelError(Book, 'Invalid shelf') // "Model 'Book': Invalid shelf"
```

## NotFoundError

```js
new NotFoundError(error?)
```

404. Missing models or routes, e.g. from `throwIfNotFound()`.

## NotImplementedError

```js
new NotImplementedError(error?)
```

501. Functionality that isn't implemented.

## QueryBuilderError

```js
new QueryBuilderError(error?)
```

400. Invalid queries, e.g. invalid `range`, `order` or `filter` query
     parameters, or scopes, filters and parameters that aren't allowed.

## RelationError

```js
new RelationError(error?)
```

400. Invalid relation definitions and relation expressions. Mentions of
     `relationMappings` in wrapped Objection errors are replaced with `relations`.

## ValidationError

```js
new ValidationError(error?)
```

400. Failed validation of models, parameters, filters, responses or request
     bodies. Mostly created by
     [`app.createValidationError()`](application.md#createvalidationerror), with
     `data`:

| Property | Description                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| `type`   | `'ModelValidation'`, `'ParameterValidation'`, `'FilterValidation'`, `'ResultValidation'` or `'BodyValidation'`. |
| `errors` | Errors by data path (not for `'BodyValidation'`), see [`parseErrors()`](validator.md#parseerrors).              |
| `json`   | The validated data, when `config.log.errors.json` is set.                                                       |

#### Example

```js
throw new ValidationError({
  type: 'BookValidation',
  message: 'The book is invalid',
  errors: {
    isbn: [
      { message: 'needs to be an ISBN-13', keyword: 'isbn', params: {} }
    ]
  }
})
```
