# Dito.js Application

The Dito.js Application class inherits from the
[Koa Application class](http://koajs.com/#application).

Normally, a simple Dito.js Server creates only one `Application` instance and
exports it:

##### `src/server/app.js`:
```js
import { Application } from '@ditojs/server'
import mount from 'koa-mount'
import serve from 'koa-static'
import config from '../config.js'
import * as models from './models/index.js'
import * as controllers from './controllers/index.js'

const app = new Application({
  config,
  models,
  controllers
})

// Static Assets:
app.use(mount('/assets', serve('assets')))

export default app
```

Then, in the application's main file, all it takes to start the server is the
following statement:

##### `src/server/index.js`:
```js
import app from './app/index.js'

app.startOrExit()
```

Dito.js applications can register custom keywords and formats for JSON schema
validation. In order to do so, a `Validator` instance needs to be provided.

See [Validator](./validator.md) and [Model Properties](./models.md#properties)
for more information on JSON schema validation.
