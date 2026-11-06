import { defineEntity, p } from '@mikro-orm/core'
import { assignRecord, createRecord } from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

// Rows of one shelf that link each other by `#id` and `#ref`, where `tag` of an
// item is required, and `favorite` of a tag points back at an item.

const ShelfSchema = defineEntity({
  name: 'RefShelf',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    tags: () => p.oneToMany(Tag).mappedBy('shelf').orphanRemoval(),
    items: () => p.oneToMany(Item).mappedBy('shelf').orphanRemoval()
  }
})
class Shelf extends ShelfSchema.class {}
ShelfSchema.setClass(Shelf)

const TagSchema = defineEntity({
  name: 'RefTag',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    shelf: () => p.manyToOne(Shelf),
    favorite: () => p.manyToOne(Item).nullable()
  }
})
class Tag extends TagSchema.class {}
TagSchema.setClass(Tag)

const ItemSchema = defineEntity({
  name: 'RefItem',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    shelf: () => p.manyToOne(Shelf),
    tag: () => p.manyToOne(Tag)
  }
})
class Item extends ItemSchema.class {}
ItemSchema.setClass(Item)

const { orm, sql, drop } = await createTestDatabase([
  ShelfSchema,
  TagSchema,
  ItemSchema
])

afterAll(drop)

beforeEach(() =>
  sql('truncate ref_shelf, ref_tag, ref_item restart identity cascade')
)

const links = async () =>
  (
    await sql(
      'select i.name as item, t.name as tag from ref_item i ' +
      'join ref_tag t on t.id = i.tag_id order by i.name'
    )
  )
    .map((row: Record<string, string>) => `${row.item}:${row.tag}`)
    .join(' ')

const create = async (body: unknown) => {
  const em = orm.em.fork()
  await createRecord(em, Shelf, body)
  await em.flush()
}

const assign = async (body: unknown) => {
  const em = orm.em.fork()
  const shelf = await em.findOneOrFail(Shelf, 1)
  await assignRecord(em, shelf, body)
  await em.flush()
}

const seed = () =>
  create({
    name: 'S',
    tags: [
      { 'name': 'T1', '#id': 't1' },
      { 'name': 'T2', '#id': 't2' }
    ],
    items: [
      { name: 'I1', tag: { '#ref': 't1' } },
      { name: 'I2', tag: { '#ref': 't2' } }
    ]
  })

describe('`#id` and `#ref`', () => {
  it('sets required relations to new rows', async () => {
    await seed()
    expect(await links()).toBe('I1:T1 I2:T2')
  })

  it('takes rows in any order, and refs before their rows', async () => {
    await create({
      name: 'S',
      items: [{ name: 'I1', tag: { '#ref': 't' } }],
      tags: [{ 'name': 'T', '#id': 't' }]
    })
    expect(await links()).toBe('I1:T')
  })

  it('writes cycles between new rows', async () => {
    await create({
      name: 'S',
      tags: [{ 'name': 'T', '#id': 't', 'favorite': { '#ref': 'i' } }],
      items: [{ 'name': 'I', '#id': 'i', 'tag': { '#ref': 't' } }]
    })
    expect(await links()).toBe('I:T')
    const [tag] = await sql('select * from ref_tag')
    expect(tag.favorite_id).toBe(1)
  })

  it('links the right rows when a patch reorders them', async () => {
    await seed()
    await assign({
      tags: [{ id: 2 }, { 'name': 'T3', '#id': 't3' }, { id: 1 }],
      items: [
        { id: 2, tag: { '#ref': 't3' } },
        { id: 1 }
      ]
    })
    expect(await links()).toBe('I1:T1 I2:T3')
  })

  it('links the right rows with new rows between existing ones', async () => {
    await seed()
    await assign({
      tags: [{ id: 1 }, { 'name': 'T3', '#id': 't3' }, { id: 2 }],
      items: [
        { name: 'I0', tag: { '#ref': 't3' } },
        { id: 2 },
        { name: 'I3', tag: { id: 1 } },
        { id: 1, tag: { '#ref': 't3' } }
      ]
    })
    expect(await links()).toBe('I0:T3 I1:T3 I2:T2 I3:T1')
  })
})
