import compose from 'koa-compose'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import koaLogger from 'koa-logger'
import knexLogger from './knexLogger'
import errorHandler from './errorHandler'

export default function middleware(app) {
  const dev = app.config.environment === 'development'
  const {
    log: {
      server = dev,
      sql = dev
    } = {}
  } = app.config
  return compose([
    server && koaLogger(),
    sql && knexLogger(app.knex),
    helmet(),
    cors(),
    bodyParser(),
    // methodOverride(),
    errorHandler()
  ].filter(val => val))
}
