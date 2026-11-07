import { Hono } from 'hono'
import { contextStorage } from 'hono/context-storage'
import type { DitoEnv } from '@ditojs/server'
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
      transact: expect.any(Function),
      toHttpError: expect.any(Function)
    })
  })

  it('follows the `em` of the running request with `getKysely()`', async () => {
    const em = { getKysely: () => 'request' } as any
    const { getKysely, getPoolKysely } = createMikroAdapter(
      new MikroORM(
        defineMikroConfig({ dbName: 'dito_mikro_types', entities: [Item] })
      )
    )
    const app = new Hono<DitoEnv>().use(contextStorage()).get('/', c => {
      c.set('em', em)
      expect(getKysely()).toBe('request')
      expect(getPoolKysely()).not.toBe('request')
      return c.body(null)
    })
    expect((await app.request('/')).status).toBe(200)
    expect(getKysely()).not.toBe('request')
  })

  it('forks the entity manager outside of a request', () => {
    const orm = new MikroORM(
      defineMikroConfig({ dbName: 'dito_mikro_types', entities: [Item] })
    )
    const em = createMikroAdapter(orm).getEm()
    expect(em).not.toBe(orm.em)
    expect(em.name).toBe(orm.em.name)
  })
})
