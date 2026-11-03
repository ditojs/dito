import type { StandardSchemaV1 } from '@standard-schema/spec'
import { StringType, defineEntity, p } from '@mikro-orm/core'
import { assignRecord, createRecord } from '../src/index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Family, entities } from './entities.ts'
import {
  ShopItem,
  ShopOrder,
  loadOrder,
  orderEntities
} from './order-entities.ts'

// A schema that throws for `throw`, and rejects for `reject` when async.
const throwing = (isAsync: boolean): StandardSchemaV1 => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: value => {
      if (value === 'throw') throw new Error('Internal')
      return isAsync && value === 'reject'
        ? Promise.reject(new Error('Internal'))
        : { value }
    }
  }
})

class SyncType extends StringType {
  get schema() {
    return throwing(false)
  }
}

class AsyncType extends StringType {
  get schema() {
    return throwing(true)
  }
}

// The column types whose values the write checks before Postgres does.
const SampleSchema = defineEntity({
  name: 'Sample',
  tableName: 'sample',
  properties: {
    id: p.integer().primary(),
    text: p.string().nullable(),
    count: p.integer().nullable(),
    ratio: p.double().nullable(),
    flag: p.boolean().nullable(),
    at: p.datetime().nullable(),
    state: p.enum(['draft', 'live']).nullable(),
    sync: p.string().type(new SyncType()).nullable(),
    async: p.string().type(new AsyncType()).nullable(),
    data: p.blob().nullable()
  }
})
class Sample extends SampleSchema.class {}
SampleSchema.setClass(Sample)

const { orm, drop } = await createTestDatabase([
  ...entities,
  ...orderEntities,
  Sample
])

afterAll(drop)

const reset = () =>
  orm.em
    .getConnection()
    .execute(
      'truncate shop_order, license, shop_item, license_shop_item, ' +
      'legacy_license_shop_item, family, font_set, font_cut ' +
      'restart identity cascade'
    )

beforeEach(reset)

// The field errors of a failed write, by path.
const issues = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('The write passed')
    },
    error =>
      Object.fromEntries(
        Object.entries(
          error.errors as Record<string, { message: string }[]>
        ).map(([path, [first]]) => [path, first!.message])
      )
  )

// The rows of a pivot table as `L<license>-I<item>`, with the price after
// `=`, and with `<id>:` before them where the table has ids.
const pivots = async (table = 'license_shop_item') => {
  const rows = await orm.em
    .fork()
    .getConnection()
    .execute(`select * from ${table} order by license_id, shop_item_id`)
  return rows.map(
    (row: Record<string, unknown>) => (
      (row.id == null ? '' : `${row.id}:`) +
      `L${row.license_id}-I${row.shop_item_id}` +
      (row.final_price == null ? '' : `=${Number(row.final_price)}`)
    )
  )
}

// An order with licenses L1, L2 and shop items I1, I2, where L1 links I1 and
// I2, and L2 links I2, with prices, through both pivot tables.
async function createOrder() {
  const em = orm.em.fork()
  await createRecord(em, ShopOrder, {
    name: 'Order',
    licenses: [
      {
        name: 'L1',
        shopItems: [{ '#ref': 'i1' }, { '#ref': 'i2' }],
        legacyShopItems: [{ '#ref': 'i1' }, { '#ref': 'i2' }]
      },
      {
        name: 'L2',
        shopItems: [{ '#ref': 'i2' }],
        legacyShopItems: [{ '#ref': 'i2' }]
      }
    ],
    shopItems: [
      { '#id': 'i1', 'name': 'I1' },
      { '#id': 'i2', 'name': 'I2' }
    ]
  })
  await em.flush()
  for (const table of ['license_shop_item', 'legacy_license_shop_item']) {
    await em
      .getConnection()
      .execute(
        `update ${table} set final_price = license_id * 10 + shop_item_id`
      )
  }
}

