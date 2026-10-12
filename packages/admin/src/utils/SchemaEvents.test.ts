import { vi } from 'vitest'
import SchemaContext from '../SchemaContext.js'
import { SchemaEvents } from './SchemaEvents.ts'

describe('SchemaEvents', () => {
  const createContext = (values = {}) => new SchemaContext(null, values)
  const context = createContext({ dataPath: 'title', value: 'Emma' })

  it('resolves without handlers', async () => {
    const events = new SchemaEvents({}, '')
    expect(events.has('load')).toBe(false)
    await expect(events.emit('load', context)).resolves.toBe(undefined)
  })

  it('calls the handlers with the context', async () => {
    const onLoad = vi.fn()
    const events = new SchemaEvents({ onLoad }, 'title')
    await events.emit('load', context)
    expect(onLoad).toHaveBeenCalledOnce()
    const [handlerContext] = onLoad.mock.calls[0]
    expect(handlerContext).toBeInstanceOf(SchemaContext)
    expect(handlerContext.value).toBe('Emma')
    expect(handlerContext.dataPath).toBe('title')
    expect(handlerContext.handlerDataPath).toBe('title')
  })

  it('resolves with the result of the handler', async () => {
    const events = new SchemaEvents({ onLoad: () => 'loaded' }, '')
    expect(await events.emit('load', context)).toBe('loaded')
  })

  it('runs separate emits concurrently', async () => {
    const resolvers: Record<string, () => void> = {}
    const events = new SchemaEvents(
      {
        async onLoad({ value }: { value: string }) {
          await new Promise<void>(resolve => (resolvers[value] = resolve))
          return value
        }
      },
      ''
    )
    const first = events.emit('load', createContext({ value: 'first' }))
    const second = events.emit('load', createContext({ value: 'second' }))
    await vi.waitFor(() => expect(Object.keys(resolvers)).toHaveLength(2))
    resolvers.second()
    expect(await second).toBe('second')
    resolvers.first()
    expect(await first).toBe('first')
  })

  it('rejects with the errors of the handler', async () => {
    const events = new SchemaEvents(
      {
        async onLoad() {
          throw new Error('Unavailable')
        }
      },
      ''
    )
    const error = await events.emit('load', context).catch(error => error)
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.message).toBe(`Errors during event handler for 'load'`)
    expect(error.errors.map((error: Error) => error.message)).toEqual([
      'Unavailable'
    ])
  })

  it('bubbles `change` events to the parent, unless a handler returns `false`', async () => {
    const onChange = vi.fn()
    const parent = new SchemaEvents({ onChange }, '')
    expect(new SchemaEvents({}, 'title', parent).has('change')).toBe(true)
    await new SchemaEvents({ onChange: () => undefined }, 'title', parent).emit(
      'change',
      context
    )
    expect(onChange).toHaveBeenCalledOnce()
    await new SchemaEvents({ onChange: () => false }, 'title', parent).emit(
      'change',
      context
    )
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('passes the data paths of the emitter and the handler when bubbling', async () => {
    const dataPaths: string[][] = []
    const onChange = ({ dataPath, handlerDataPath }: SchemaContext) => {
      dataPaths.push([dataPath, handlerDataPath])
    }
    const root = new SchemaEvents({ onChange }, '')
    const author = new SchemaEvents({ onChange }, 'author', root)
    await new SchemaEvents({ onChange }, 'author/name', author).emit(
      'change',
      createContext({ dataPath: 'author/name' })
    )
    expect(dataPaths).toEqual([
      ['author/name', 'author/name'],
      ['author/name', 'author'],
      ['author/name', '']
    ])
  })

  it('bubbles other events only with `bubble`', async () => {
    const onClick = vi.fn()
    const events = new SchemaEvents({}, '', new SchemaEvents({ onClick }, ''))
    expect(events.has('click')).toBe(false)
    expect(events.has('click', { bubble: true })).toBe(true)
    await events.emit('click', context)
    expect(onClick).not.toHaveBeenCalled()
    await events.emit('click', context, { bubble: true })
    expect(onClick).toHaveBeenCalledOnce()
  })
})
