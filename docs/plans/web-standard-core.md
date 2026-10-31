# A core on web standards

Dito 7's server packages build on `Request` and `Response` and on no HTTP
framework. An app gets a `fetch(request) → Response` and mounts it in the host
of its choice: `@hono/node-server`, Hono, h3, srvx, Bun or Deno. Hosting,
logging, config and services stay the app's. Where a convention is needed,
Dito follows h3 v2, which is on web standards and uses the same router, rou3.

## The app

```ts
const api = createApp({
  prefix: '/api/admin',
  controllers,
  middleware: [requestStorage(), sessions.middleware], // every action
  connect, // ctx.db of a request
  transaction, // runs the writes
  getUser, // ctx.user
  onError // error → Response, errorResponse by default
})

host.all('/api/admin/*', c => api.fetch(c.req.raw, { ip: getIp(c) }))
```

- `fetch(request, locals?)` answers every request, and 404 Problem Details for
  routes it doesn't have. `locals` are what the host passes in, as
  `ctx.locals`.
- An app may create one app per controller and mount each on first request.
  Nothing in `createApp()` is shared between controllers.

## Controllers

```ts
export default defineController({
  path: 'fonts',
  features: [audit],
  authorize: 'admin',
  collection: {
    allow: ['get', 'post'],
    'get by-name/:name': ctx => findByName(ctx.db, ctx.params.name)
  },
  member: {
    allow: ['get', 'patch'],
    patch: async (ctx, next) => {
      check(ctx.body)
      return next()
    },
    'post publish': action({
      body: z.object({ at: z.iso.datetime() }),
      handler: async ctx => publish(await ctx.member(), ctx.body.at)
    })
  }
})
```

- Actions are keyed `'verb path'`, and the verbs without a path are the
  default verbs. `defineController()` types `ctx.params` from the key's
  `:name` and `:name+` segments, and member actions also get `id`.
  `action()` types `ctx.query` and `ctx.body` from its schemas.
- An ORM package's `defineController()` puts its base of default verbs and
  slots under the definition. They are routed only if `allow` lists them, or
  with `allow: ['*']`. A verb that a feature or the controller defines is
  always routed. An action of the same key wraps the one beneath it, which it
  runs as `next()`.
- Layers are the base, the `features` (depth-first) and the controller. A
  later layer's settings win. `middleware` lists are joined, and `serialize`
  calls are chained: the base's turns the record into JSON, and each later
  layer gets the previous layer's JSON.
- `authorize` is roles, any of which grant access, or a function of `ctx`.
- Writes run in a transaction. `transaction: false` is for actions that run
  their own, and `transaction: true` for reads that need one.
- Slots: `load(ctx, id)` behind `ctx.member()`, `isRecord(value)` for what
  `serialize` converts, which only the base sets, and `onResult(ctx, result)`,
  which runs once on the handler's result.

## The context

A handler gets `ctx` and returns data or a `Response`.

|                          |                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `ctx.req`                | the `Request`                                                                                        |
| `ctx.url`                | its `URL`                                                                                            |
| `ctx.params`             | the path parameters                                                                                  |
| `ctx.query`              | the validated query, or the first value of each parameter                                            |
| `ctx.body`               | the validated or parsed JSON body, `{}` when empty, undefined on GET and for bodies of other types   |
| `ctx.res`                | `{ status, headers }` of the response that Dito makes, whose headers also go on returned `Response`s |
| `ctx.user`               | the user from `getUser()`, or null                                                                   |
| `ctx.id`, `ctx.member()` | the member's id from the path, as a string, and the member that the `load` slot loads                |
| `ctx.db`                 | the request's database handle, which the ORM's transaction sets to its own during a transaction      |
| `ctx.action`             | the action that runs, with its schemas                                                               |
| `ctx.locals`             | the host's and the middleware's values, typed by augmenting `DitoLocals`                             |

Middleware is `(ctx, next) => Response`, with `next()` returning the response
of what it wraps. Errors are thrown and caught with plain try/catch, so
transactions roll back by throwing.

The core routes `/:id` for members and passes the id as a string. The ORM
package's base converts it for the model's primary key, and answers 404 for
ids that don't fit it.

## The query

| Parameter            | Meaning                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `filter[name]=value` | a named filter of the controller; repeated for filters of several values |
| `order=name desc`    | the order, repeated for several properties                               |
| `range=0,49`         | rows 0 to 49, inclusive; the answer is `{ results, total }`              |
| `fields=id,name,a.b` | sparse fieldsets: only these fields, which the controller must allow     |

`parseListQuery(ctx)` parses them for ORM packages. Zod helpers for query
values, such as `q.boolean()`, are in `@ditojs/server-next/zod`. The core
itself depends on Standard Schema only.

## Errors

- One class, `HttpError(status, { detail, title, type, errors, ...members })`.
  Its detail and members are meant for the client. Other errors answer a bare
  500, and `onError` logs them.
- One format, RFC 9457 Problem Details, from `errorResponse(error)` and
  `HttpError#toJSON()`. Validation errors carry `errors` keyed by JSON
  Pointer, such as `/sets/8/name`, from `toFieldErrors(issues)`. The admin
  reads them.
- ORM packages export `toHttpError(error)` for their errors, which an app's
  `onError` chains: `errorResponse(toHttpError(error) ?? error)`.

## Packages

- `auth`: sessions are middleware for `createApp({ middleware })`, the user
  routes are a controller, and cookies are read from and set on headers.
- `storage`: uploads read `ctx.req.formData()`, which the core leaves unread.
- `admin-server`: `serveAdmin()` returns `{ fetch, close }`. In development it
  starts Vite's own server and passes requests to it.
- `objection`, `mikro`: model controllers on `ctx`.
