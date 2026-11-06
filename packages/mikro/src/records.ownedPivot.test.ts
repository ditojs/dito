import { createApi, createHono } from '@ditojs/server'
import {
  assignRecord,
  createMikroAdapter,
  createRecord,
  defineModelController
} from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { createClient } from '../../../tests/utils/client.ts'
import { Basket, basketEntities } from './test/basketEntities.ts'

// Pivot rows with columns of their own, written as the owned rows of
// `Basket.lines`, keyed by their product.

const { orm, sql, drop } = await createTestDatabase(basketEntities)

afterAll(drop)

// B1 holds P1 and P2, B2 holds P2.
beforeEach(async () => {
  await sql('truncate basket, product, basket_product restart identity cascade')
  await sql(`insert into product (name) values ('P1'), ('P2'), ('P3')`)
  await sql(`insert into basket (name) values ('B1'), ('B2')`)
  await sql(
    'insert into basket_product (basket_id, product_id, quantity, price) ' +
    'values (1, 1, 1, 10), (1, 2, 2, 20), (2, 2, 3, 30)'
  )
})

// The pivot rows as `B<basket>-P<product>`, with the quantity after `x` and
// the price after `=`.
const pivots = async () =>
  (await sql('select * from basket_product order by 1, 2'))
    .map(
      (row: Record<string, unknown>) =>
        `B${row.basket_id}-P${row.product_id}x${row.quantity}=${row.price}`
    )
    .join(' ')

const assign = async (body: unknown) => {
  const em = orm.em.fork()
  const basket = await em.findOneOrFail(Basket, 1)
  await assignRecord(em, basket, body)
  await em.flush()
}

describe('createRecord()', () => {
  it('creates the pivot rows of a new record', async () => {
    const em = orm.em.fork()
    await createRecord(em, Basket, {
      name: 'B3',
      lines: [
        { product: { id: 3 }, quantity: 4, price: 12 },
        { product: 1, quantity: 5 }
      ]
    })
    await em.flush()
    expect(await pivots()).toBe(
      'B1-P1x1=10 B1-P2x2=20 B2-P2x3=30 B3-P1x5=null B3-P3x4=12'
    )
  })

  it('requires the product and the quantity', async () => {
    await expect(
      createRecord(orm.em.fork(), Basket, { name: 'B3', lines: [{ price: 1 }] })
    ).rejects.toMatchObject({
      errors: {
        'lines/0/quantity': [{ keyword: 'invalid_type' }],
        'lines/0/product': [{ keyword: 'invalid_type' }]
      }
    })
  })
})

