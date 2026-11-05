# Hono and Node

```js
import { hostMiddleware } from '@ditojs/server'
import { forwarded, getClientAddress, serve } from '@ditojs/server/node'
```

Dito APIs are [Hono](https://hono.dev) apps. The app routes them in its own
`Hono` instance. `@ditojs/server/node` serves the app on Node. It needs
`@hono/node-server`, an optional peer. See
[Hosting with Hono](../../guide/server/api.md#hosting-with-hono) and
[Behind a proxy](../../guide/server/api.md#behind-a-proxy) in the guide.

## hostMiddleware()

```ts
hostMiddleware(options?: HostMiddlewareOptions): MiddlewareHandler[]
```

```js
app.use(
  ...hostMiddleware({
    csrf: { origin: 'https://example.com' },
    cors: { origin: 'https://example.com' },
    bodyLimit: { maxSize: '5mb' }
  })
)
```

Returns Hono's standard middleware for a host, for
`app.use(...hostMiddleware())`. Each option takes one of three values:

- `false` leaves the middleware out;
- `true` adds it with its defaults;
- an object adds it with these options.

| Option          | Default | Description                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secureHeaders` | `true`  | Hono's `secureHeaders()`.                                                                                                                                                                                                                                                                                                                                                                   |
| `cors`          | `false` | Hono's `cors()`.                                                                                                                                                                                                                                                                                                                                                                            |
| `etag`          | `false` | Hono's `etag()`.                                                                                                                                                                                                                                                                                                                                                                            |
| `csrf`          | `true`  | Hono's `csrf()`. It only checks requests with `Origin`. Browsers send `Origin`, and other clients can't carry an attack. `csrf()` lets `application/json` pass, which forms can't send.                                                                                                                                                                                                     |
| `bodyLimit`     | `true`  | Hono's `bodyLimit()`. Its `maxSize` is 1 MB unless the options set one, in bytes or as a string with a unit, such as `'5mb'`, see [`parseFileSize()`](../utils.md#parsefilesize). Multipart bodies have no limit here: uploads limit each file with `maxSize`, see [Uploads](storage.md#uploads). The reverse proxy can limit the whole body, such as with `client_max_body_size` in nginx. |

The middleware runs in the order of the table. So the responses of `csrf()` and
`bodyLimit()` have the headers of the others.

## forwarded()

```ts
forwarded(proxy?: boolean | number): MiddlewareHandler
```

Middleware for apps behind reverse proxies. The app adds it first.

- `proxy` is the number of trusted proxies. `true`, the default, means one.
- It sets the public URL as `c.req.url`, from `X-Forwarded-Proto` and
  `X-Forwarded-Host`.
- It reads the client's address from `X-Forwarded-For`.

See [Behind a proxy](../../guide/server/api.md#behind-a-proxy).

## getClientAddress()

```ts
getClientAddress(c: Context): string | undefined
```

Returns the client's address that `forwarded()` read. Without it, on Node, it
returns the socket's address.

## serve()

```ts
serve(app: Hono, options?: ServeOptions): Promise<{ server, close }>
```

Listens on Node, and returns the Node server and `close()`.

- `close()` stops the server, then runs `onClose`.
- `close()` fails after `closeTimeout`.
- SIGINT and SIGTERM call `close()`, and exit the process.

| Option         | Type                          | Description                                                                                                                                                                      |
| -------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port`         | `number \| string`            | Default: a free port.                                                                                                                                                            |
| `host`         | `string`                      | The host to listen on.                                                                                                                                                           |
| `closeTimeout` | `number \| string`            | The time `close()` may take, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). `0`, the default, waits without a limit. |
| `onClose`      | `() => void \| Promise<void>` | Runs after the server has stopped, such as `orm.close()`.                                                                                                                        |
