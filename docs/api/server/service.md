# `class` Service

```js
import { Service } from '@ditojs/server'
```

The base class of services: application-wide functionality with a lifecycle,
configured in `config.services` and started and stopped with the application.
[Services](../../guide/server/services.md) shows how to write and register
them; [`app.setupServices()`](application.md#setupservices) describes how they
are set up.

## Constructor

```js
const service = new Service(app, name?, config?)
```

Usually the application creates services from the classes passed to it. To
create one yourself, e.g. in tests, pass its configuration as `config`:
`new MailService(app, 'mail', { host: 'localhost' })`.

#### Parameters

| Name   | Type                            | Description                                                                                                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`  | [`Application`](application.md) | The application.                                                                                                                                  |
| `name` | `string`                        | The name. Default: the class name. A `Service` suffix is removed and the result camel-cased: `'MailService'` → `'mail'`, `'search-index'` → `'searchIndex'`. |
| `config` | `object`                      | The configuration. Default: `null`; the application passes none and sets it through the internal `configure()` once the service exists, as class fields can override `name`. |

The application passes the key under which the service class was given as
`name`, and registers the service under `service.name` after construction. A
class field overrides it, and the configuration is then read from
`config.services` under that name:

```js
class JobService extends Service {
  name = 'jobs' // Configured by `config.services.jobs`.
}
```

The logger keeps the name passed to the constructor.

## Properties

| Name            | Type                            | Description                                                                  |
| --------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `app`           | [`Application`](application.md) | The application.                                                             |
| `name`          | `string`                        | The name under which `app.services` holds the service.                       |
| `config`        | `object \| null`                | The configuration, set before [`initialize()`](#initialize).                 |
| `isInitialized` | `boolean`                       | Set to `true` by `app.setupServices()`.                                      |
| `logger`        | `pino.Logger`                   | A child of [`app.logger`](application.md#properties), named after the hyphenated service name. |

## Methods

### configure()

```js
service.configure(config)
```

Receives `config.services[name]` and stores it as `config`. Internal, called
by [`app.setupServices()`](application.md#setupservices): override
`initialize()`, `start()` or `stop()` instead, which need no `super` call.

### initialize()

```js
await service.initialize()
```

Asynchronous setup, after `config` is set. Does nothing by default. *Hook.*
Returns `Promise<void>`.

### start()

```js
await service.start()
```

Called on the application's `'before:start'` event. Does nothing by default.
*Hook.* Returns `Promise<void>`.

### stop()

```js
await service.stop()
```

Called on the application's `'after:stop'` event. Does nothing by default.
*Hook.* Returns `Promise<void>`.

## Typed services

`app.services` can be typed through module augmentation:

```ts
declare module '@ditojs/server' {
  interface ApplicationServices {
    mail: MailService
  }
}
```

`Service` also takes the shape of its configuration as a type parameter:
`class MailService extends Service<{ from: string }>`.
