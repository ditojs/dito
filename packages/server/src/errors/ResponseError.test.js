import { ResponseError } from './ResponseError.js'
import { NotFoundError } from './NotFoundError.js'

describe('ResponseError', () => {
  it('uses the default message and status without arguments', () => {
    const error = new ResponseError()
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Response error')
    expect(error.status).toBe(500)
    expect(error.data).toBeUndefined()
    expect(error.cause).toBeUndefined()
    expect(error.toJSON()).toEqual({ message: 'Response error' })
  })

  it('uses a string argument as the message', () => {
    const error = new ResponseError('Shelf is full')
    expect(error.message).toBe('Shelf is full')
    expect(error.status).toBe(500)
  })

  it('replaces the defaults when passing a message and a status', () => {
    // A common pattern in applications: `new ResponseError(msg, { status })`
    const error = new ResponseError('Invalid token', { status: 403 })
    expect(error.message).toBe('Invalid token')
    expect(error.status).toBe(403)
    expect(error.data).toBeUndefined()
  })

  it('collects additional plain object properties as data', () => {
    const error = new ResponseError({
      message: 'Book is checked out',
      status: 409,
      code: 'checked_out',
      bookId: 12
    })
    expect(error.message).toBe('Book is checked out')
    expect(error.status).toBe(409)
    expect(error.data).toEqual({ code: 'checked_out', bookId: 12 })
    expect(error.toJSON()).toEqual({
      message: 'Book is checked out',
      code: 'checked_out',
      bookId: 12
    })
  })

  it('serializes to the message and data with JSON.stringify()', () => {
    const error = new ResponseError({ message: 'Nope', reason: 'closed' })
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      message: 'Nope',
      reason: 'closed'
    })
  })

  it('applies overrides on top of the error object and the defaults', () => {
    const error = new ResponseError(
      { message: 'Original', status: 400, code: 'a' },
      { message: 'Default', status: 500 },
      { message: 'Overridden', code: 'b' }
    )
    expect(error.message).toBe('Overridden')
    expect(error.status).toBe(400)
    expect(error.data).toEqual({ code: 'b' })
  })

  it('passes a `cause` from a plain object on to the error', () => {
    const cause = new Error('Disk is full')
    const error = new ResponseError({ message: 'Saving failed', cause })
    expect(error.cause).toBe(cause)
    expect(error.data).toBeUndefined()
  })

  it('allows overriding the stack', () => {
    const error = new ResponseError('Failed', undefined, { stack: 'custom' })
    expect(error.stack).toBe('custom')
    expect(error.data).toBeUndefined()
  })

  it('keeps its own stack without a stack override', () => {
    const error = new ResponseError('Failed')
    expect(error.stack).toContain('Failed')
  })

  describe('wrapping errors', () => {
    it('copies the message of generic errors and sets them as cause', () => {
      const original = new Error('Something broke')
      const error = new ResponseError(original)
      expect(error.message).toBe('Something broke')
      expect(error.status).toBe(500)
      expect(error.cause).toBe(original)
      expect(error.data).toBeUndefined()
    })

    it('copies `status` and `code` of wrapped errors', () => {
      const original = Object.assign(new Error('Missing file'), {
        status: 404,
        code: 'ENOENT',
        path: '/secret/location'
      })
      const error = new ResponseError(original)
      expect(error.status).toBe(404)
      expect(error.data).toEqual({ code: 'ENOENT' })
      // Other properties are not leaked into the response data:
      expect(error.toJSON()).toEqual({
        message: 'Missing file',
        code: 'ENOENT'
      })
    })

    it('ignores `status` and `code` when they are null', () => {
      const original = Object.assign(new Error('Odd'), {
        status: null,
        code: null
      })
      const error = new ResponseError(original)
      expect(error.status).toBe(500)
      expect(error.data).toBeUndefined()
    })

    it('copies the JSON data of wrapped response errors', () => {
      const original = new ResponseError({
        message: 'Author not found',
        status: 404,
        authorId: 3
      })
      const error = new ResponseError(original, {
        message: 'Lookup failed',
        status: 400
      })
      expect(error.message).toBe('Author not found')
      expect(error.status).toBe(404)
      expect(error.data).toEqual({ authorId: 3 })
      expect(error.cause).toBe(original)
    })

    it('copies the status of wrapped subclass errors', () => {
      const original = new NotFoundError()
      const error = new ResponseError(original)
      expect(error.message).toBe('Not-found error')
      expect(error.status).toBe(404)
    })
  })

  it('treats falsy errors like no error', () => {
    for (const value of [null, undefined, 0, false]) {
      const error = new ResponseError(value)
      expect(error.message).toBe('Response error')
      expect(error.status).toBe(500)
    }
  })
})
