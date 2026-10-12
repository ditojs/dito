import { vi } from 'vitest'
import { SchemaEvents } from './SchemaEvents.ts'

describe('SchemaEvents', () => {
  const context = {}

  it('resolves without handlers', async () => {
    const events = new SchemaEvents({})
    expect(events.has('load')).toBe(false)
    await expect(events.emit('load', context)).resolves.toBe(undefined)
  })

  it('calls the handlers of `events` and of `on[A-Z]` with the context', async () => {
    const load = vi.fn()
    const onLoad = vi.fn()
    const events = new SchemaEvents({ events: { load }, onLoad })
    await events.emit('load', context)
    expect(load).toHaveBeenCalledWith(context)
    expect(onLoad).toHaveBeenCalledWith(context)
  })

  it('resolves with the last result that is not undefined', async () => {
    const events = new SchemaEvents({
      events: { load: () => 'first' },
      onLoad: () => undefined
    })
    expect(await events.emit('load', context)).toBe('first')
  })

  it('runs the handlers of one emit one after the other', async () => {
    const calls: string[] = []
    const events = new SchemaEvents({
      events: {
        async load() {
          calls.push('start first')
          await Promise.resolve()
          calls.push('end first')
        }
      },
      onLoad: () => calls.push('second')
    })
    await events.emit('load', context)
    expect(calls).toEqual(['start first', 'end first', 'second'])
  })

  it('runs separate emits concurrently', async () => {
    const resolvers: Record<string, () => void> = {}
    const events = new SchemaEvents({
      async onLoad({ value }: { value: string }) {
        await new Promise<void>(resolve => (resolvers[value] = resolve))
        return value
      }
    })
    const first = events.emit('load', { value: 'first' })
    const second = events.emit('load', { value: 'second' })
    await vi.waitFor(() => expect(Object.keys(resolvers)).toHaveLength(2))
    resolvers.second()
    expect(await second).toBe('second')
    resolvers.first()
    expect(await first).toBe('first')
  })

  it('calls all handlers and rejects with their errors', async () => {
    const events = new SchemaEvents({
      events: {
        load() {
          throw new Error('First')
        }
      },
      async onLoad() {
        throw new Error('Second')
      }
    })
    const error = await events.emit('load', context).catch(error => error)
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.message).toBe(`Errors during event handler for 'load'`)
    expect(error.errors.map((error: Error) => error.message)).toEqual([
      'First',
      'Second'
    ])
  })

  it('bubbles `change` events to the parent, unless a handler returns `false`', async () => {
    const onChange = vi.fn()
    const parent = new SchemaEvents({ onChange })
    expect(new SchemaEvents({}, parent).has('change')).toBe(true)
    await new SchemaEvents({ onChange: () => undefined }, parent).emit(
      'change',
      context
    )
    expect(onChange).toHaveBeenCalledWith(context)
    await new SchemaEvents({ onChange: () => false }, parent).emit(
      'change',
      context
    )
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('bubbles other events only with `bubble`', async () => {
    const onClick = vi.fn()
    const events = new SchemaEvents({}, new SchemaEvents({ onClick }))
    expect(events.has('click')).toBe(false)
    expect(events.has('click', { bubble: true })).toBe(true)
    await events.emit('click', context)
    expect(onClick).not.toHaveBeenCalled()
    await events.emit('click', context, { bubble: true })
    expect(onClick).toHaveBeenCalledOnce()
  })
})
