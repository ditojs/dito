import { MikroORM } from '@mikro-orm/postgresql'
import { defineEntity, p } from '@mikro-orm/core'
import { mikroDb, mikroOptions } from '../src/index.ts'

const Item = defineEntity({
  name: 'Item',
  properties: { id: p.integer().primary() }
})

describe('the transaction helpers', () => {
  it('take the MikroORM of a driver with typed entities', () => {
    const orm = new MikroORM(
      mikroOptions({ dbName: 'dito_mikro_types', entities: [Item] as const })
    )
    expect(mikroDb(orm)).toMatchObject({
      connect: expect.any(Function),
      transaction: expect.any(Function),
      toHttpError: expect.any(Function)
    })
  })
})
