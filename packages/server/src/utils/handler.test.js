import { vi } from 'vitest'
import { parseHandlerDefinition } from './handler.js'

describe('parseHandlerDefinition()', () => {
  it('parses the function form with settings as function properties', () => {
    const handler = () => {}
    handler.authorize = 'admin'
    handler.scope = 'published'
    handler.parameters = [{ name: 'id', type: 'integer' }]
    handler.options = { parameters: { patch: true } }
    handler.cached = true
    expect(parseHandlerDefinition(handler)).toEqual({
      handler,
      core: false,
      authorize: 'admin',
      transacted: null,
      scope: ['published'],
      parameters: [{ name: 'id', type: 'integer' }],
      response: null,
      options: {
        parameters: { patch: true },
        response: {}
      },
      extra: { cached: true }
    })
  })

  it('parses the object form with `[schema, options]` settings', () => {
    const handler = () => {}
    const descriptor = parseHandlerDefinition({
      handler,
      transacted: true,
      parameters: [{ name: { type: 'string' } }, { patch: true }],
      response: { type: 'string' },
      cached: true
    })
    expect(descriptor).toEqual({
      handler,
      core: false,
      authorize: null,
      transacted: true,
      scope: null,
      parameters: { name: { type: 'string' } },
      response: { type: 'string' },
      options: {
        parameters: { patch: true },
        response: {}
      },
      extra: { cached: true }
    })
  })

  it('maps the deprecated `returns` setting to `response`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const descriptor = parseHandlerDefinition({
        handler() {},
        returns: [{ type: 'number' }, { patch: false }]
      })
      expect(descriptor.response).toEqual({ type: 'number' })
      expect(descriptor.options.response).toEqual({ patch: false })
    } finally {
      warn.mockRestore()
    }
  })

  it('does not write settings onto the handler function', () => {
    const handler = () => {}
    parseHandlerDefinition({
      handler,
      authorize: 'admin',
      parameters: [{ name: { type: 'string' } }, { patch: true }],
      cached: true
    })
    expect(Object.keys(handler)).toEqual([])
  })

  it('returns null for definitions without a handler function', () => {
    expect(parseHandlerDefinition({ parameters: {} })).toBe(null)
    expect(parseHandlerDefinition('handler')).toBe(null)
    expect(parseHandlerDefinition(null)).toBe(null)
  })
})
