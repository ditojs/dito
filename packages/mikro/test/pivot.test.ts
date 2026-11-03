import { assignRecord } from '../src/index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import {
  License,
  LicenseShopItem,
  ShopItem,
  loadOrder,
  orderEntities
} from './order-entities.ts'

// How MikroORM 7.2.5 and `assignRecord()` write a many-to-many relation whose
// pivot entity has a composite primary key of its two foreign keys and
// columns of its own, the form that MikroORM's documentation gives for a
// custom pivot entity, see `order-entities.ts`.

const { orm, sql, drop } = await createTestDatabase(orderEntities)

afterAll(drop)

// L1 links I1 and I2, L2 links I2, each with a price.
beforeEach(async () => {
  await sql(
    'truncate shop_order, license, shop_item, license_shop_item ' +
    'restart identity cascade'
  )
  await sql(`insert into shop_order (name) values ('Order')`)
  await sql(
    `insert into license (name, shop_order_id) values ('L1', 1), ('L2', 1)`
  )
  await sql(
    `insert into shop_item (name, shop_order_id) values ('I1', 1), ('I2', 1)`
  )
  await sql(
    'insert into license_shop_item (license_id, shop_item_id, final_price) ' +
    'values (1, 1, 10), (1, 2, 20), (2, 2, 30)'
  )
})

// The pivot rows as `L<license>-I<item>`, with the price after `=`.
const pivots = async () =>
  (await sql('select * from license_shop_item order by 1, 2'))
    .map(
      (row: Record<string, unknown>) => (
        `L${row.license_id}-I${row.shop_item_id}` +
        (row.final_price == null ? '' : `=${row.final_price}`)
      )
    )
    .join(' ')

// Links L2 to I1 from one side, through `add()`, `em.assign()` with the ids
// of all of the side's links, or `set()`. The collections of the two sides
// are loaded or not.
it('keeps the pivot rows of kept pairs where the written side is loaded', async () => {
  const results: Record<string, string> = {}
  for (const side of ['owner', 'inverse'] as const) {
    for (const write of ['add', 'assign', 'set'] as const) {
      for (const [owner, inverse] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true]
      ] as const) {
        const em = orm.em.fork()
        const license = await em.findOneOrFail(License, 2, {
          populate: (owner ? ['shopItems'] : []) as never[]
        })
        const shopItem = await em.findOneOrFail(ShopItem, 1, {
          populate: (inverse ? ['licenses'] : []) as never[]
        })
        if (side === 'owner') {
          if (write === 'add') license.shopItems.add(shopItem)
          else if (write === 'assign') {
            em.assign(license, { shopItems: [2, 1] } as never)
          } else {
            license.shopItems.set([em.getReference(ShopItem, 2), shopItem])
          }
        } else if (write === 'add') {
          shopItem.licenses.add(license)
        } else if (write === 'assign') {
          em.assign(shopItem, { licenses: [1, 2] } as never)
        } else {
          shopItem.licenses.set([em.getReference(License, 1), license])
        }
        await em.flush()
        const name = (
          `${side} ${write}, owner ${owner ? 'loaded' : 'not loaded'}, ` +
          `inverse ${inverse ? 'loaded' : 'not loaded'}`
        )
        results[name] = await pivots()
        await sql('delete from license_shop_item')
        await sql(
          'insert into license_shop_item (license_id, shop_item_id, final_price) ' +
          'values (1, 1, 10), (1, 2, 20), (2, 2, 30)'
        )
      }
    }
  }
  const kept = 'L1-I1=10 L1-I2=20 L2-I1 L2-I2=30'
  // An assign or `set()` on a collection that isn't loaded writes all rows of
  // its side again, without their prices.
  const ownerRewritten = 'L1-I1=10 L1-I2=20 L2-I1 L2-I2'
  const inverseRewritten = 'L1-I1 L1-I2=20 L2-I1 L2-I2=30'
  const expected: Record<string, string> = {}
  for (const name of Object.keys(results)) {
    const [side, write] = name.split(/[ ,]/)
    const isLoaded = name.includes(
      `${side === 'owner' ? 'owner' : 'inverse'} loaded`
    )
    expected[name] =
      write === 'add' || isLoaded
        ? kept
        : side === 'owner'
          ? ownerRewritten
          : inverseRewritten
  }
  expect(results).toEqual(expected)
})

