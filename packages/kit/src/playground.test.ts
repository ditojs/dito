import { Readable } from 'node:stream'
import { defineEntity, p } from '@mikro-orm/core'
import { createApp, runPlayground } from './index.ts'
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

  const createPlaygroundApp = () => {
    const { host, user, dbName } = database.orm.config.getAll()
    return createApp({
      entities: [Book],
      database: { host, user, dbName },
      logger: { level: 'silent' }
    })
  }

  const mockInput = (...lines: string[]) =>
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from(lines) as typeof process.stdin
    )

  beforeAll(async () => {
    database = await createTestDatabase([Book])
  })
  afterAll(() => database.drop())
  afterEach(() => vi.restoreAllMocks())

  it('runs the code of the standard input with the entities in scope', async () => {
    const app = createPlaygroundApp()
    const result: unknown[] = []
    mockInput(
      'em.create(Book, { title });',
      'await em.flush();',
      'result.push(await em.count(Book), orm)'
    )
    await runPlayground(app, { scope: { title: 'Dune', result } })
    expect(result).toEqual([1, app.orm])
    expect(await app.orm.isConnected()).toBe(false)
  })

  it('runs the services around the code, and has them in scope', async () => {
    const app = createPlaygroundApp()
    const log: string[] = []
    const service = (name: string) => ({
      name,
      start: () => void log.push(`${name} start`),
      stop: () => void log.push(`${name} stop`)
    })
    app.addService('first', service('first'))
    app.addService('second', service('second'))
    mockInput('log.push(services.second.name)')
    await runPlayground(app, { scope: { log } })
    expect(log).toEqual([
      'first start',
      'second start',
      'second',
      'second stop',
      'first stop'
    ])
    expect(await app.orm.isConnected()).toBe(false)
  })

  it('closes the app when a service fails to start', async () => {
    const app = createPlaygroundApp()
    app.addService('failing', {
      start: () => Promise.reject(new Error('Failed'))
    })
    await expect(runPlayground(app)).rejects.toThrow('Failed')
    expect(await app.orm.isConnected()).toBe(false)
  })

  it('closes the app when the code has a syntax error', async () => {
    const app = createPlaygroundApp()
    mockInput('if (')
    await expect(runPlayground(app)).rejects.toThrow(SyntaxError)
    expect(await app.orm.isConnected()).toBe(false)
  })

  it('closes the app when the code throws', async () => {
    const app = createPlaygroundApp()
    mockInput('throw new Error("Failed")')
    await expect(runPlayground(app)).rejects.toThrow('Failed')
    expect(await app.orm.isConnected()).toBe(false)
  })
})
