import App from './core/App'
import Validator from './core/Validator'
import config from './config'
import models from './models'
import * as validators from './validators'

const validator = new Validator({ validators })
const app = new App(config, { validator, models })

export default app
