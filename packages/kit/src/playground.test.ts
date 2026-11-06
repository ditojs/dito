import { Readable } from 'node:stream'
import { defineEntity, p } from '@mikro-orm/core'
import { runPlayground } from './playground.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string()
  }
})
class Book extends BookSchema.class {}
BookSchema.setClass(Book)

describe('runPlayground()', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  const close = vi.fn(async () => {})
  const app = () => ({ orm: database.orm, close })

  beforeAll(async () => {
    database = await createTestDatabase([Book])
  })
  afterAll(() => database.drop())
  afterEach(() => vi.restoreAllMocks())

  it('runs the code of the standard input with the entities in scope', async () => {
    const result: unknown[] = []
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from([
        'em.create(Book, { title });',
        'await em.flush();',
        'result.push(await em.count(Book), orm)'
      ]) as typeof process.stdin
    )
    await runPlayground(app(), { title: 'Dune', result })
    expect(result).toEqual([1, database.orm])
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes the app when the code throws', async () => {
    close.mockClear()
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from(['throw new Error("Failed")']) as typeof process.stdin
    )
    await expect(runPlayground(app())).rejects.toThrow('Failed')
    expect(close).toHaveBeenCalledOnce()
  })
})
