import serve from 'koa-static'
import RestApi from './core/RestApi'
import middleware from './middleware'
import app from './app'

const api = new RestApi('/api')
app.use(middleware())
app.use(api.build(app.models))
app.use(serve('static'))

app.start()
