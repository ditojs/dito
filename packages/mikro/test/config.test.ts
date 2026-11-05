import { defineEntity, p, type RequiredEntityData } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/postgresql'
import { z } from 'zod'
import {
  createMikroAdapter,
  createRecord,
  defineJsonType,
  defineMikroConfig,
  getAssetPaths
} from '../src/index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const specsSchema = z.object({
  pages: z.number().default(100),
  tags: z.array(z.string()).optional()
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
            { path: '**/file', storage: 'public' },
            { path: '*/files', storage: 'private' }
          ]
        })
      )
      .nullable(),
    coverImages: p
      .type(defineJsonType({ assets: [{ path: '', storage: 'public' }] }))
      .nullable(),
    samples: p
      .type(
        defineJsonType({ assets: [{ path: '*/file', storage: 'private' }] })
      )
      .nullable(),
    notes: p.json().nullable()
  }
})
class Book extends BookSchema.class {}
BookSchema.setClass(Book)

const ShelfSchema = defineEntity({
  name: 'BookShelf',
  properties: {
    id: p.integer().primary(),
    photo: p
      .type(defineJsonType({ assets: [{ path: '', storage: 'public' }] }))
      .nullable()
  }
})
class BookShelf extends ShelfSchema.class {}
ShelfSchema.setClass(BookShelf)

const paths = [
  { table: 'book', column: 'specs', path: '**/file', storage: 'public' },
  { table: 'book', column: 'specs', path: '*/files', storage: 'private' },
  { table: 'book', column: 'cover_images', path: '', storage: 'public' },
  { table: 'book', column: 'samples', path: '*/file', storage: 'private' },
  { table: 'book_shelf', column: 'photo', path: '', storage: 'public' }
]

describe('getAssetPaths()', () => {
  it('reads the paths from definitions, without an ORM', () => {
    expect(getAssetPaths([Book, BookShelf])).toEqual(paths)
  })

  it('skips the exports of a module that are no entities', () => {
    expect(getAssetPaths({ Book, BookShelf, count: 1, name: 'x' })).toEqual(
      paths
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
  [Book, BookShelf],
  defineMikroConfig
)

afterAll(drop)

describe('`defineMikroConfig()`', () => {
  beforeEach(() => sql('truncate book restart identity'))

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

  it('reads outside of a transaction with `adapter.getKysely()`', async () => {
    const adapter = createMikroAdapter(orm)
    await orm.em.fork().transactional(async em => {
      await em.insert(Book, { specs: {} } as never)
      const read = (db: ReturnType<typeof adapter.getKysely>) =>
        db.selectFrom('book').selectAll().execute()
      expect(await read(em.getKysely() as never)).toHaveLength(1)
      expect(await read(adapter.getKysely())).toHaveLength(0)
    })
  })

  it('still reads the asset paths after the discovery', () => {
    expect(getAssetPaths([Book, BookShelf])).toEqual(paths)
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
