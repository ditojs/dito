import Knex from 'knex'
import config from '../config'
import knexConfig from '../../knexfile'

import Dummy from './Dummy'

const models = {
  Dummy
}

// Initialize knex and bind all models to it:
const knex = Knex(knexConfig[config.environment])
for (const model of Object.values(models)) {
  model.knex(knex)
}

export default models
