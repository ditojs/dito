// Methods to be added to the Dito knex instance (app.knex):

const properties = Object.getOwnPropertyDescriptors({
  getDialect() {
    return this.client && this.client.dialect || null
  },

  isPostgres() {
    return this.getDialect() === 'postgresql'
  },

  isMySql() {
    return this.getDialect() === 'mysql'
  },

  isSqlite() {
    return this.getDialect() === 'sqlite3'
  },

  isMsSql() {
    return this.getDialect() === 'mssql'
  }
})

export default function KnexMixin(knex) {
  return Object.defineProperties(knex, properties)
}
