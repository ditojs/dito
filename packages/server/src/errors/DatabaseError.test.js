import {
  DBError,
  DataError,
  CheckViolationError,
  NotNullViolationError,
  ConstraintViolationError,
  UniqueViolationError,
  ForeignKeyViolationError
} from 'objection'
import { DatabaseError } from './DatabaseError.js'

function createDBError(ErrorClass, message = 'Native error') {
  return new ErrorClass({
    nativeError: Object.assign(new Error(message), { code: '23505' }),
    client: 'postgres'
  })
}

describe('DatabaseError', () => {
  it.each([
    [CheckViolationError, 400],
    [NotNullViolationError, 400],
    [UniqueViolationError, 409],
    [ForeignKeyViolationError, 409],
    [ConstraintViolationError, 409],
    [DataError, 400],
    [DBError, 500]
  ])('maps %o to status %i', (ErrorClass, status) => {
    const error = new DatabaseError(createDBError(ErrorClass))
    expect(error.status).toBe(status)
    expect(error.data).toEqual({ type: ErrorClass.name })
  })

  it('uses status 400 for errors that are not database errors', () => {
    const error = new DatabaseError(new Error('Not from the database'))
    expect(error.status).toBe(400)
    expect(error.message).toBe('Not from the database')
    expect(error.data).toEqual({ type: 'Error' })
  })

  it('takes the message from the database error', () => {
    const error = new DatabaseError(
      createDBError(UniqueViolationError, 'duplicate key value')
    )
    expect(error.message).toBe('duplicate key value')
    expect(error.toJSON()).toEqual({
      message: 'duplicate key value',
      type: 'UniqueViolationError'
    })
  })

  it('applies overrides', () => {
    const error = new DatabaseError(createDBError(DBError), {
      message: 'Could not store the book',
      status: 503
    })
    expect(error.message).toBe('Could not store the book')
    expect(error.status).toBe(503)
  })

  // Bug: `getErrorObject()` always sets `cause` to the wrapped error, which
  // overrides the `cause: error.nativeError` default of `DatabaseError`.
  test.fails('passes on the native error as the cause', () => {
    const dbError = createDBError(DBError)
    const error = new DatabaseError(dbError)
    expect(error.cause).toBe(dbError.nativeError)
  })
})
