# Hono and Node

```js
import { hostMiddleware } from '@ditojs/server'
import { forwarded, getClientAddress, serve } from '@ditojs/server/node'
```

Dito APIs are [Hono](https://hono.dev) apps, which the app routes in its own
`Hono` instance. `@ditojs/server/node` serves the app on Node. It needs
`@hono/node-server`, an optional peer. See
[Hosting with Hono](../../guide/server/api.md#hosting-with-hono) and
[Behind a proxy](../../guide/server/api.md#behind-a-proxy) in the guide.

## hostMiddleware()

```ts
hostMiddleware(options?: HostOptions): MiddlewareHandler[]
```

Returns Hono's standard middleware for a host, for
`app.use(...hostMiddleware())`. Each option is `false`, `true` for the defaults
of that middleware, or its options.

| Option          | Default | Description                                                                                                                                                                         |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secureHeaders` | `true`  | Hono's `secureHeaders()`.                                                                                                                                                           |
| `cors`          | `false` | Hono's `cors()`.                                                                                                                                                                    |
| `etag`          | `false` | Hono's `etag()`.                                                                                                                                                                    |
| `csrf`          | `true`  | Hono's `csrf()`, only for requests with `Origin`: browsers send it, and other clients can't carry an attack. It passes `application/json`, which forms can't send.                  |
| `bodyLimit`     | `true`  | Hono's `bodyLimit()`, with a `maxSize` of 1 MB unless the options set one. Multipart bodies have no limit here: the reverse proxy sets it, such as `client_max_body_size` in nginx. |

They run in this order, so the responses of `csrf()` and `bodyLimit()` have the
headers of the others.

```js
app.use(
  ...hostMiddleware({
    csrf: { origin: 'https://example.com' },
    cors: { origin: 'https://example.com' },
    bodyLimit: { maxSize: 5 * 1024 * 1024 }
  })
)
```

## forwarded()

```ts
forwarded(proxy?: boolean | number): MiddlewareHandler
```

Middleware for apps behind reverse proxies, which the app adds first. `proxy` is
the number of trusted proxies, and `true`, the default, means one. It sets the
public URL from `X-Forwarded-Proto` and `X-Forwarded-Host` as `c.req.url`, and
the client's address from `X-Forwarded-For`, see
[Behind a proxy](../../guide/server/api.md#behind-a-proxy).

## getClientAddress()

```ts
getClientAddress(c: Context): string | undefined
```

Returns the client's address: the one that `forwarded()` read, else the socket's
on Node.

## serve()

```ts
serve(app: Hono, options?: ServeOptions): Promise<{ server, close }>
```

Listens on Node, and returns the Node server and `close()`. `close()` runs
`onClosing`, stops the server, then runs `onClose`. It fails after `shutdownTimeout`. SIGINT and
SIGTERM call `close()` and exit the process.

| Option            | Type                          | Description                                                                                                 |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `port`            | `number \| string`            | Default: a free port.                                                                                       |
| `host`            | `string`                      | The host to listen on.                                                                                      |
| `shutdownTimeout` | `number`                      | The milliseconds `close()` may take. `0`, the default, waits without a limit.                               |
| `onClosing`       | `() => void \| Promise<void>` | Runs before the server stops, while requests still run, so that long tasks can tell that a close has begun. |
| `onClose`         | `() => void \| Promise<void>` | Runs after the server has stopped, such as `orm.close()`.                                                   |
