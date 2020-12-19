import { nanoid } from 'nanoid'

export function attachLogger(logger) {
  return (ctx, next) => {
    ctx.logger = logger.child({ requestId: nanoid(6) })
    return next()
  }
}
