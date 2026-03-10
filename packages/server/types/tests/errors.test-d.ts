import { expectTypeOf, describe, it } from 'vitest'
import type {
  ResponseError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ControllerError,
  AuthorizationError,
  AuthenticationError,
  ModelError,
  GraphError
} from '../index.d.ts'

describe('Errors', () => {
  it('ResponseError has status and is an Error', () => {
    const err = {} as ResponseError
    expectTypeOf(err.status).toBeNumber()
    expectTypeOf(err.message).toBeString()
    expectTypeOf(err).toMatchTypeOf<Error>()
  })

  it('NotFoundError extends ResponseError', () => {
    expectTypeOf<NotFoundError>().toMatchTypeOf<ResponseError>()
  })

  it('ValidationError extends ResponseError', () => {
    expectTypeOf<ValidationError>().toMatchTypeOf<ResponseError>()
  })

  it('DatabaseError extends ResponseError', () => {
    expectTypeOf<DatabaseError>().toMatchTypeOf<ResponseError>()
  })

  it('ControllerError extends ResponseError', () => {
    expectTypeOf<ControllerError>().toMatchTypeOf<ResponseError>()
  })

  it('AuthorizationError extends ResponseError', () => {
    expectTypeOf<AuthorizationError>().toMatchTypeOf<ResponseError>()
  })

  it('AuthenticationError extends ResponseError', () => {
    expectTypeOf<AuthenticationError>().toMatchTypeOf<ResponseError>()
  })

  it('GraphError extends ResponseError', () => {
    expectTypeOf<GraphError>().toMatchTypeOf<ResponseError>()
  })

  it('ModelError extends ResponseError', () => {
    expectTypeOf<ModelError>().toMatchTypeOf<ResponseError>()
  })
})
