import { defineEntity, p, type RequiredEntityData } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/postgresql'
import { z } from 'zod'
import {
  assignRecord,
  createMikroAdapter,
  createRecord,
  defineJsonType,
  defineMikroConfig,
  getAssetFields
} from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const specsSchema = z.object({
  pages: z.number().default(100),
  tags: z.array(z.string()).optional()
})

// Each parse raises the number, so a second parse shows.
const editionType = defineJsonType({
  schema: z.object({ number: z.number().transform(number => number + 1) })
})

const BookSchema = defineEntity({
  name: 'Book',
  tableName: 'book',
  properties: {
    id: p.integer().primary(),
    specs: p
      .type(
        defineJsonType({
          schema: specsSchema,
          assets: [
            { dataPath: '**/file', storage: 'public' },
            { dataPath: '*/files', storage: 'private' }
          ]
        })
      )
      .nullable(),
    coverImages: p
      .type(defineJsonType({ assets: [{ dataPath: '', storage: 'public' }] }))
      .nullable(),
    samples: p
      .type(
        defineJsonType({ assets: [{ dataPath: '*/file', storage: 'private' }] })
      )
      .nullable(),
    notes: p.json().nullable(),
    edition: p.type(editionType).nullable(),
    label: p
      .type(
        defineJsonType({ schema: z.string().transform(text => `${text}!`) })
      )
      .nullable(),
    prints: () =>
      p
        .oneToMany(Print)
        .mappedBy(print => print.book)
        .orphanRemoval()
  }
})
class Book extends BookSchema.class {}
BookSchema.setClass(Book)

const PrintSchema = defineEntity({
  name: 'Print',
  tableName: 'print',
  properties: {
    id: p.integer().primary(),
    edition: p.type(editionType).nullable(),
    book: () => p.manyToOne(Book)
  }
})
class Print extends PrintSchema.class {}
PrintSchema.setClass(Print)

const ShelfSchema = defineEntity({
  name: 'BookShelf',
  properties: {
    id: p.integer().primary(),
    photo: p
      .type(defineJsonType({ assets: [{ dataPath: '', storage: 'public' }] }))
      .nullable()
  }
})
class BookShelf extends ShelfSchema.class {}
ShelfSchema.setClass(BookShelf)

const fields = [
  { column: 'specs', dataPath: '**/file', storage: 'public' },
  { column: 'specs', dataPath: '*/files', storage: 'private' },
  { column: 'cover_images', dataPath: '', storage: 'public' },
  { column: 'samples', dataPath: '*/file', storage: 'private' }
]
  .map(path => ({ entity: Book, table: 'book', ...path }))
  .concat({
    entity: BookShelf,
    table: 'book_shelf',
    column: 'photo',
    dataPath: '',
    storage: 'public'
  })

describe('getAssetFields()', () => {
  it('reads the fields from definitions, without an ORM', () => {
    expect(getAssetFields([Book, BookShelf])).toEqual(fields)
  })

  it('skips the exports of a module that are no entities', () => {
    expect(getAssetFields({ Book, BookShelf, count: 1, name: 'x' })).toEqual(
      fields
    )
  })
})

describe('defineJsonType()', () => {
  it('keeps nullable columns with a schema optional in `em.create()`', () => {
    expectTypeOf<{}>().toExtend<Pick<RequiredEntityData<Book>, 'specs'>>()
  })

  it('keeps nullable columns without a schema optional too', () => {
    expectTypeOf<{}>().toExtend<
      Pick<RequiredEntityData<Book>, 'coverImages'>
    >()
  })
})

const { orm, sql, drop } = await createTestDatabase(
  [Book, Print, BookShelf],
  defineMikroConfig
)

afterAll(drop)

