import Koa from 'koa'
import mount from 'koa-mount'
import serve from 'koa-static'
import api from './api'
import middleware from './middleware'
import config from './config'

const app = new Koa()

app.use(middleware())
app.use(mount(api))
app.use(serve('static'))

app.start = function () {
  const { environment, server: {host, port} } = config
  app.server = app.listen(port, host, () => {
    // TODO: logging?
    console.log(
      `${environment} server started at http://${host}:${port}`
    )
  })
}

app.close = function () {
  // TODO: server.close()...
}

export default app
