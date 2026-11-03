import { removeRecord } from '../src/index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Customer, Folder, customerEntities } from './customer-entities.ts'

const { orm, sql, drop } = await createTestDatabase(customerEntities)

afterAll(drop)

// Customer 1 has an order and customer 2 has none. Each has a visit, an
// address with a line and a note. Folder 1 holds folder 2, which holds
// folder 3.
beforeEach(async () => {
  await sql(
    'truncate customer, customer_order, visit, address, address_line, ' +
    'note, folder restart identity cascade'
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

describe('removeRecord()', () => {
  it('deletes owned rows and leaves the others to the database', async () => {
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, {
      populate: ['orders', 'visits']
    })
    await removeRecord(em, customer)
    expect(await state()).toEqual({
      customers: [1],
      orders: [1],
      visits: [1, null],
      addresses: [1],
      lines: [1],
      notes: [1]
    })
    // The record stays loaded in `em`, which has nothing to flush.
    expect(em.getUnitOfWork().getById(Customer, 2)).toBe(customer)
    await em.flush()
  })

  it('writes the pending changes of the entity manager first', async () => {
    // The order moves to customer 2, so customer 1 has none left.
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1, {
      populate: ['orders']
    })
    const [order] = customer.orders.getItems()
    order!.customer = em.getReference(Customer, 2)
    await removeRecord(em, customer)
    expect(await state()).toMatchObject({ customers: [2], orders: [2] })
  })

  it('deletes a record that filters hide', async () => {
    await sql(`update customer set name = 'Hidden' where id = 2`)
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 2, { filters: false })
    await removeRecord(em, customer)
    expect(await ids('customer')).toEqual([1])
  })

  it('lets a foreign key refuse the delete of a loaded record', async () => {
    const em = orm.em.fork()
    const customer = await em.findOneOrFail(Customer, 1, {
      populate: ['orders', 'visits', 'addresses.lines']
    })
    await expect(removeRecord(em, customer)).rejects.toThrow(/foreign key/)
    expect(await state()).toEqual(before)
  })

  it('runs in the transaction of the entity manager', async () => {
    await expect(
      orm.em.fork().transactional(async em => {
        await removeRecord(em, await em.findOneOrFail(Customer, 2))
        expect(await ids('customer')).toEqual([1, 2])
        throw new Error('Rolled back')
      })
    ).rejects.toThrow('Rolled back')
    expect(await state()).toEqual(before)
  })

  it('leaves a tree of one entity to its delete rule', async () => {
    const em = orm.em.fork()
    await removeRecord(em, await em.findOneOrFail(Folder, 1))
    expect(await ids('folder')).toEqual([])
  })
})
