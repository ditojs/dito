import pino from 'pino'
import { nanoid } from 'nanoid'

export function createLogger({
  level = 'info',
  prettyPrint = {
    // List of keys to ignore in pretty mode.
    ignore: 'req,res,durationMs,user,requestId',
    // SYS to use system time and not UTC.
    translateTime: 'SYS:HH:MM:ss.l'
  },
  serializers = {}
} = {}) {
  const { err, req, res } = pino.stdSerializers
  // Only include `id` from the user, to not inadvertently log PII.
  const user = user => ({ id: user.id })
  return pino({
    level,
    serializers: {
      err,
      req,
      res,
      user,
      ...serializers
    },
    prettyPrint,
    // Redact common sensitive headers.
    redact: ['*.headers.cookie', '*.headers.authorization'],
    base: null // no pid,hostname,name
  })
}

export const attachUserToLog = () => (ctx, next) => {
  ctx.log = ctx.log?.child({ user: ctx.state.user }) || null
  return next()
  // Don't set back `ctx.log` because the context is still valid.
  // It is used in `logResponse()`, among others.
}

export const attachLogToCtx = loggerInstance => (ctx, next) => {
  ctx.log = loggerInstance.child({ requestId: nanoid(6) })
  return next()
}
