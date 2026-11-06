import { MikroORM } from '@mikro-orm/postgresql'
import { defineEntity, p } from '@mikro-orm/core'
import { createMikroAdapter, defineMikroConfig } from './index.ts'

const Item = defineEntity({
  name: 'Item',
  properties: { id: p.integer().primary() }
})

describe('the transaction helpers', () => {
  it('take the MikroORM of a driver with typed entities', () => {
    const orm = new MikroORM(
      defineMikroConfig({
        dbName: 'dito_mikro_types',
        entities: [Item] as const
      })
    )
    expect(createMikroAdapter(orm)).toMatchObject({
      connect: expect.any(Function),
      transaction: expect.any(Function),
      toHttpError: expect.any(Function)
    })
  })

  it('reads outside of a transaction without the `em` of a request', () => {
    const fork = { getKysely: () => 'fork' }
    const adapter = createMikroAdapter(
      new MikroORM(
        defineMikroConfig({ dbName: 'dito_mikro_types', entities: [Item] })
      )
    )
    const { getKysely } = adapter
    const c = { var: { em: fork } } as any
    expect(getKysely(c)).toBe('fork')
    expect(getKysely({ var: {} } as any)).not.toBe('fork')
  })
})
