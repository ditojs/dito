/*
 * Module inspired by 'koa-logger'. Adapted and extended to our needs.
 */
import counterFunc from 'passthrough-counter'
import bytes from 'bytes'
import chalk from 'chalk'

export function logRequests({ ignoreUrls } = {}) {
  return async function middleware(ctx, next) {
    if (ignoreUrls && ctx.req.url.match(ignoreUrls)) {
      return next()
    }
    // request
    const start = Date.now()

    logRequest(ctx)

    try {
      await next()
    } catch (err) {
      logResponse({ ctx, start, err })
      throw err
    }

    // calculate the length of a streaming response
    // by intercepting the stream with a counter.
    // only necessary if a content-length header is currently not set.
    const {
      body,
      response: { length }
    } = ctx
    let counter
    if (length === null && body && body.readable) {
      ctx.body = body.pipe((counter = counterFunc())).on('error', ctx.onerror)
    }

    // log when the response is finished or closed,
    // whichever happens first.
    const { res } = ctx

    const onfinish = done.bind(null, 'finish')
    const onclose = done.bind(null, 'close')

    res.once('finish', onfinish)
    res.once('close', onclose)

    function done() {
      res.removeListener('finish', onfinish)
      res.removeListener('close', onclose)
      logResponse({ ctx, start, length: counter ? counter.length : length })
    }
  }
}

function logRequest(ctx) {
  const log = ctx.log?.child({ name: 'http-request' })
  log?.trace(
    {
      req: ctx.req
    },
    `${chalk.gray('<--')} ${chalk.bold(ctx.method)} ${chalk.gray(
      ctx.originalUrl
    )}`
  )
}

function logResponse({ ctx, start, length, err }) {
  const log = ctx.log?.child({ name: 'http-response' })

  if (!log) {
    return
  }

  // get the status code of the response
  const status = err ? err.status || 500 : ctx.status || 404

  // set the color of the status code;
  const s = (status / 100) | 0
  const color = colorCodes.hasOwnProperty(s) ? colorCodes[s] : colorCodes[0]

  // get the human readable response length
  const formattedLength = [204, 205, 304].includes(status)
    ? ''
    : length == null
      ? '-'
      : bytes(length).toLowerCase()

  const formattedTime = formatTime(start)

  const msg = `${chalk.bold(ctx.method)} ${chalk.gray(
    ctx.originalUrl
  )} ${chalk[color](status)} ${chalk.gray(formattedTime)} ${chalk.gray(
    formattedLength
  )}`

  log[err ? 'warn' : 'info']({
    req: ctx.req,
    res: ctx.res
  }, msg)
}

function formatTime(start) {
  const delta = Date.now() - start
  return delta < 10000 ? delta + 'ms' : Math.round(delta / 1000) + 's'
}

const colorCodes = {
  7: 'magenta',
  5: 'red',
  4: 'yellow',
  3: 'cyan',
  2: 'green',
  1: 'green',
  0: 'yellow'
}
