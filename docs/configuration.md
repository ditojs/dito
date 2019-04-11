# Dito.js Configuration

TODO: Describe each configuration option:

`src/config/index.js`

```js
const { env } = process

export default {
  env: env.NODE_ENV || 'development',
  server: {  
    host: env.NODE_HOST || env.HOST || '0.0.0.0',
    port: env.NODE_PORT || env.PORT || 8080
  },
  log: {
    requests: false,
    routes: false,
    relations: false,
    schema: false,
    sql: false
  },
  app: {
    normalizePaths: true,  // default: false
    proxy: true,           // default: false
    // middleware:
    responseTime: true,    // default: true
    helmet: true,          // default: true
    cors: true,            // default: true
    compress: true,        // default: true
    etag: true,            // default: true
    session: true          // default: false,
                           // optional: session: { modelClass: 'SessionModel' }
    passport: true,        // default: false
    csrf: true,            // TODO: Implement
    // keys to be used for session:
    keys: ['secret sauce']
  },
  knex: {
    normalizeDbNames: true,
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: './database.db'
    }
  }
}
```
