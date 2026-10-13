# Services

Services hold functionality that the whole application uses and that has a
lifecycle: a mailer that opens a connection, a search index, a payment
provider's client, a job that runs on a schedule. The application configures,
starts and stops them along with itself.

```js
// src/server/services/MailService.js
import { Service } from '@ditojs/server'
import nodemailer from 'nodemailer'

export class MailService extends Service {
  configure(config) {
    super.configure({ port: 25, ...config })
  }

  async initialize() {
    this.transport = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port
    })
  }

  async stop() {
    this.transport.close()
  }

  sendOrderConfirmation(order, customer) {
    return this.transport.sendMail({
      from: this.config.from,
      to: customer.email,
      subject: `Your order ${order.number}`,
      text: 'Thank you for your order.'
    })
  }
}
```

Services are registered through the application's `services` option, and
configured in `config.services`, under the same name:

```js
// src/server/services/index.js
export * from './MailService.js'
```

```js
// src/server/app.js
import * as services from './services/index.js'

const app = new Application({ config, models, controllers, services })
```

```js
// config/index.js
export default {
  services: {
    mail: {
      host: 'smtp.bookshop.example.com',
      from: 'orders@bookshop.example.com'
    }
  }
}
```

## Names

A service is named after the key it is registered under, without a `Service`
suffix and camel-cased: `MailService` becomes `mail`. A class field `name`
overrides it:

```js
export class StockSync extends Service {
  name = 'inventory'
}
```

The application keeps services under their names: `app.services.mail`, or
`app.getService('mail')`.

## Configuration

Every registered service needs an entry in `config.services`; starting the
application throws without one. Setting the entry to `false` removes the
service, e.g. to turn it off in development:

```js
services: {
  mail: process.env.SMTP_HOST ? { host: process.env.SMTP_HOST } : false
}
```

Code that uses a service that may be turned off checks for it:
`app.getService('mail')` returns `null` then.

## Lifecycle

The application calls `configure(config)` with `config.services[name]` when
it is set up; it stores it as `this.config`, and overrides call
`super.configure()`. `initialize()` follows right after, and is awaited, for
asynchronous setup. `start()` is called when the application starts, before
it listens, and `stop()` once it has stopped. See the
[`Service` API](../../api/server/service.md#methods).

All of them are optional. The application sets up storages first, then
services, then models and controllers, so services can use storages in
`initialize()`, and models can use services in their own `initialize()`.

`configure()` and `initialize()` also run when the application is only set
up, e.g. by `dito console` or scripts that call `app.setup()`. Work that
should only happen in a running server, such as timers, belongs in `start()`:

```js
export class CleanupService extends Service {
  async start() {
    this.timer = setInterval(
      () => this.app.releaseUnusedAssets(),
      60 * 60 * 1000
    )
  }

  async stop() {
    clearInterval(this.timer)
  }
}
```

## Using services

Models, controllers and other services reach a service through the
application:

```js
export class Orders extends ModelController {
  modelClass = Order

  hooks = {
    async 'after:collection:post'(ctx, order) {
      const customer = await order.$customer.query().first()
      await this.app.services.mail.sendOrderConfirmation(order, customer)
    }
  }
}
```

`this.logger` is a logger named after the service.

The [`Service` API](../../api/server/service.md) lists all members, and how to
type `app.services` in TypeScript.
