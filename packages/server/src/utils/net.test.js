import net from 'net'
import { getRandomFreePort } from './net.js'

describe('getRandomFreePort()', () => {
  it('resolves to a port that can be listened on', async () => {
    const port = await getRandomFreePort()
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThan(65536)
    const server = net.createServer()
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, resolve)
    })
    expect(server.address().port).toBe(port)
    await new Promise(resolve => server.close(resolve))
  })
})
