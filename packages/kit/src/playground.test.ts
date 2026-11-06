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
    await runPlayground(app(), { scope: { title: 'Dune', result } })
    expect(result).toEqual([1, database.orm])
    expect(close).toHaveBeenCalledOnce()
  })

  it('runs the services around the code, and closes the app last', async () => {
    const log: string[] = []
    close.mockImplementationOnce(async () => void log.push('close'))
    const service = (name: string) => ({
      start: () => void log.push(`${name} start`),
      stop: () => void log.push(`${name} stop`)
    })
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from(['log.push("code")']) as typeof process.stdin
    )
    await runPlayground(app(), {
      services: [service('first'), service('second')],
      scope: { log }
    })
    expect(log).toEqual([
      'first start',
      'second start',
      'code',
      'second stop',
      'first stop',
      'close'
    ])
  })

  it('closes the app when a service fails to start', async () => {
    close.mockClear()
    const service = { start: () => Promise.reject(new Error('Failed')) }
    await expect(
      runPlayground(app(), { services: [service] })
    ).rejects.toThrow('Failed')
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes the app when the code has a syntax error', async () => {
    close.mockClear()
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from(['if (']) as typeof process.stdin
    )
    await expect(runPlayground(app())).rejects.toThrow(SyntaxError)
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