describe('assignRecord()', () => {
  const body = {
    licenses: [
      { id: 1, shopItems: [{ id: 1 }] },
      { id: 2, shopItems: [{ id: 2 }, { id: 1 }, { '#ref': 'i3' }] },
      { name: 'L3', shopItems: [{ '#ref': 'i3' }] }
    ],
    shopItems: [{ id: 1 }, { id: 2 }, { '#id': 'i3', 'name': 'I3' }]
  }

  // Counts the queries of `fn` that load the shop items of licenses through
  // the pivot table.
  const countLoads = async (fn: () => Promise<unknown>) => {
    const spy = vi.spyOn(orm.em.getConnection(), 'executeQuery')
    try {
      await fn()
      return spy.mock.calls.filter(([query]) =>
        /from "license_shop_item" .* inner join "shop_item"/.test(
          String(query)
        )
      ).length
    } finally {
      spy.mockRestore()
    }
  }

  it('keeps, drops and adds links from the owning side', async () => {
    // The record comes without its collections, and `assignRecord()` loads
    // the ones that the body writes, once for all licenses.
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses', 'shopItems'])
    const loads = await countLoads(() => assignRecord(em, order, body))
    expect(loads).toBe(1)
    expect(order.shopItems.getItems()[0]!.licenses.isInitialized()).toBe(
      false
    )
    await em.flush()
    expect(await pivots()).toBe('L1-I1=10 L2-I1 L2-I2=30 L2-I3 L3-I3')
  })

  it('leaves loaded collections as they are', async () => {
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses.shopItems', 'shopItems'])
    expect(await countLoads(() => assignRecord(em, order, body))).toBe(0)
    await em.flush()
    expect(await pivots()).toBe('L1-I1=10 L2-I1 L2-I2=30 L2-I3 L3-I3')
  })

  it('keeps, drops and adds links from the inverse side', async () => {
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses', 'shopItems'])
    await assignRecord(em, order, {
      shopItems: [
        { id: 1, licenses: [{ id: 1 }, { id: 2 }] },
        { id: 2, licenses: [1] },
        { 'name': 'I3', '#id': 'i3', 'licenses': [{ '#ref': 'l3' }] }
      ],
      licenses: [{ id: 1 }, { id: 2 }, { '#id': 'l3', 'name': 'L3' }]
    })
    await em.flush()
    expect(await pivots()).toBe('L1-I1=10 L1-I2=20 L2-I1 L3-I3')
  })

  it('checks the ids of the inverse side', async () => {
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses', 'shopItems'])
    await expect(
      assignRecord(em, order, { shopItems: [{ id: 1, licenses: [9] }] })
    ).rejects.toMatchObject({
      errors: { 'shopItems/0/licenses/0': [{ keyword: 'invalid_value' }] }
    })
  })

  it('updates the loaded collections of both sides', async () => {
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses', 'shopItems.licenses'])
    await assignRecord(em, order, body)
    await em.flush()
    const names = (items: { name: string }[]) => items.map(item => item.name)
    const [l1, l2, l3] = order.licenses.getItems()
    const [i1, i2, i3] = order.shopItems.getItems()
    expect(names(l2!.shopItems.getItems())).toEqual(['I2', 'I1', 'I3'])
    expect(names(l3!.shopItems.getItems())).toEqual(['I3'])
    expect(names(i1!.licenses.getItems())).toEqual(['L1', 'L2'])
    expect(names(i2!.licenses.getItems())).toEqual(['L2'])
    expect(names(i3!.licenses.getItems())).toEqual(['L2', 'L3'])
    expect(names(l1!.shopItems.getItems())).toEqual(['I1'])
  })

  it('sets the prices of the links in a second flush', async () => {
    await orm.em.fork().transactional(async em => {
      const order = await loadOrder(em, ['licenses', 'shopItems'])
      await assignRecord(em, order, body)
      await em.flush()
      // The pivot rows weren't loaded before, so the query reads them all.
      const links = await em.find(LicenseShopItem, {
        license: { shopOrder: order.id }
      })
      for (const link of links) {
        link.finalPrice = link.license.id * 100 + link.shopItem.id
      }
      await em.flush()
    })
    expect(await pivots()).toBe(
      'L1-I1=101 L2-I1=201 L2-I2=202 L2-I3=203 L3-I3=303'
    )
  })

  it('inserts a new pair twice where the handler creates its pivot entity', async () => {
    // A handler that creates the pivot entity of a new pair before the flush,
    // next to the relation that links the pair, gets two inserts of the same
    // row, so prices wait for a second flush.
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses.shopItems', 'shopItems'])
    await assignRecord(em, order, body)
    const [, l2] = order.licenses.getItems()
    const [i1] = order.shopItems.getItems()
    em.create(LicenseShopItem, {
      license: l2,
      shopItem: i1,
      finalPrice: 1
    } as never)
    await expect(em.flush()).rejects.toThrow(/duplicate key/)
  })
})
