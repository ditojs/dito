import net from 'net'
import { createTestApp, getAppUrl } from './app.js'

describe('createTestApp()', () => {
  it('receives the requests to its url', async () => {
    const app = createTestApp()
    app.use(ctx => {
      ctx.body = 'app'
    })
    await app.start()
    // Servers of other processes may bind the app's port on specific loopback
    // addresses, wherever the address isn't taken yet:
    const { port } = app.server!.address() as net.AddressInfo
    const servers: net.Server[] = []
    for (const host of ['127.0.0.1', '::1']) {
      const server = net.createServer(socket => {
        socket.end('HTTP/1.1 426 Upgrade Required\r\n\r\n')
      })
      await new Promise<void>(resolve => {
        server.once('error', () => resolve())
        server.listen({ host, port }, () => {
          servers.push(server)
          resolve()
        })
      })
    }
    try {
      const response = await fetch(getAppUrl(app))
      expect(await response.text()).toBe('app')
    } finally {
      for (const server of servers) {
        server.close()
      }
      await app.stop()
      await app.knex.destroy()
    }
  })
})