describe('the checks of a body', () => {
  it('checks the types of scalars and the items of enums', async () => {
    const em = orm.em.fork()
    expect(
      await issues(
        createRecord(em, Sample, {
          text: 1,
          count: 1.5,
          ratio: '1',
          flag: 'false',
          at: 'soon',
          state: 'gone'
        })
      )
    ).toEqual({
      text: 'Invalid input: expected string, received number',
      count: 'Invalid input: expected int, received number',
      ratio: 'Invalid input: expected number, received string',
      flag: 'Invalid input: expected boolean, received string',
      at: 'Invalid input: expected date, received string',
      state: 'Invalid option: expected one of "draft"|"live"'
    })
    const sample = await createRecord(em, Sample, {
      text: 'a',
      count: 2,
      ratio: 0.5,
      flag: false,
      at: '2020-01-01T00:00:00Z',
      state: 'live'
    })
    await em.flush()
    expect(sample.at).toEqual(new Date('2020-01-01T00:00:00Z'))
  })

  it('names integers in the errors of integer columns', async () => {
    const em = orm.em.fork()
    expect(await issues(createRecord(em, Sample, { count: '1' }))).toEqual({
      count: 'Invalid input: expected int, received string'
    })
  })

  it('reads plain dates as local midnight', async () => {
    const em = orm.em.fork()
    const sample = await createRecord(em, Sample, { at: '2026-05-14' })
    expect(sample.at).toEqual(new Date(2026, 4, 14))
  })

  it('drops blobs', async () => {
    const em = orm.em.fork()
    const sample = await createRecord(em, Sample, { data: 'bytes' })
    expect(sample.data).toBeUndefined()
  })

  it('answers schemas that throw with an issue at their path', async () => {
    const em = orm.em.fork()
    expect(
      await issues(createRecord(em, Sample, { sync: 'throw', async: 'reject' }))
    ).toEqual({ sync: 'Invalid input', async: 'Invalid input' })
  })

  it('checks the shapes of rows, relations and ids', async () => {
    const em = orm.em.fork()
    expect(await issues(createRecord(em, Family, []))).toEqual({
      '': 'Invalid input: expected object, received array'
    })
    expect(
      await issues(
        createRecord(em, Family, {
          name: null,
          sets: {},
          designers: 1,
          info: 'text'
        })
      )
    ).toEqual({
      name: 'Invalid input: expected string, received null',
      sets: 'Invalid input: expected array, received object',
      designers: 'Invalid input: expected array, received number',
      info: 'Invalid input: expected object, received string'
    })
    expect(
      await issues(
        createRecord(em, Family, {
          name: 'Family',
          designers: ['a', { id: 'b' }],
          sets: [{ name: 'Set', defaultCut: { id: 'a' } }]
        })
      )
    ).toEqual({
      'designers/0': 'Invalid input: expected id, received string',
      'designers/1/id': 'Invalid input: expected id, received string',
      'sets/0/defaultCut/id': 'Invalid input: expected id, received string'
    })
  })

  it('refuses ids of owned rows that are no ids', async () => {
    const em = orm.em.fork()
    const family = await createRecord(em, Family, { name: 'Family' })
    await em.flush()
    expect(
      await issues(assignRecord(em, family, { sets: [{ id: 'x', name: 'S' }] }))
    ).toEqual({
      'sets/0/id': 'Invalid input: expected id, received string'
    })
  })
})

