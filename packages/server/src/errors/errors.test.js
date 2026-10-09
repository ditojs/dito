import {
  AssetError,
  AuthenticationError,
  AuthorizationError,
  ControllerError,
  GraphError,
  ModelError,
  NotFoundError,
  NotImplementedError,
  QueryBuilderError,
  ResponseError,
  ValidationError
} from './index.js'

describe('ResponseError subclasses', () => {
  it.each([
    [AssetError, 'Asset error', 400],
    [AuthenticationError, 'Authentication error', 401],
    [AuthorizationError, 'Unauthorized Access', 401],
    [GraphError, 'Graph error', 400],
    [NotFoundError, 'Not-found error', 404],
    [NotImplementedError, 'Method not implemented', 501],
    [QueryBuilderError, 'Query-builder error', 400],
    [ValidationError, 'Validation error', 400]
  ])('%o defaults to %o with status %i', (ErrorClass, message, status) => {
    const error = new ErrorClass()
    expect(error).toBeInstanceOf(ResponseError)
    expect(error.message).toBe(message)
    expect(error.status).toBe(status)
  })

  it('lets the error object override the default status', () => {
    const error = new ValidationError({
      message: 'The title is required',
      status: 422,
      errors: { title: [{ keyword: 'required' }] }
    })
    expect(error.message).toBe('The title is required')
    expect(error.status).toBe(422)
    expect(error.data).toEqual({ errors: { title: [{ keyword: 'required' }] } })
  })

  it('supports custom application error classes', () => {
    class ConflictError extends ResponseError {
      constructor(error) {
        super(error, { message: 'Conflict', status: 409 })
      }
    }
    expect(new ConflictError().status).toBe(409)
    expect(new ConflictError('Already borrowed').message).toBe(
      'Already borrowed'
    )
  })
})

describe('ModelError', () => {
  class Book {}

  it('prefixes the message with the name of a model class', () => {
    const error = new ModelError(Book, 'Invalid shelf')
    expect(error.message).toBe(`Model 'Book': Invalid shelf`)
    expect(error.status).toBe(400)
  })

  it('takes the name of the class of a model instance', () => {
    const error = new ModelError(new Book(), 'Invalid shelf')
    expect(error.message).toBe(`Model 'Book': Invalid shelf`)
  })
})

describe('ControllerError', () => {
  class LibraryController {}

  it('prefixes the message with the name of a controller class', () => {
    const error = new ControllerError(LibraryController, 'Missing action')
    expect(error.message).toBe('Controller LibraryController: Missing action')
    expect(error.status).toBe(400)
  })

  it('takes the name of the class of a controller instance', () => {
    const error = new ControllerError(new LibraryController(), 'Oops')
    expect(error.message).toBe('Controller LibraryController: Oops')
  })
})
