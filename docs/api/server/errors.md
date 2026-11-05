# Errors

```js
import {
  HttpError,
  createErrorHandler,
  createValidationError,
  notFound
} from '@ditojs/server'
```

Errors respond with JSON.

- An `HttpError` is meant for the client, which receives its message and data.
- Other errors respond with 500 and the title of the status, as their message
  may hold internals.
- Errors with a status of 500 or above go to the `onError` hook of
  [`createApi()`](api.md#apiconfig) and of
  [`createErrorHandler()`](#createerrorhandler). By default, the hook logs them.

## The body

```json
{
  "type": "BodyValidation",
  "message": "The body is not valid.",
  "status": 400,
  "errors": {
    "name": [{ "message": "Invalid input: expected string, received undefined", "keyword": "invalid_type" }]
  }
}
```

| Key       | Type                                                      | Description                                                                     |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `message` | `string`                                                  | What went wrong, for the client.                                                |
| `status`  | `number`                                                  | The status of the response.                                                     |
| `type`    | `string`                                                  | The kind of error, such as `ModelValidation`.                                   |
| `code`    | `string`                                                  | A code that clients act on.                                                     |
| `errors`  | `Record<string, { message: string; keyword?: string }[]>` | The field errors, see [Validation errors](#validation-errors).                  |
| any other | `unknown`                                                 | The error's data, such as `confirmationRequired`, which clients act on as well. |

## Validation errors

Invalid input responds with 400 and `errors`:

- `errors` is keyed by the path of the invalid value, such as
  `chapters/8/title`. The key `''` stands for the value itself.
- Each error has a `message` and a `keyword`.
- The `keyword` is a stable string, such as Zod's issue codes `invalid_type`
  and `too_small`. Clients can map it to their own messages.

The `type` tells where the input was:

| Type                  | Errors of                                                      |
| --------------------- | -------------------------------------------------------------- |
| `ParameterValidation` | The action's `query` schema.                                   |
| `BodyValidation`      | The action's `body` schema.                                    |
| `FilterValidation`    | The values of a list's filters, keyed by filter name.          |
| `ModelValidation`     | The data of a model, and `createValidationError()` by default. |

An unknown filter, a wrong `order` or `range`, and invalid JSON also respond
with 400. Their body only has a `message`, without `errors`.

See [Validation](../../guide/server/validation.md) in the guide.

## HttpError

```ts
new HttpError(status: number, options?: object)
```

```js
throw new HttpError(404)
throw new HttpError(409, { message: 'The book is already on loan.' })
throw new HttpError(403, {
  message: 'Please confirm your password.',
  confirmationRequired: true
})
```

| Option    | Type      | Description                                                                             |
| --------- | --------- | --------------------------------------------------------------------------------------- |
| `message` | `string`  | What went wrong, for the client. Default: the title of the status, such as `Not Found`. |
| `type`    | `string`  | The kind of error, such as `ModelValidation`.                                           |
| `code`    | `string`  | A code that clients act on.                                                             |
| `errors`  | `object`  | Field errors by path, see [The body](#the-body).                                        |
| `cause`   | `unknown` | The error that caused this one, for the app's logs. It isn't sent.                      |
| any other | `unknown` | More data of the body.                                                                  |

Its properties are `status`, `message`, `type`, `code`, `errors` and `data`.
`toJSON()` returns [the body](#the-body).

## createErrorHandler()

```ts
createErrorHandler({
  onError?: ({ error, c }: { error: unknown; c: Context }) => void | Promise<void>,
  toHttpError?: (error: unknown, c: DitoContext) => HttpError | undefined
}?): ErrorHandler
```

```js
app.onError(createErrorHandler())
// With a logger of the app:
app.onError(createErrorHandler({ onError: ({ error }) => logger.error(error) }))
```

The error handler for Hono's `app.onError()`. It handles the errors outside of
Dito APIs, such as those of the app's own routes and middleware. A Dito API
handles its own errors the same way.

First, `toHttpError()` maps the error, such as with the adapter's
`toHttpError()`. Then:

- An `HttpError` responds with [its body](#the-body).
- An error with a numeric `status` between 400 and 599 responds with that
  status. The errors of http-errors and Hono's `HTTPException` are such errors.
  The response has the error's message when `expose` is true, else the title of
  the status. `expose` defaults to true below 500.
- Other errors respond with 500 and the title of the status.

`onError` gets the errors with a status of 500 or above, as they were thrown.
By default, it logs them with `c.var.logger.error()`. `c.var.logger` is any
object with `error()` that the app's middleware sets. Without it, `onError`
logs with `console.error()`.

The response keeps the headers that were set before the error, such as cookies
and those of `cors()`. It drops the headers that describe the data:
`Content-*`, `ETag`, `Cache-Control` and `Location`.

Hono only handles `Error`s. So throw an `HttpError`, not a `Response`.

## notFound

```ts
notFound: NotFoundHandler
```

```js
app.onError(createErrorHandler())
app.notFound(notFound)
```

The handler of Hono's `app.notFound()`, for the paths that no API handles. It
throws `new HttpError(404)`. Hono sends this error to `app.onError()`, so the
app needs [`createErrorHandler()`](#createerrorhandler) too.

## createValidationError()

```ts
createValidationError(
  issues: readonly { message: string; path?: readonly PropertyKey[]; code?: string }[],
  options?: ValidationErrorOptions
): HttpError
```

```js
throw createValidationError([
  { path: ['shares'], code: 'custom', message: 'must add up to 100' }
])
```

Returns an error with the field errors of Zod issues, keyed by path. A string
`code` of an issue becomes the `keyword`. Use it for rules that run in code,
such as a check of a whole graph.

| Option    | Type      | Description                                                        |
| --------- | --------- | ------------------------------------------------------------------ |
| `message` | `string`  | Default: `The data is not valid.`                                  |
| `type`    | `string`  | Default: `ModelValidation`.                                        |
| `status`  | `number`  | Default: 400.                                                      |
| `cause`   | `unknown` | The error that caused this one, for the app's logs. It isn't sent. |

## Database errors

`createMikroAdapter()` of `@ditojs/mikro` maps the errors of MikroORM and
Postgres to an `HttpError`, see [Database errors](mikro.md#database-errors).
