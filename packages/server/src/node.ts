import { once } from 'node:events'
import { createAdaptorServer } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, Hono } from 'hono'
import { parseDuration } from '@ditojs/utils'
import type { Service } from './types.ts'

export interface ServeOptions {
  port?: number | string
  host?: string
  // The time that `close()` may take before it fails, in milliseconds or as a
  // duration such as `'10s'`. 0 waits without a limit.
  closeTimeout?: number | string
  // Start in this order before the server listens, and stop in reverse order
  // after it has stopped, or when the start fails.
  services?: Service[]
}

// Serve `app` until `close()`, or until SIGINT and SIGTERM, which exit the
// process once the server and the services have stopped.
export async function serve(
  app: Hono<any, any, any>,
  { port, host, closeTimeout = 0, services = [] }: ServeOptions = {}
) {
  const timeout = parseDuration(closeTimeout)
  const stopServices = await startServices(services)
  const server = createAdaptorServer({ fetch: app.fetch })
  try {
    server.listen(Number(port ?? 0), host)
    await once(server, 'listening')
  } catch (error) {
    await stopServices()
    throw error
  }

  let closing: Promise<void> | undefined
  const shutDown = async () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
    await stopServices()
  }
  const close = () => (closing ??= addTimeout(shutDown(), timeout))
  // A failed close is an unhandled rejection, which Node prints before it
  // exits. A second signal ends the process, as the listeners are removed.
  const onSignal = () => close().then(() => process.exit(0))
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  return { server, close }
}

// Start `services` in order, and resolve to a function that stops them in
// reverse order. When one fails to start, stop those before it and throw.
export async function startServices(services: Service[]) {
  const started: Service[] = []
  const stopServices = async () => {
    for (const service of started.toReversed()) await service.stop?.()
  }
  try {
    for (const service of services) {
      await service.start?.()
      started.push(service)
    }
  } catch (error) {
    await stopServices()
    throw error
  }
  return stopServices
}

// The client's address: the one of `X-Forwarded-For` with the `proxy` option of
// `createHono()`, else the socket's.
export function getClientAddress(c: Context): string | undefined {
  return (
    c.var.clientAddress ??
    (c.env?.incoming ? getConnInfo(c).remote.address : undefined)
  )
}

function addTimeout(promise: Promise<void>, timeout: number) {
  if (timeout > 0) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<never>((resolve, reject) => {
      timer = setTimeout(
        reject,
        timeout,
        new Error(`Timeout reached while stopping the server (${timeout}ms)`)
      )
    })
    return Promise.race([promise, timedOut]).finally(() => clearTimeout(timer))
  } else {
    return promise
  }
}