describe('createRecord()', () => {
  it('links new rows through a many-to-many relation in one flush', async () => {
    await createOrder()
    expect(await pivots()).toEqual(['L1-I1=11', 'L1-I2=12', 'L2-I2=22'])
    expect(await pivots('legacy_license_shop_item')).toEqual([
      '2:L1-I1=11',
      '3:L1-I2=12',
      '1:L2-I2=22'
    ])
  })

  it('links a ref to a row that the body sends later', async () => {
    const em = orm.em.fork()
    const order = await createRecord(em, ShopOrder, {
      name: 'Order',
      shopItems: [{ name: 'I1', bundle: { '#ref': 'l1' } }],
      licenses: [{ '#id': 'l1', 'name': 'L1' }]
    })
    const [license] = order.licenses.getItems()
    expect(order.shopItems.getItems()[0]!.bundle).toBe(license)
    await em.flush()
    expect(license!.id).toBe(1)
  })

  it('takes no flush and leaves the record to the caller', async () => {
    const em = orm.em.fork()
    const family = await createRecord(em, Family, { name: 'Family' })
    expect(family).toBeInstanceOf(Family)
    expect(family.id).toBeUndefined()
    await em.flush()
    expect(family.id).toBe(1)
  })

  it('answers the checks of the body and of `#id` and `#ref`', async () => {
    const em = orm.em.fork()
    expect(await issues(createRecord(em, Family, {}))).toEqual({
      name: 'Invalid input: expected string, received undefined'
    })
    expect(
      await issues(
        createRecord(em, ShopOrder, {
          name: 'Order',
          licenses: [{ name: 'L1', shopItems: [{ id: 5 }] }]
        })
      )
    ).toEqual({
      'licenses/0/shopItems/0': 'names no ShopItem'
    })
    expect(
      await issues(
        createRecord(em, ShopOrder, {
          name: 'Order',
          licenses: [{ name: 'L1', shopItems: [{ '#ref': 'x' }] }],
          shopItems: [
            { '#id': 'i', 'name': 'I1', 'bundle': { '#ref': 'y' } },
            { '#id': 'i', 'name': 'I2' }
          ]
        })
      )
    ).toEqual({
      'shopItems/1/#id': `is the key of another new row 'i'`,
      'licenses/0/shopItems/0': `references the unknown new row 'x'`,
      'shopItems/0/bundle': `references the unknown new row 'y'`
    })
    // Keys that are no strings are issues too.
    expect(
      await issues(
        createRecord(em, ShopOrder, {
          name: 'Order',
          licenses: [{ '#id': 1, 'name': 'L1' }],
          shopItems: [{ name: 'I1', bundle: { '#ref': 2 } }]
        })
      )
    ).toEqual({
      'licenses/0/#id': 'Invalid input: expected string, received number',
      'shopItems/0/bundle/#ref':
        'Invalid input: expected string, received number'
    })
    // A JSON value keeps its markers.
    expect(
      await issues(
        createRecord(em, Family, {
          name: 'Family',
          sets: [
            {
              name: 'Set',
              defaultCut: { '#ref': 'f' },
              cuts: [{ name: 'C', features: [{ '#id': 'f', 'tag': 'kern' }] }]
            }
          ]
        })
      )
    ).toEqual({
      'sets/0/defaultCut': `references the unknown new row 'f'`
    })
    expect(
      await issues(createRecord(em, ShopOrder, { '#id': 'o', 'name': 'Order' }))
    ).toEqual({ '#id': 'is only allowed in nested rows' })
    expect(
      await issues(
        createRecord(em, ShopOrder, {
          name: 'Order',
          licenses: [
            { '#id': 'f', 'name': 'L1', 'shopItems': [{ '#ref': 'f' }] }
          ]
        })
      )
    ).toEqual({
      'licenses/0/shopItems/0': 'references a new row that is no ShopItem'
    })
  })
})

describe('assignRecord()', () => {
  it('refuses `#id` in rows with an id', async () => {
    await createOrder()
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses', 'shopItems'])
    expect(
      await issues(
        assignRecord(em, order, {
          '#id': 'o',
          'licenses': [{ 'id': 1, '#id': 'l1' }]
        })
      )
    ).toEqual({
      '#id': 'is not allowed in a row with an id',
      'licenses/0/#id': 'is not allowed in a row with an id'
    })
  })

  it('rewrites the kept pairs of a pivot entity with an id of its own', async () => {
    // A pivot entity with a primary key of its own makes MikroORM 7.2.5 order
    // the relation by that key (`fixedOrder`). When the owning side gains a
    // link, MikroORM deletes the rows of the kept pairs and inserts them
    // again, without their other columns.
    await createOrder()
    const em = orm.em.fork()
    const order = await loadOrder(em, ['licenses', 'shopItems'])
    await assignRecord(em, order, {
      licenses: [
        { id: 1, legacyShopItems: [1] },
        { id: 2, legacyShopItems: [2, { '#ref': 'i3' }] }
      ],
      shopItems: [{ id: 1 }, { id: 2 }, { '#id': 'i3', 'name': 'I3' }]
    })
    await em.flush()
    // L2-I2 had the row 1 with a price.
    expect(await pivots('legacy_license_shop_item')).toEqual([
      '2:L1-I1=11',
      '4:L2-I2',
      '5:L2-I3'
    ])
  })
})
