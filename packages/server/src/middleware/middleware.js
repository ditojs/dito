import compose from 'koa-compose'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import koaLogger from 'koa-logger'
import pinoLogger from 'koa-pino-logger'
import errorHandler from './errorHandler'

export default function middleware(app) {
  const { log = {} } = app.config
  const logger = {
    console: koaLogger,
    true: koaLogger,
    // TODO: Implement logging to actual file instead of console for Pino.
    file: pinoLogger
  }[log.server]
  return compose([
    logger && logger(),
    helmet(),
    cors(),
    bodyParser(),
    // methodOverride(),
    errorHandler()
  ].filter(val => val))
}
