import { assignRecord } from '../src/index.ts'
import type { EntityManager } from '@mikro-orm/core'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import {
  Address,
  Customer,
  Folder,
  Order,
  Topic,
  customerEntities
} from './customer-entities.ts'

const { orm, sql, drop } = await createTestDatabase(customerEntities)

afterAll(drop)

// Customer 1 has an order and customer 2 has none. Each has a visit, an
// address with a line and a note. Folder 1 holds folder 2, which holds
// folder 3.
beforeEach(async () => {
  await sql(
    'truncate customer, customer_order, visit, address, address_line, ' +
    'note, folder, task, topic restart identity cascade'
  )
  await sql(`insert into customer (name) values ('A'), ('B')`)
  await sql('insert into customer_order (customer_id) values (1)')
  await sql('insert into visit (customer_id) values (1), (2)')
  await sql(`insert into address (city, customer_id) values ('X', 1), ('Y', 2)`)
  await sql(
    `insert into address_line (text, address_id) values ('l', 1), ('m', 2)`
  )
  await sql('insert into note (customer_id) values (1), (2)')
  await sql('insert into folder (parent_id) values (null), (1), (2)')
  await sql('insert into task (customer_id) values (1)')
  await sql('insert into topic (parent_id) values (null), (1)')
})

const ids = async (table: string, column = 'id') =>
  (await sql(`select ${column} as value from ${table} order by id`)).map(
    (row: Record<string, unknown>) => row.value
  )

// What the database holds of the customers' rows.
const state = async () => ({
  customers: await ids('customer'),
  orders: await ids('customer_order', 'customer_id'),
  visits: await ids('visit', 'customer_id'),
  addresses: await ids('address'),
  lines: await ids('address_line'),
  notes: await ids('note')
})

const before = {
  customers: [1, 2],
  orders: [1],
  visits: [1, 2],
  addresses: [1, 2],
  lines: [1, 2],
  notes: [1, 2]
}

const remove = async (em: EntityManager, record: object) => {
  em.remove(record)
  await em.flush()
}

describe('em.remove()', () => {
  it('deletes owned rows and leaves the others to the database', async () => {
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, {
      populate: ['orders', 'visits']
    })
    await remove(em, customer)
    expect(await state()).toEqual({
      customers: [1],
      orders: [1],
      visits: [1, null],
      addresses: [1],
      lines: [1],
      notes: [1]
    })
  })

  it('writes the pending changes of the entity manager', async () => {
    // The order moves to customer 2, so customer 1 has none left.
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1, {
      populate: ['orders']
    })
    const [order] = customer.orders.getItems()
    order!.customer = em.getReference(Customer, 2)
    await remove(em, customer)
    expect(await state()).toMatchObject({ customers: [2], orders: [2] })
  })

  it('keeps an owned row that moved to another record', async () => {
    await sql('delete from customer_order')
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1)
    const address = await em.findOneOrFail(Address, 1)
    address.customer = em.getReference(Customer, 2)
    await remove(em, customer)
    expect(await ids('address', 'customer_id')).toEqual([2, 2])
  })

  it('deletes a record that filters hide', async () => {
    await sql(`update customer set name = 'Hidden' where id = 2`)
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, { filters: false })
    await remove(em, customer)
    expect(await ids('customer')).toEqual([1])
  })

  it('lets a foreign key refuse the delete of a loaded record', async () => {
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1, {
      populate: ['orders', 'visits', 'addresses.lines']
    })
    await expect(remove(em, customer)).rejects.toThrow(/foreign key/)
    expect(await state()).toEqual(before)
    expect(customer.orders.getItems()[0]!.customer).toBe(customer)
  })

  it('refuses the delete of rows that a cascade removes', async () => {
    await sql('insert into customer_order (address_id) values (2)')
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, {
      populate: ['addresses.orders']
    })
    await expect(remove(em, customer)).rejects.toThrow(/foreign key/)
    expect(await ids('address', 'customer_id')).toEqual([1, 2])
  })

  it('keeps the foreign key of a new row', async () => {
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, {
      populate: ['orders']
    })
    em.create(Order, { customer })
    await expect(remove(em, customer)).rejects.toThrow(/foreign key/)
    expect(await state()).toEqual(before)
  })

  it('leaves owned rows as they were after a refused delete', async () => {
    await sql('insert into task (topic_id) values (2)')
    const em = orm.em.fork()
    const topic = await em.findOneOrFail(Topic, 1, { populate: ['children'] })
    await expect(remove(em, topic)).rejects.toThrow(/foreign key/)
    await em.flush()
    expect(await ids('topic', 'parent_id')).toEqual([null, 1])
  })

  it('writes no `onUpdate` values to the rows it restores', async () => {
    const updatedAt = new Date('2026-01-02T03:04:05Z')
    await sql(
      `update customer_order set updated_at = '${updatedAt.toISOString()}'`
    )
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1, {
      populate: ['orders']
    })
    await expect(remove(em, customer)).rejects.toThrow(/foreign key/)
    await em.flush()
    expect(customer.orders.getItems()[0]!.updatedAt).toEqual(updatedAt)
    const order = await orm.em.fork().findOneOrFail(Order, 1)
    expect(order.updatedAt).toEqual(updatedAt)
  })

  it('refuses the delete of a tree node with children', async () => {
    const em = orm.em.fork()
    const topic = await em.findOneOrFail(Topic, 1)
    await expect(remove(em, topic)).rejects.toThrow(/foreign key/)
    expect(await ids('topic')).toEqual([1, 2])
  })

  it('sets the foreign keys of the rule `set null`', async () => {
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, {
      populate: ['visits']
    })
    await remove(em, customer)
    expect(await ids('visit', 'customer_id')).toEqual([1, null])
  })

  it('leaves loaded rows to the rule `cascade`', async () => {
    const em = orm.em.fork()
    const folder = await em.findOneOrFail(Folder, 2, { populate: ['children'] })
    await remove(em, folder)
    expect(await ids('folder')).toEqual([1])
  })

  it('runs in the transaction of the entity manager', async () => {
    await expect(
      orm.em.fork().transactional(async em => {
        await remove(em, await em.findOneOrFail(Customer, 2))
        expect(await ids('customer')).toEqual([1, 2])
        throw new Error('Rolled back')
      })
    ).rejects.toThrow('Rolled back')
    expect(await state()).toEqual(before)
  })

  it('leaves a tree of one entity to its delete rule', async () => {
    const em = orm.em.fork()
    await remove(em, await em.findOneOrFail(Folder, 1))
    expect(await ids('folder')).toEqual([])
  })
})

describe('assignRecord()', () => {
  it('moves a reference off an owned row that the same write replaces', async () => {
    await sql('delete from address_line')
    await sql(`insert into address (city, customer_id) values ('Z', 1)`)
    await sql('update customer set main_address_id = 1 where id = 1')
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1)
    await assignRecord(em, customer, {
      mainAddress: { id: 3 },
      addresses: [{ id: 3 }, { city: 'New' }]
    })
    await em.flush()
    expect(await ids('address')).toEqual([2, 3, 4])
    expect(await ids('customer', 'main_address_id')).toEqual([3, null])
  })
})
