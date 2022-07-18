import net from 'net'

export async function getRandomFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, () => {
      const port = srv.address().port
      srv.close(err => {
        if (err) {
          reject(err)
        } else {
          resolve(port)
        }
      })
    })
  })
}
