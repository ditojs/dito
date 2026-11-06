import { MikroORM } from '@mikro-orm/postgresql'
import { defineEntity, p, type EntityProperty } from '@mikro-orm/core'
import { getPrimaryKey, toPrimaryKey } from './metadata.ts'

const entity = (name: string, properties: Record<string, any>) =>
  defineEntity({ name, properties })

const Int = entity('Int', { id: p.integer().primary() })
const Small = entity('Small', { id: p.smallint().primary() })
const Big = entity('Big', { id: p.bigint().primary() })
const BigNumber = entity('BigNumber', { id: p.bigint('number').primary() })
const BigString = entity('BigString', { id: p.bigint('string').primary() })
const Uuid = entity('Uuid', { id: p.uuid().primary() })
const Code = entity('Code', { code: p.string().primary() })
const Pair = entity('Pair', {
  a: p.integer().primary(),
  b: p.integer().primary()
})

const orm = await MikroORM.init({
  dbName: 'dito_mikro_metadata',
  entities: [Int, Small, Big, BigNumber, BigString, Uuid, Code, Pair]
})

// Discovering the metadata doesn't connect to the database.
const key = (name: string) =>
  getPrimaryKey(orm.getMetadata().getByClassName(name)) as EntityProperty

describe('getPrimaryKey()', () => {
  it('returns the property of the primary key', () => {
    expect(key('Code').name).toBe('code')
  })

  it('throws for composite primary keys', () => {
    expect(() => key('Pair')).toThrow(
      `Unsupported composite primary key of 'Pair': Dito only supports ` +
      'entities with a single primary key'
    )
  })
})

describe('toPrimaryKey()', () => {
  it('converts integer ids from strings and numbers', () => {
    expect(toPrimaryKey(key('Int'), '42')).toBe(42)
    expect(toPrimaryKey(key('Int'), 42)).toBe(42)
    expect(toPrimaryKey(key('Int'), '-1')).toBe(-1)
  })

  it('refuses ids that are no integers or out of range', () => {
    for (const id of ['abc', '1.5', '1e3', '', ' 1', 1.5, NaN, null, {}]) {
      expect(toPrimaryKey(key('Int'), id)).toBeUndefined()
    }
    expect(toPrimaryKey(key('Int'), '2147483648')).toBeUndefined()
    expect(toPrimaryKey(key('Int'), 2147483647)).toBe(2147483647)
    expect(toPrimaryKey(key('Small'), '32768')).toBeUndefined()
    expect(toPrimaryKey(key('Small'), '-32768')).toBe(-32768)
  })

  it('converts bigint ids for the runtime type of the column', () => {
    expect(toPrimaryKey(key('Big'), '9223372036854775807')).toBe(
      9223372036854775807n
    )
    expect(toPrimaryKey(key('Big'), '9223372036854775808')).toBeUndefined()
    expect(toPrimaryKey(key('BigNumber'), '12')).toBe(12)
    expect(toPrimaryKey(key('BigString'), 12)).toBe('12')
  })

  it('checks uuids', () => {
    const uuid = '0b5cbb8b-6c0c-4c2e-9a87-8d7c2fa1a0e1'
    expect(toPrimaryKey(key('Uuid'), uuid)).toBe(uuid)
    // Postgres returns them in lower case, which the relation check compares.
    expect(toPrimaryKey(key('Uuid'), uuid.toUpperCase())).toBe(uuid)
    expect(toPrimaryKey(key('Uuid'), 'abc')).toBeUndefined()
    expect(toPrimaryKey(key('Uuid'), 1)).toBeUndefined()
  })

  it('takes any string for string keys', () => {
    expect(toPrimaryKey(key('Code'), 'abc')).toBe('abc')
    expect(toPrimaryKey(key('Code'), '')).toBeUndefined()
    expect(toPrimaryKey(key('Code'), 1)).toBeUndefined()
  })
})
