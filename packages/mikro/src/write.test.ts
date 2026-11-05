import { z } from 'zod'
import { StringType, defineEntity, p } from '@mikro-orm/core'
import { assignRecord, createRecord } from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Book, entities } from './test/entities.ts'
import {
  Library,
  loadLibrary,
  libraryEntities
} from './test/libraryEntities.ts'

// A schema that throws for `throw`, and rejects for `reject` when async.
const throwing = (isAsync: boolean) =>
  z.unknown().refine(value => {
    if (value === 'throw') throw new Error('Internal')
    return isAsync && value === 'reject'
      ? Promise.reject(new Error('Internal'))
      : true
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
    code: p.string().length(4).nullable(),
    note: p.string().default(''),
    price: p.decimal().precision(5).scale(2).nullable(),
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
  ...libraryEntities,
  Sample
])

afterAll(drop)

const reset = () =>
  orm.em
    .getConnection()
    .execute(
      'truncate library, reading_list, volume, reading_list_volume, ' +
      'legacy_reading_list_volume, book, part, chapter ' +
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

// The rows of a pivot table as `L<list>-I<volume>`, with the fee after
// `=`, and with `<id>:` before them where the table has ids.
const pivots = async (table = 'reading_list_volume') => {
  const rows = await orm.em
    .fork()
    .getConnection()
    .execute(`select * from ${table} order by reading_list_id, volume_id`)
  return rows.map(
    (row: Record<string, unknown>) => (
      (row.id == null ? '' : `${row.id}:`) +
      `L${row.reading_list_id}-I${row.volume_id}` +
      (row.fee == null ? '' : `=${Number(row.fee)}`)
    )
  )
}

// A library with reading lists L1, L2 and volumes I1, I2, where L1 links I1 and
// I2, and L2 links I2, with fees, through both pivot tables.
async function createLibrary() {
  const em = orm.em.fork()
  await createRecord(em, Library, {
    name: 'Library',
    readingLists: [
      {
        name: 'L1',
        volumes: [{ '#ref': 'i1' }, { '#ref': 'i2' }],
        legacyVolumes: [{ '#ref': 'i1' }, { '#ref': 'i2' }]
      },
      {
        name: 'L2',
        volumes: [{ '#ref': 'i2' }],
        legacyVolumes: [{ '#ref': 'i2' }]
      }
    ],
    volumes: [
      { '#id': 'i1', 'name': 'I1' },
      { '#id': 'i2', 'name': 'I2' }
    ]
  })
  await em.flush()
  for (const table of ['reading_list_volume', 'legacy_reading_list_volume']) {
    await em
      .getConnection()
      .execute(
        `update ${table} set fee = reading_list_id * 10 + volume_id`
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

  it('checks the lengths of strings in characters', async () => {
    const em = orm.em.fork()
    expect(await issues(createRecord(em, Sample, { code: 'abcde' }))).toEqual({
      code: 'Too big: expected string to have <=4 characters'
    })
    const sample = await createRecord(em, Sample, { code: '😀😀😀😀' })
    await em.flush()
    expect(sample.code).toBe('😀😀😀😀')
  })

  it('refuses empty strings in required columns', async () => {
    const em = orm.em.fork()
    const message = 'Too small: expected string to have >=1 characters'
    expect(await issues(createRecord(em, Book, { name: '' }))).toEqual({
      name: message
    })
    const book = await createRecord(em, Book, { name: 'Book' })
    await em.flush()
    expect(await issues(assignRecord(em, book, { name: '' }))).toEqual({
      name: message
    })
  })

  it('takes empty strings in columns with a default', async () => {
    const em = orm.em.fork()
    const sample = await createRecord(em, Sample, { note: '', text: '' })
    await em.flush()
    expect(sample).toMatchObject({ note: '', text: '' })
  })

  it('checks the integer digits of decimals', async () => {
    const em = orm.em.fork()
    expect(
      await issues(createRecord(em, Sample, { price: '1000.5' }))
    ).toEqual({ price: 'Too big: expected number to be <1000' })
    expect(
      await issues(createRecord(em, Sample, { price: '-1000' }))
    ).toEqual({ price: 'Too small: expected number to be >-1000' })
    const sample = await createRecord(em, Sample, { price: '999.991' })
    await em.flush()
    await em.refresh(sample)
    expect(sample.price).toBe('999.99')
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
    expect(await issues(createRecord(em, Book, []))).toEqual({
      '': 'Invalid input: expected object, received array'
    })
    expect(
      await issues(
        createRecord(em, Book, {
          name: null,
          parts: {},
          authors: 1,
          info: 'text'
        })
      )
    ).toEqual({
      name: 'Invalid input: expected string, received null',
      parts: 'Invalid input: expected array, received object',
      authors: 'Invalid input: expected array, received number',
      info: 'Invalid input: expected object, received string'
    })
    expect(
      await issues(
        createRecord(em, Book, {
          name: 'Book',
          authors: ['a', { id: 'b' }],
          parts: [{ name: 'Part', defaultChapter: { id: 'a' } }]
        })
      )
    ).toEqual({
      'authors/0': 'Invalid input: expected id, received string',
      'authors/1/id': 'Invalid input: expected id, received string',
      'parts/0/defaultChapter/id': 'Invalid input: expected id, received string'
    })
  })

  it('refuses ids of owned rows that are no ids', async () => {
    const em = orm.em.fork()
    const book = await createRecord(em, Book, { name: 'Book' })
    await em.flush()
    expect(
      await issues(assignRecord(em, book, { parts: [{ id: 'x', name: 'S' }] }))
    ).toEqual({
      'parts/0/id': 'Invalid input: expected id, received string'
    })
  })
})

describe('createRecord()', () => {
  it('links new rows through a many-to-many relation in one flush', async () => {
    await createLibrary()
    expect(await pivots()).toEqual(['L1-I1=11', 'L1-I2=12', 'L2-I2=22'])
    expect(await pivots('legacy_reading_list_volume')).toEqual([
      '2:L1-I1=11',
      '3:L1-I2=12',
      '1:L2-I2=22'
    ])
  })

  it('links a ref to a row that the body sends later', async () => {
    const em = orm.em.fork()
    const library = await createRecord(em, Library, {
      name: 'Library',
      volumes: [{ name: 'I1', bundle: { '#ref': 'l1' } }],
      readingLists: [{ '#id': 'l1', 'name': 'L1' }]
    })
    const [readingList] = library.readingLists.getItems()
    expect(library.volumes.getItems()[0]!.bundle).toBe(readingList)
    await em.flush()
    expect(readingList!.id).toBe(1)
  })

  it('takes no flush and leaves the record to the caller', async () => {
    const em = orm.em.fork()
    const book = await createRecord(em, Book, { name: 'Book' })
    expect(book).toBeInstanceOf(Book)
    expect(book.id).toBeUndefined()
    await em.flush()
    expect(book.id).toBe(1)
  })

  it('answers the checks of the body and of `#id` and `#ref`', async () => {
    const em = orm.em.fork()
    expect(await issues(createRecord(em, Book, {}))).toEqual({
      name: 'Invalid input: expected string, received undefined'
    })
    expect(
      await issues(
        createRecord(em, Library, {
          name: 'Library',
          readingLists: [{ name: 'L1', volumes: [{ id: 5 }] }]
        })
      )
    ).toEqual({
      'readingLists/0/volumes/0': 'names no Volume'
    })
    expect(
      await issues(
        createRecord(em, Library, {
          name: 'Library',
          readingLists: [{ name: 'L1', volumes: [{ '#ref': 'x' }] }],
          volumes: [
            { '#id': 'i', 'name': 'I1', 'bundle': { '#ref': 'y' } },
            { '#id': 'i', 'name': 'I2' }
          ]
        })
      )
    ).toEqual({
      'volumes/1/#id': `is the key of another new row 'i'`,
      'readingLists/0/volumes/0': `references the unknown new row 'x'`,
      'volumes/0/bundle': `references the unknown new row 'y'`
    })
    // Keys that are no strings are issues too.
    expect(
      await issues(
        createRecord(em, Library, {
          name: 'Library',
          readingLists: [{ '#id': 1, 'name': 'L1' }],
          volumes: [{ name: 'I1', bundle: { '#ref': 2 } }]
        })
      )
    ).toEqual({
      'readingLists/0/#id': 'Invalid input: expected string, received number',
      'volumes/0/bundle/#ref': 'Invalid input: expected string, received number'
    })
    // A JSON value keeps its markers.
    expect(
      await issues(
        createRecord(em, Book, {
          name: 'Book',
          parts: [
            {
              name: 'Part',
              defaultChapter: { '#ref': 'f' },
              chapters: [
                { name: 'C', keywords: [{ '#id': 'f', 'tag': 'epub' }] }
              ]
            }
          ]
        })
      )
    ).toEqual({
      'parts/0/defaultChapter': `references the unknown new row 'f'`
    })
    expect(
      await issues(createRecord(em, Library, { '#id': 'o', 'name': 'Library' }))
    ).toEqual({ '#id': 'is only allowed in nested rows' })
    expect(
      await issues(
        createRecord(em, Library, {
          name: 'Library',
          readingLists: [
            { '#id': 'f', 'name': 'L1', 'volumes': [{ '#ref': 'f' }] }
          ]
        })
      )
    ).toEqual({
      'readingLists/0/volumes/0': 'references a new row that is no Volume'
    })
  })
})

describe('assignRecord()', () => {
  it('refuses `#id` in rows with an id', async () => {
    await createLibrary()
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists', 'volumes'])
    expect(
      await issues(
        assignRecord(em, library, {
          '#id': 'o',
          'readingLists': [{ 'id': 1, '#id': 'l1' }]
        })
      )
    ).toEqual({
      '#id': 'is not allowed in a row with an id',
      'readingLists/0/#id': 'is not allowed in a row with an id'
    })
  })

  it('rewrites the kept pairs of a pivot entity with an id of its own', async () => {
    // A pivot entity with a primary key of its own makes MikroORM 7.2.5 order
    // the relation by that key (`fixedOrder`). When the owning side gains a
    // link, MikroORM deletes the rows of the kept pairs and inserts them
    // again, without their other columns.
    await createLibrary()
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists', 'volumes'])
    await assignRecord(em, library, {
      readingLists: [
        { id: 1, legacyVolumes: [1] },
        { id: 2, legacyVolumes: [2, { '#ref': 'i3' }] }
      ],
      volumes: [{ id: 1 }, { id: 2 }, { '#id': 'i3', 'name': 'I3' }]
    })
    await em.flush()
    // L2-I2 had the row 1 with a fee.
    expect(await pivots('legacy_reading_list_volume')).toEqual([
      '2:L1-I1=11',
      '4:L2-I2',
      '5:L2-I3'
    ])
  })
})
