# Dito.js Kit

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/kit` sets up a Dito.js app in one call.

```js
// server/app.js
import { createApp } from '@ditojs/kit'
import * as entities from './entities/index.js'

export const app = createApp({
  entities,
  database: { dbName: 'catalog', user: 'catalog' },
  server: { port: 8080 },
  secrets: [process.env.SECRET]
})
```

```js
// server/index.js
import { app } from './app.js'
import * as controllers from './controllers/index.js'

app.routeApi('/api', { controllers })
await app.start()
```

See
[The kit](https://github.com/ditojs/dito/blob/main/docs/guide/server/kit.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/kit.md).
