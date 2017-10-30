import compose from 'koa-compose'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import koaLogger from 'koa-logger'
import errorHandler from './errorHandler'

export default function middleware(app) {
  const { log = {} } = app.config
  return compose([
    log.server && koaLogger(),
    helmet(),
    cors(),
    bodyParser(),
    // methodOverride(),
    errorHandler()
  ].filter(val => val))
}
