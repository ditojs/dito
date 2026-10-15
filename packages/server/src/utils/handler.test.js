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
      before: null,
      after: null,
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
    const before = () => {}
    const after = () => {}
    const descriptor = parseHandlerDefinition({
      handler,
      before,
      after,
      transacted: true,
      parameters: [{ name: { type: 'string' } }, { patch: true }],
      response: { type: 'string' },
      cached: true
    })
    expect(descriptor).toEqual({
      handler,
      before,
      after,
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

  it('rejects the former `returns` setting', () => {
    const message = `Unsupported 'returns' in handler definition, use 'response' instead.`
    const handler = () => {}
    const returns = { type: 'string' }
    expect(() => parseHandlerDefinition({ handler, returns })).toThrow(message)
    expect(() =>
      parseHandlerDefinition({ handler, options: { returns: {} } })
    ).toThrow(message)
    handler.returns = returns
    expect(() => parseHandlerDefinition(handler)).toThrow(message)
  })

  it('returns null for definitions without a handler function', () => {
    expect(parseHandlerDefinition({ parameters: {} })).toBe(null)
    expect(parseHandlerDefinition('handler')).toBe(null)
    expect(parseHandlerDefinition(null)).toBe(null)
  })
})
