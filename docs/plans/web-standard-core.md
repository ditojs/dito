# A core on web standards

Dito 7's server packages build on `Request` and `Response` and on no HTTP
framework. An app gets a `fetch(request) → Response` and mounts it in the host
of its choice: `@hono/node-server`, Hono, h3, srvx, Bun or Deno. Hosting,
logging, config and services stay the app's.

## The app

```ts
const api = createApp({
  base: '/api/admin',
  controllers,
  around: [requestStorage(), sessions], // middleware of every action
  connect,                              // ctx.db of a request
  transaction,                          // runs the writes
  getUser,                              // ctx.user
  onError                               // error → Response, problemResponse by default
})

host.all('/api/admin/*', c => api.fetch(c.req.raw, { ip: getIp(c) }))
```

- `fetch(request, locals?)` answers every request, and 404 Problem Details for
  routes it doesn't have. `locals` are what the host passes in, as
  `ctx.locals`.
- An app may create one app per controller and mount each on first request.
  Nothing in `createApp()` is shared between controllers.

## The context

A handler gets `ctx` and returns data or a `Response`.

|                                          |                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ctx.req`                                | the `Request`                                                                                        |
| `ctx.url`                                | its `URL`                                                                                            |
| `ctx.params`                             | the path parameters                                                                                  |
| `ctx.query`                              | the validated query, or the first value of each parameter                                            |
| `ctx.body()`                             | the validated or parsed JSON body, once per request                                                  |
| `ctx.res`                                | `{ status, headers }` of the response that Dito makes, whose headers also go on returned `Response`s |
| `ctx.user`, `ctx.memberId`, `ctx.load()` | as before                                                                                            |
| `ctx.db`, `ctx.trx`                      | the request's database handle, the transaction's                                                     |
| `ctx.action`                             | the action that runs                                                                                 |
| `ctx.locals`                             | the host's and the middleware's values, typed by augmenting `DitoLocals`                             |

Middleware is `(ctx, next) => Response`, with `next()` returning the response
of what it wraps. Errors are thrown and caught with plain try/catch, so
transactions roll back by throwing.

## Errors

- One class, `HttpError(status, { detail, title, type, errors, ...members })`.
  Its detail and members are meant for the client. Other errors answer a bare
  500, and `onError` logs them.
- One format, RFC 9457 Problem Details. Validation errors carry `errors` keyed
  by JSON Pointer, such as `/sets/8/name`. Dito 6's format is gone, and the
  admin reads Problem Details.
- ORM packages export `toProblem(error)` for their errors, which an app's
  `onError` chains.

## Packages

- `auth`: sessions are middleware for `around`, the user routes are
  controllers, and cookies are read from and set on headers.
- `storage`: uploads read `ctx.req.formData()`.
- `admin-server`: `serveAdmin()` returns `{ fetch, close }`. In development it
  starts Vite's own server and passes requests to it.
- `objection`, `mikro`: model controllers on `ctx`.