describe('assignRecord()', () => {
  it('changes a price', async () => {
    await assign({
      lines: [
        { product: 1, price: 11 },
        { product: 2, quantity: 2, price: 20 }
      ]
    })
    expect(await pivots()).toBe('B1-P1x1=11 B1-P2x2=20 B2-P2x3=30')
  })

  it('removes and adds pairs', async () => {
    const lines = [
      { product: { id: 1 }, price: 11 },
      { product: { id: 3 }, quantity: 3, price: 13 }
    ]
    await assign({ lines })
    expect(await pivots()).toBe('B1-P1x1=11 B1-P3x3=13 B2-P2x3=30')
    // The same body again changes nothing.
    await assign({ lines })
    expect(await pivots()).toBe('B1-P1x1=11 B1-P3x3=13 B2-P2x3=30')
  })

  it('removes all pairs', async () => {
    await assign({ lines: [] })
    expect(await pivots()).toBe('B2-P2x3=30')
  })

  it('requires the quantity of new pairs', async () => {
    await expect(
      assign({ lines: [{ product: 1 }, { product: 3, price: 13 }] })
    ).rejects.toMatchObject({
      errors: { 'lines/1/quantity': [{ keyword: 'invalid_type' }] }
    })
  })

  it('requires the product', async () => {
    await expect(assign({ lines: [{ quantity: 1 }] })).rejects.toMatchObject({
      errors: { 'lines/0/product': [{ keyword: 'invalid_type' }] }
    })
  })

  it('checks that the product exists', async () => {
    await expect(
      assign({ lines: [{ product: { id: 9 }, quantity: 1 }] })
    ).rejects.toMatchObject({
      errors: {
        'lines/0/product': [
          { keyword: 'invalid_value', message: 'names no Product' }
        ]
      }
    })
  })

  it('refuses a new product as the key', async () => {
    // The body has no new product, so the ref is also unknown.
    await expect(
      assign({ lines: [{ product: { '#ref': 'p' }, quantity: 1 }] })
    ).rejects.toMatchObject({
      errors: {
        'lines/0/product': [
          {
            keyword: 'invalid_value',
            message: 'is not allowed to reference a new row'
          },
          {
            keyword: 'invalid_value',
            message: `references the unknown new row 'p'`
          }
        ]
      }
    })
  })

  it('refuses refs to new rows in new pairs', async () => {
    await expect(
      assign({
        coupons: [{ '#id': 'c', 'code': 'C1' }],
        lines: [
          { product: 1, coupon: { '#ref': 'c' } },
          { product: 3, quantity: 1, coupon: { '#ref': 'c' } }
        ]
      })
    ).rejects.toMatchObject({
      errors: {
        'lines/1/coupon': [
          {
            keyword: 'invalid_value',
            message: 'is not allowed to reference a new row'
          }
        ]
      }
    })
  })

  it('refuses the same product twice', async () => {
    await expect(
      assign({
        lines: [
          { product: 2, price: 1 },
          { product: 2, price: 2 }
        ]
      })
    ).rejects.toMatchObject({
      errors: {
        'lines/1/product': [
          { keyword: 'invalid_value', message: 'is the key of another row' }
        ]
      }
    })
  })

  it('refuses the many-to-many relation next to the pivot rows', async () => {
    await expect(
      assign({ products: [1, 2], lines: [{ product: 2, price: 7 }] })
    ).rejects.toMatchObject({
      errors: {
        products: [
          {
            keyword: 'invalid_value',
            message: `writes the same rows as 'lines'`
          }
        ]
      }
    })
    expect(await pivots()).toBe('B1-P1x1=10 B1-P2x2=20 B2-P2x3=30')
  })
})

describe('the controller', () => {
  const api = createHono()
    .route(
      '/api',
      createApi({
        controllers: [
          defineModelController({
            path: 'baskets',
            entity: Basket,
            authorize: true,
            find: { populate: ['lines.product'] },
            actions: { 'get :id': true, 'post': true, 'patch :id': true }
          }),
          defineModelController({
            path: 'prices',
            entity: Basket,
            authorize: true,
            find: { fields: ['name', 'lines.price', 'lines.product'] },
            actions: { 'get :id': true }
          })
        ],
        adapter: createMikroAdapter(orm),
        users: { getUser: async () => null },
        onError: () => {}
      })
    )

  const request = (method: string, path: string, body?: unknown) =>
    createClient(api.fetch).request(method, path, body)

  it('writes and reads the pivot rows', async () => {
    const patch = await request('PATCH', '/api/baskets/1', {
      lines: [
        { product: 2, price: 21 },
        { product: 3, quantity: 1, price: 30 }
      ]
    })
    expect(patch.status).toBe(200)
    expect(patch.data).toEqual({
      id: 1,
      name: 'B1',
      lines: [
        {
          basket: { id: 1 },
          product: { id: 2, name: 'P2' },
          quantity: 2,
          price: 21,
          coupon: null
        },
        {
          basket: { id: 1 },
          product: { id: 3, name: 'P3' },
          quantity: 1,
          price: 30,
          coupon: null
        }
      ]
    })
    const get = await request('GET', '/api/prices/1')
    expect(get.status).toBe(200)
    expect(get.data).toEqual({
      id: 1,
      name: 'B1',
      lines: [
        { basket: { id: 1 }, product: { id: 2 }, price: 21 },
        { basket: { id: 1 }, product: { id: 3 }, price: 30 }
      ]
    })
  })

  it('creates a record with pivot rows', async () => {
    const post = await request('POST', '/api/baskets', {
      name: 'B3',
      lines: [{ product: 1, quantity: 2, price: 5 }]
    })
    expect(post.status).toBe(201)
    expect(post.data).toEqual({
      id: 3,
      name: 'B3',
      lines: [
        {
          basket: { id: 3 },
          product: { id: 1, name: 'P1' },
          quantity: 2,
          price: 5,
          coupon: null
        }
      ]
    })
  })
})
