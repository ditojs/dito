import Koa from 'koa'
import { handleError } from './handleError.js'
import { ResponseError } from '../errors/index.js'

async function request(handler, path = '/', headers = {}) {
  const app = new Koa()
  const errors = []
  app.on('error', error => errors.push(error))
  app.use(handleError())
  app.use(handler)
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const { port } = server.address()
    const response = await fetch(`http://localhost:${port}${path}`, {
      headers
    })
    return { response, text: await response.text(), errors }
  } finally {
    server.close()
  }
}

describe('handleError()', () => {
  it('responds with the JSON representation of response errors', async () => {
    const error = new ResponseError('Out of print', { status: 410 })
    const { response, text, errors } = await request(() => {
      throw error
    })
    expect(response.status).toBe(410)
    expect(JSON.parse(text)).toEqual(error.toJSON())
    expect(errors).toEqual([error])
  })

  it('responds with the message of other errors and status 500', async () => {
    const { response, text } = await request(() => {
      throw new Error('Shelf collapsed')
    })
    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({ message: 'Shelf collapsed' })
  })

  it('responds with a default message for errors without message', async () => {
    const { response, text } = await request(() => {
      throw Object.assign(new Error(), { status: 409 })
    })
    expect(response.status).toBe(409)
    expect(JSON.parse(text)).toEqual({ message: 'An error has occurred.' })
  })

  it('responds without body when JSON is not accepted', async () => {
    const { response, text, errors } = await request(
      () => {
        throw new Error('Shelf collapsed')
      },
      '/',
      { accept: 'image/png' }
    )
    expect(response.status).toBe(500)
    expect(text).toBe('Internal Server Error')
    expect(errors).toHaveLength(1)
  })

  it('responds without JSON body for requests of scripts', async () => {
    const { response, text } = await request(() => {
      throw new Error('Missing module')
    }, '/catalog.js')
    expect(response.status).toBe(500)
    expect(text).toBe('Internal Server Error')
  })
})
