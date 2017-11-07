export class KnexHelper {
  getDialect() {
    const knex = this.knex()
    const client = knex && knex.client
    return client && client.dialect || null
  }

  isPostgreSQL() {
    return this.getDialect() === 'postgresql'
  }

  isMySQL() {
    return this.getDialect() === 'mysql'
  }

  isSQLite() {
    return this.getDialect() === 'sqlite3'
  }

  isMsSQL() {
    return this.getDialect() === 'mssql'
  }

  static mixin(target) {
    Object.defineProperties(target, properties)
  }
}

const {
  constructor, // Don't extract constructor, but everything else
  ...properties
} = Object.getOwnPropertyDescriptors(KnexHelper.prototype)
