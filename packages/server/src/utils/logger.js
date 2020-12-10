import pino from 'pino'
import { merge } from '@ditojs/utils/lib/object/merge'
import { nanoid } from 'nanoid'

export function createLogger({
  level = 'info',
  prettyPrint = prettyPrintConfig,
  serializers = {}
} = {}) {
  return pino({
    level,
    serializers: merge({}, serializers, {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      // Only id, to not inadvertently log PII.
      user: user => ({ id: user.id })
    }),
    prettyPrint,
    // Redact common sensitive headers.
    redact: ['*.headers.cookie', '*.headers.authorization'],
    base: null // no pid,hostname,name
  })
}

const prettyPrintConfig = {
  // List of keys to ignore in pretty mode.
  ignore: 'req,res,durationMs,user,requestId',
  // SYS to use system time and not UTC.
  translateTime: 'SYS:HH:MM:ss.l'
}

export const attachUserToLog = () => async (ctx, next) => {
  ctx.log = ctx.log?.child({ user: ctx.state.user }) || null
  return next()
  // Don't set back `ctx.log` because the context is still valid.
  // It is useful to the request-logger among others.
}

export const attachLogToCtx = loggerInstance => async (ctx, next) => {
  ctx.log = loggerInstance.child({ requestId: nanoid(6) })
  return next()
}
