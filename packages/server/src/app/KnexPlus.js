import Knex from 'knex'
import chalk from 'chalk'
import { underscore, camelize } from '@/utils'

// Methods to be added to the Dito knex instance (app.knex):

const properties = Object.getOwnPropertyDescriptors({
  normalizeIdentifier(name) {
    const { normalizeIdentifier } = this.client.config
    return normalizeIdentifier ? normalizeIdentifier(name) : name
  },

  denormalizeIdentifier(name) {
    const { denormalizeIdentifier } = this.client.config
    return denormalizeIdentifier ? denormalizeIdentifier(name) : name
  },

  get dialect() {
    return this.client && this.client.dialect || null
  },

  get isPostgreSQL() {
    return this.dialect === 'postgresql'
  },

  get isMySQL() {
    return this.dialect === 'mysql'
  },

  get isSQLite() {
    return this.dialect === 'sqlite3'
  },

  get isMsSQL() {
    return this.dialect === 'mssql'
  },

  setupLogging() {
    const startTimes = {}

    function end(query, { response, error }) {
      const id = query.__knexQueryUid
      const duration = process.hrtime(startTimes[id])
      delete startTimes[id]
      console.log('  %s %s %s %s\n%s',
        chalk.yellow.bold('knex:sql'),
        chalk.cyan(query.sql),
        chalk.gray('{' + query.bindings.join(', ') + '}'),
        chalk.magenta(duration + 'ms'),
        response
          ? chalk.green(JSON.stringify(response))
          : error
            ? chalk.red(JSON.stringify(error))
            : ''
      )
    }

    this.client.on('query', query => {
      startTimes[query.__knexQueryUid] = process.hrtime()
    })

    this.client.on('query-response', (response, query) => {
      end(query, { response })
    })

    this.client.on('query-error', (error, query) => {
      end(query, { error })
    })
  }
})

export default function KnexPlus(config) {
  if (config.normalizeIdentifiers) {
    config = {
      ...config,
      normalizeIdentifier: name => underscore(name),
      denormalizeIdentifier: name => camelize(name)
    }
  }
  // NOTE: `normalizeIdentifier` is not the same as the plural
  // `normalizeIdentifiers` setting above, which sets up the most common
  // `normalizeIdentifier` and `denormalizeIdentifier` pair for us.
  const { normalizeIdentifier } = config
  if (normalizeIdentifier) {
    // This is Knex' standard hook into processing identifiers.
    // We add the call to our own normalizeIdentifier() to it:
    // TODO: wrapIdentifier will only work in Knex 0.14.0 onwards.
    // Until then, use the _wrapString() hack below instead.
    config.wrapIdentifier = function (value, wrapIdentifier) {
      return wrapIdentifier(normalizeIdentifier(value))
    }
  }
  const knex = Object.defineProperties(Knex(config), properties)
  const { wrapIdentifier } = config
  if (wrapIdentifier) {
    // HACK: See above about replacing this with standardized wrapIdentifier()
    const { prototype } = knex.client.formatter().constructor
    const { _wrapString } = prototype
    if (_wrapString) {
      prototype._wrapString = function (value) {
        return wrapIdentifier(value, _wrapString.bind(this))
      }
    }
  }
  return knex
}
