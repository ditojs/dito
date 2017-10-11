import compose from 'koa-compose'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import logger from 'koa-logger'
import errorHandler from './errorHandler'
import config from '../config'

export default function () {
  return compose([
    config.environment === 'development' && logger(),
    helmet(),
    cors(),
    bodyParser(),
    // methodOverride(),
    errorHandler()
  ].filter(val => val))
}
