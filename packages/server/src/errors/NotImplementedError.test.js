import { NotImplementedError } from './NotImplementedError.js'

describe('NotImplementedError', () => {
  it('responds with status 501 Not Implemented', () => {
    const error = new NotImplementedError()
    expect(error.status).toBe(501)
    expect(error.message).toBe('Method not implemented')
  })
})
