import compose from 'koa-compose'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import logger from 'koa-logger'
import errorHandler from './errorHandler'
import knexLogger from './knexLogger'

export default function middleware(app) {
  const dev = app.config.environment === 'development'
  const {
    log: {
      requests = dev,
      sql = dev
    } = {}
  } = app.config
  return compose([
    requests && logger(),
    sql && knexLogger(app.knex),
    helmet(),
    cors(),
    bodyParser(),
    // methodOverride(),
    errorHandler()
  ].filter(val => val))
}
