import mount from 'koa-mount'
import serve from 'koa-static'
import App from './core/App'
import api from './api'
import middleware from './middleware'
import config from './config'
import models from './models'

const app = new App(config, models)

app.use(middleware())
app.use(mount(api))
app.use(serve('static'))

export default app
