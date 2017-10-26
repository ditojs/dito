import Knex from 'knex'

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
  }
})

export default function KnexPlus(config) {
  return Object.defineProperties(Knex(config), properties)
}
