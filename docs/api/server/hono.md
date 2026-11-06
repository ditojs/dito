# Hono and Node

```js
import { createHono } from '@ditojs/server'
import { getClientAddress, serve } from '@ditojs/server/node'
```

Dito APIs are [Hono](https://hono.dev) apps, which the app routes in the app of
`createHono()`. `@ditojs/server/node` serves the app on Node. It needs
`@hono/node-server`, an optional peer. See
[Hosting with Hono](../../guide/server/api.md#hosting-with-hono) and
[Behind a proxy](../../guide/server/api.md#behind-a-proxy) in the guide.

## createHono()

```ts
createHono(options?: CreateHonoOptions): Hono
```

Returns the `Hono` app that routes the APIs with `hono.route()`. It sends Dito's
JSON errors, also for unknown paths, and matches paths with a trailing slash
like those without one. This is the host of an app.

```js
const hono = createHono({
  proxy: true,
  etag: true,
  csrf: { origin: 'https://example.com' },
  cors: { origin: 'https://example.com' },
  bodyLimit: { maxSize: '5mb' }
})
hono.route('/api', api)
await serve(hono, { port: 8080 })
```

| Option       | Type                     | Description                                                                    |
| ------------ | ------------------------ | ------------------------------------------------------------------------------ |
| `proxy`      | `boolean \| number`      | The number of trusted reverse proxies, see [Proxies](#proxies). Default: none. |
| `onError`    | `({ error, c }) => void` | As in [`createApi()`](api.md#createapi), for the errors outside of APIs.       |
| `middleware` | `MiddlewareHandler[]`    | Runs before all other middleware, such as a request logger.                    |

The other options add Hono's standard middleware, in the order of this table, so
the responses of `csrf()` and `bodyLimit()` have the headers of the others. Each
takes one of three values:

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

### Proxies

`proxy` is for apps behind reverse proxies, and `true` means one.

- It sets the public URL as `c.req.url`, from `X-Forwarded-Proto` and
  `X-Forwarded-Host`. It ignores protocols other than `http` and `https`, and
  values other than a host with an optional port.
- It reads the client's address from `X-Forwarded-For`.
- It runs before the standard middleware, as `csrf()` compares the origin with
  the public URL.

See [Behind a proxy](../../guide/server/api.md#behind-a-proxy).

## getClientAddress()

```ts
getClientAddress(c: Context): string | undefined
```

Returns the client's address from `X-Forwarded-For`, with the `proxy` option of
[`createHono()`](#createhono). Without it, on Node, it returns the socket's
address.

## serve()

```ts
serve(app: Hono, options?: ServeOptions): Promise<{ server, close }>
```

Starts the services, listens on Node, and returns the Node server and `close()`.

- `close()` stops the server, then the services in reverse order.
- A failed start stops the services that started, in reverse order, and rejects.
- `close()` fails after `closeTimeout`.
- SIGINT and SIGTERM call `close()`, and exit the process.

| Option         | Type               | Description                                                                                                                                                                      |
| -------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port`         | `number \| string` | Default: a free port.                                                                                                                                                            |
| `host`         | `string`           | The hostname to listen on.                                                                                                                                                       |
| `closeTimeout` | `number \| string` | The time `close()` may take, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). `0`, the default, waits without a limit. |
| `services`     | `Service[]`        | Run next to the server. Default: none.                                                                                                                                           |

A service is `{ start?, stop? }`, of functions that may be async, such as a
mailer or a scheduler. Its `stop()` ends once its work is done, as another
service may close the database next.

## startServices()

```ts
startServices(services: Service[]): Promise<() => Promise<void>>
```

From `@ditojs/server/node`. Starts the services in order, and resolves to a
function that stops them in reverse order. When one fails to start, it stops
those before it and rejects. `serve()` and
[`runPlayground()`](kit.md#runplayground) use it, as do scripts that need the
services without a server.
