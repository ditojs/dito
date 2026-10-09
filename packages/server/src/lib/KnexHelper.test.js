import { KnexHelper } from './KnexHelper.js'

class Catalog {
  static knex() {
    return this.knexInstance
  }
}

KnexHelper.mixin(Catalog)

function createCatalog(dialect) {
  return class extends Catalog {
    static knexInstance = dialect ? { client: { dialect } } : null
  }
}

describe('KnexHelper', () => {
  it.each([
    ['postgresql', 'isPostgreSQL'],
    ['mysql', 'isMySQL'],
    ['sqlite3', 'isSQLite'],
    ['mssql', 'isMsSQL']
  ])('detects the %s dialect with %s()', (dialect, method) => {
    const catalogClass = createCatalog(dialect)
    expect(catalogClass.getDialect()).toBe(dialect)
    for (const otherMethod of [
      'isPostgreSQL',
      'isMySQL',
      'isSQLite',
      'isMsSQL'
    ]) {
      expect(catalogClass[otherMethod]()).toBe(otherMethod === method)
    }
  })

  it('returns null as dialect without a knex instance', () => {
    const catalogClass = createCatalog(null)
    expect(catalogClass.getDialect()).toBe(null)
    expect(catalogClass.isPostgreSQL()).toBe(false)
  })

  it('returns null as dialect for clients without a dialect', () => {
    const catalogClass = class extends Catalog {
      static knexInstance = { client: {} }
    }
    expect(catalogClass.getDialect()).toBe(null)
  })

  it('does not copy the constructor', () => {
    expect(Object.hasOwn(Catalog, 'getDialect')).toBe(true)
    expect(Catalog.constructor).toBe(Function)
  })
})
