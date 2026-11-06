import { assignRecord } from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import {
  ReadingList,
  ReadingListVolume,
  Volume,
  loadLibrary,
  libraryEntities
} from './test/libraryEntities.ts'

// How MikroORM 7.2.5 and `assignRecord()` write a many-to-many relation whose
// pivot entity has a composite primary key of its two foreign keys and
// columns of its own, the form that MikroORM's documentation gives for a
// custom pivot entity, see `library-entities.ts`.

const { orm, sql, drop } = await createTestDatabase(libraryEntities)

afterAll(drop)

// L1 links I1 and I2, L2 links I2, each with a fee.
beforeEach(async () => {
  await sql(
    'truncate library, reading_list, volume, reading_list_volume ' +
    'restart identity cascade'
  )
  await sql(`insert into library (name) values ('Library')`)
  await sql(
    `insert into reading_list (name, library_id) values ('L1', 1), ('L2', 1)`
  )
  await sql(
    `insert into volume (name, library_id) values ('I1', 1), ('I2', 1)`
  )
  await sql(
    'insert into reading_list_volume (reading_list_id, volume_id, fee) ' +
    'values (1, 1, 10), (1, 2, 20), (2, 2, 30)'
  )
})

// The pivot rows as `L<list>-I<volume>`, with the fee after `=`.
const pivots = async () =>
  (await sql('select * from reading_list_volume order by 1, 2'))
    .map(
      (row: Record<string, unknown>) => (
        `L${row.reading_list_id}-I${row.volume_id}` +
        (row.fee == null ? '' : `=${row.fee}`)
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
        const readingList = await em.findOneOrFail(ReadingList, 2, {
          populate: (owner ? ['volumes'] : []) as never[]
        })
        const volume = await em.findOneOrFail(Volume, 1, {
          populate: (inverse ? ['readingLists'] : []) as never[]
        })
        if (side === 'owner') {
          if (write === 'add') readingList.volumes.add(volume)
          else if (write === 'assign') {
            em.assign(readingList, { volumes: [2, 1] } as never)
          } else {
            readingList.volumes.set([em.getReference(Volume, 2), volume])
          }
        } else if (write === 'add') {
          volume.readingLists.add(readingList)
        } else if (write === 'assign') {
          em.assign(volume, { readingLists: [1, 2] } as never)
        } else {
          volume.readingLists.set([
            em.getReference(ReadingList, 1),
            readingList
          ])
        }
        await em.flush()
        const name = (
          `${side} ${write}, owner ${owner ? 'loaded' : 'not loaded'}, ` +
          `inverse ${inverse ? 'loaded' : 'not loaded'}`
        )
        results[name] = await pivots()
        await sql('delete from reading_list_volume')
        await sql(
          'insert into reading_list_volume (reading_list_id, volume_id, fee) ' +
          'values (1, 1, 10), (1, 2, 20), (2, 2, 30)'
        )
      }
    }
  }
  const kept = 'L1-I1=10 L1-I2=20 L2-I1 L2-I2=30'
  // An assign or `set()` on a collection that isn't loaded writes all rows of
  // its side again, without their fees.
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
    readingLists: [
      { id: 1, volumes: [{ id: 1 }] },
      { id: 2, volumes: [{ id: 2 }, { id: 1 }, { '#ref': 'i3' }] },
      { name: 'L3', volumes: [{ '#ref': 'i3' }] }
    ],
    volumes: [{ id: 1 }, { id: 2 }, { '#id': 'i3', 'name': 'I3' }]
  }

  // Counts the queries of `fn` that load the volumes of reading lists through
  // the pivot table.
  const countLoads = async (fn: () => Promise<unknown>) => {
    const spy = vi.spyOn(orm.em.getConnection(), 'executeQuery')
    try {
      await fn()
      return spy.mock.calls.filter(([query]) =>
        /from "reading_list_volume" .* inner join "volume"/.test(
          String(query)
        )
      ).length
    } finally {
      spy.mockRestore()
    }
  }

  it('keeps, drops and adds links from the owning side', async () => {
    // The record comes without its collections, and `assignRecord()` loads
    // the ones that the body writes, once for all reading lists.
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists', 'volumes'])
    const loads = await countLoads(() => assignRecord(em, library, body))
    expect(loads).toBe(1)
    expect(library.volumes.getItems()[0]!.readingLists.isInitialized()).toBe(
      false
    )
    await em.flush()
    expect(await pivots()).toBe('L1-I1=10 L2-I1 L2-I2=30 L2-I3 L3-I3')
  })

  it('leaves loaded collections as they are', async () => {
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists.volumes', 'volumes'])
    expect(await countLoads(() => assignRecord(em, library, body))).toBe(0)
    await em.flush()
    expect(await pivots()).toBe('L1-I1=10 L2-I1 L2-I2=30 L2-I3 L3-I3')
  })

  it('keeps, drops and adds links from the inverse side', async () => {
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists', 'volumes'])
    await assignRecord(em, library, {
      volumes: [
        { id: 1, readingLists: [{ id: 1 }, { id: 2 }] },
        { id: 2, readingLists: [1] },
        { 'name': 'I3', '#id': 'i3', 'readingLists': [{ '#ref': 'l3' }] }
      ],
      readingLists: [{ id: 1 }, { id: 2 }, { '#id': 'l3', 'name': 'L3' }]
    })
    await em.flush()
    expect(await pivots()).toBe('L1-I1=10 L1-I2=20 L2-I1 L3-I3')
  })

  it('checks the ids of the inverse side', async () => {
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists', 'volumes'])
    await expect(
      assignRecord(em, library, { volumes: [{ id: 1, readingLists: [9] }] })
    ).rejects.toMatchObject({
      errors: { 'volumes/0/readingLists/0': [{ keyword: 'invalid_value' }] }
    })
  })

  it('updates the loaded collections of both sides', async () => {
    const em = orm.em.fork()
    const library = await loadLibrary(em, [
      'readingLists', 'volumes.readingLists'
    ])
    await assignRecord(em, library, body)
    await em.flush()
    const names = (items: { name: string }[]) => items.map(item => item.name)
    const [l1, l2, l3] = library.readingLists.getItems()
    const [i1, i2, i3] = library.volumes.getItems()
    expect(names(l2!.volumes.getItems())).toEqual(['I2', 'I1', 'I3'])
    expect(names(l3!.volumes.getItems())).toEqual(['I3'])
    expect(names(i1!.readingLists.getItems())).toEqual(['L1', 'L2'])
    expect(names(i2!.readingLists.getItems())).toEqual(['L2'])
    expect(names(i3!.readingLists.getItems())).toEqual(['L2', 'L3'])
    expect(names(l1!.volumes.getItems())).toEqual(['I1'])
  })

  it('sets the fees of the links in a second flush', async () => {
    await orm.em.fork().transactional(async em => {
      const library = await loadLibrary(em, ['readingLists', 'volumes'])
      await assignRecord(em, library, body)
      await em.flush()
      // The pivot rows weren't loaded before, so the query reads them all.
      const links = await em.find(ReadingListVolume, {
        readingList: { library: library.id }
      })
      for (const link of links) {
        link.fee = link.readingList.id * 100 + link.volume.id
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
    // row, so fees wait for a second flush.
    const em = orm.em.fork()
    const library = await loadLibrary(em, ['readingLists.volumes', 'volumes'])
    await assignRecord(em, library, body)
    const [, l2] = library.readingLists.getItems()
    const [i1] = library.volumes.getItems()
    em.create(ReadingListVolume, {
      readingList: l2,
      volume: i1,
      fee: 1
    } as never)
    await expect(em.flush()).rejects.toThrow(/duplicate key/)
  })
})