describe('`defineMikroConfig()`', () => {
  beforeEach(() => sql('truncate book, print restart identity'))

  const stored = async () => (await sql('select specs from book'))[0].specs

  it('takes a module of entities', () => {
    const module = { Book, helper: () => {}, states: ['a'] }
    expect(defineMikroConfig({ entities: module }).entities).toEqual([Book])
  })

  it('is what `createMikroAdapter()` needs', () => {
    const options = { dbName: 'dito_mikro_options', entities: [Book] }
    expect(() => createMikroAdapter(new MikroORM(options))).toThrow(
      /`defineMikroConfig\(\)`/
    )
    expect(() =>
      createMikroAdapter(new MikroORM(defineMikroConfig(options)))
    ).not.toThrow()
  })

  it('reads outside of a transaction with `getPoolKysely()`', async () => {
    const adapter = createMikroAdapter(orm)
    await orm.em.fork().transactional(async em => {
      await em.insert(Book, { specs: {} } as never)
      const read = (db: ReturnType<typeof adapter.getPoolKysely>) =>
        db.selectFrom('book').selectAll().execute()
      expect(await read(em.getKysely() as never)).toHaveLength(1)
      expect(await read(adapter.getPoolKysely())).toHaveLength(0)
    })
  })

  it('still reads the asset fields after the discovery', () => {
    expect(getAssetFields([Book, BookShelf])).toEqual(fields)
  })

  it('fills the defaults of a schema in new rows of `em.create()`', async () => {
    const em = orm.em.fork()
    em.create(Book, { specs: { tags: ['a'] } } as never)
    await em.flush()
    expect(await stored()).toEqual({ pages: 100, tags: ['a'] })
  })

  it('fills the defaults of a schema in new rows of writes', async () => {
    const em = orm.em.fork()
    await createRecord(em, Book, { specs: {} })
    await em.flush()
    expect(await stored()).toEqual({ pages: 100 })
  })

  it('stores the output of a schema on create and on update', async () => {
    const em = orm.em.fork()
    const book = await createRecord(em, Book, {
      specs: {},
      edition: { number: 1 },
      label: 'New'
    })
    await em.flush()
    const row = async () => (await sql('select * from book'))[0]
    expect(await row()).toMatchObject({
      specs: { pages: 100 },
      edition: { number: 2 },
      label: 'New!'
    })
    await assignRecord(em, book, {
      specs: { tags: [] },
      edition: { number: 5 },
      label: 'Old'
    })
    await em.flush()
    expect(await row()).toMatchObject({
      specs: { pages: 100, tags: [] },
      edition: { number: 6 },
      label: 'Old!'
    })
  })

  it('parses the values of nested rows of writes once', async () => {
    const em = orm.em.fork()
    const prints = async () =>
      (await sql('select edition from print order by id')).map(
        ({ edition }) => edition.number
      )
    const book = await createRecord(em, Book, {
      prints: [{ edition: { number: 1 } }]
    })
    await em.flush()
    expect(await prints()).toEqual([2])
    await assignRecord(em, book, {
      prints: [
        { id: book.prints[0]!.id },
        { edition: { number: 5 } }
      ]
    })
    await em.flush()
    expect(await prints()).toEqual([2, 6])
  })

  it('parses a value that a handler sets after the write', async () => {
    const em = orm.em.fork()
    const book = await createRecord(em, Book, { specs: {} })
    book.specs = { tags: ['a'] } as never
    await em.flush()
    expect(await stored()).toEqual({ pages: 100, tags: ['a'] })
  })

  it('leaves existing rows alone', async () => {
    await sql(`insert into book (specs) values ('{"tags":[]}')`)
    const em = orm.em.fork()
    const book = await em.findOneOrFail(Book, 1)
    book.notes = {}
    await em.flush()
    expect(await stored()).toEqual({ tags: [] })
  })

  it('warns of pivot entities with an id of their own', async () => {
    const LoanSchema = defineEntity({
      name: 'Loan',
      tableName: 'loan',
      properties: {
        id: p.integer().primary(),
        reader: () => p.manyToOne(Reader),
        title: () => p.manyToOne(Title)
      }
    })
    class Loan extends LoanSchema.class {}
    LoanSchema.setClass(Loan)
    const TitleSchema = defineEntity({
      name: 'Title',
      tableName: 'title',
      properties: { id: p.integer().primary() }
    })
    class Title extends TitleSchema.class {}
    TitleSchema.setClass(Title)
    const ReaderSchema = defineEntity({
      name: 'Reader',
      tableName: 'reader',
      properties: {
        id: p.integer().primary(),
        titles: () => p.manyToMany(Title).pivotEntity(() => Loan),
        wishes: () =>
          p.manyToMany(Title).pivotTable('wish').fixedOrderColumn('id')
      }
    })
    class Reader extends ReaderSchema.class {}
    ReaderSchema.setClass(Reader)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const orm = await MikroORM.init(
      defineMikroConfig({ dbName: 'unused', entities: [Reader, Title, Loan] })
    )
    await orm.close()
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      'The pivot of Reader.titles needs a composite primary key instead of ' +
      'an id of its own.'
    )
    warn.mockRestore()
  })
})
