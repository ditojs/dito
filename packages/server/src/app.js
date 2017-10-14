import serve from 'koa-static'
import App from './core/App'
import RestApi from './core/RestApi'
import middleware from './middleware'
import config from './config'
import models from './models'

const app = new App(config, models)
const api = new RestApi('/api')
app.use(middleware())
app.use(api.build(models))
app.use(serve('static'))

export default app
