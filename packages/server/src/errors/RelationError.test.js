import { RelationError } from './RelationError.js'

describe('RelationError', () => {
  it('uses the default message and status 400', () => {
    const error = new RelationError()
    expect(error.message).toBe('Relation error')
    expect(error.status).toBe(400)
  })

  it('accepts a string message', () => {
    const error = new RelationError('Unknown relation: authors')
    expect(error.message).toBe('Unknown relation: authors')
    expect(error.status).toBe(400)
  })

  it('refers to `relations` instead of `relationMappings` in messages', () => {
    const original = new Error(
      'Book.relationMappings.author: cannot find the model'
    )
    const error = new RelationError(original)
    expect(error.message).toBe('Book.relations.author: cannot find the model')
    expect(error.stack).toContain('Book.relations.author')
    expect(error.stack).not.toMatch(/\brelationMappings\b/)
    expect(error.cause).toBe(original)
  })

  it('does not replace partial word matches', () => {
    const error = new RelationError(new Error('myrelationMappings stay'))
    expect(error.message).toBe('myrelationMappings stay')
  })

  it('handles errors without a stack', () => {
    const original = new Error('relationMappings broken')
    original.stack = undefined
    const error = new RelationError(original)
    expect(error.message).toBe('relations broken')
    // Without an override, the error keeps its own stack.
    expect(error.stack).toContain('relations broken')
  })
})
