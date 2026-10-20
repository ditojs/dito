# Errors

When a request fails, Dito.js responds with the error's status and, to clients
that accept JSON, with the error as JSON:

```json
{ "message": "'Book' model with id 42 not found" }
```

Dito.js' own errors extend `ResponseError`, which carries the status and the
data to send. The [Errors API](../../api/server/errors.md) lists all error
classes.

## Throwing errors

Throw a `ResponseError`, or one of its subclasses, to respond with a status of
your choice:

```js
import { NotFoundError, ResponseError } from '@ditojs/server'

'post checkout': {
  parameters: {
    bookId: { type: 'integer', required: true }
  },
  async handler(ctx, { bookId }) {
    const book = await Book.findById(bookId)
    if (!book) {
      throw new NotFoundError(`Book ${bookId} not found`)
    }
    if (book.stock === 0) {
      throw new ResponseError({
        message: 'The book is sold out',
        status: 409,
        code: 'sold_out',
        bookId
      })
    }
    // …
  }
}
```

The first argument is a message, or an object with `message`, `status` and
further data. Everything besides `message`, `status` and `cause` is sent to
the client along with the message:

```json
{ "message": "The book is sold out", "code": "sold_out", "bookId": 7 }
```

Errors of your own extend `ResponseError` with their defaults:

```js
import { ResponseError } from '@ditojs/server'

export class SoldOutError extends ResponseError {
  constructor(error) {
    super(error, { message: 'The book is sold out', status: 409 })
  }
}
```

### Plain errors

Other errors, e.g. a plain `Error` or an error of a library, respond with
status 500, unless they have a `status` of their own. Their message may contain
internals such as hosts, paths or SQL, so it only goes to the log and the app's
`'error'` events, and the client receives a generic message:

```js
throw new Error('Stock service timed out')
// Responds 500 with { "message": "An error has occurred." }
```

So throw a `ResponseError` for messages meant for clients. Errors with a
status below 500 describe the request and send their message too, e.g. those
of invalid JSON bodies. The `expose` flag decides otherwise: errors with
`expose: true`, e.g. from Koa's `ctx.throw()`, send their message, and errors
with `expose: false` send the generic message, as `DatabaseError`s with status
500 do. With `config.env` set to `'development'`, all errors send their
message.

## Error classes

Dito.js throws its own errors for invalid data (`ValidationError`, 400),
database errors (`DatabaseError`), missing models (`NotFoundError`, 404),
failed logins (`AuthenticationError`) and denied requests
(`AuthorizationError`, both 401), invalid query parameters, graphs and
relations (`QueryBuilderError`, `GraphError`, `RelationError`, 400), and
invalid files (`AssetError`, 400). The
[Errors API](../../api/server/errors.md) lists all classes with their status.

## Validation errors

`ValidationError`s hold the errors of each invalid value, keyed by the data
path of the value, and a `type` that tells what was validated, e.g.
`'ModelValidation'`, `'ParameterValidation'`, `'ResultValidation'` or
`'FilterValidation'`:

```json
{
  "message": "The provided action parameters are not valid",
  "type": "ParameterValidation",
  "errors": {
    "quantity": [
      {
        "message": "must be 1 or more",
        "keyword": "minimum",
        "params": { "comparison": ">=", "limit": 1 }
      }
    ]
  }
}
```

The admin shows these errors next to the fields they belong to. See
[Validation](validation.md).

To report invalid data from your own code in the same format, throw a
`ValidationError` with `errors`:

```js
import { ValidationError } from '@ditojs/server'

throw new ValidationError({
  type: 'OrderValidation',
  message: 'The order is invalid',
  errors: {
    'lines/0/quantity': [
      { message: 'exceeds the stock', keyword: 'stock', params: {} }
    ]
  }
})
```

## Database errors

Errors of the database driver are wrapped in a `DatabaseError`. Its status
depends on the error: 400 for `CheckViolationError`, `NotNullViolationError`
and `DataError`, 409 for constraint violations such as
`UniqueViolationError` and `ForeignKeyViolationError`, and 500 for others.
`type` holds the name of Objection.js' error class:

```json
{
  "message": "duplicate key value violates unique constraint …",
  "type": "UniqueViolationError"
}
```

The SQL query isn't sent, unless `log.errors.sql` is set in the
[configuration](configuration.md#keys).

## Logging

The application emits every error of a request as an `'error'` event, and logs
it: errors with a status below 500 at level `info`, others at `error`.
`log.errors` in the [configuration](configuration.md#keys) controls this.

To report errors elsewhere, listen to the event, or override
`logError()` in a subclass of the application, see
[Application](application.md#events).
