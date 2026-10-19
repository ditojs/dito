import Koa from 'koa'
import { handleError } from './handleError.js'
import { ResponseError } from '../errors/index.js'

async function request(handler, path = '/', headers = {}, options) {
  const app = new Koa()
  const errors = []
  app.on('error', error => errors.push(error))
  app.use(handleError(options))
  app.use(handler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
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

  it('hides the message of other errors and responds with status 500', async () => {
    const error = new Error('Shelf collapsed')
    const { response, text, errors } = await request(() => {
      throw error
    })
    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({ message: 'An error has occurred.' })
    expect(errors).toEqual([error])
  })

  it('responds with the message of other errors when exposing messages', async () => {
    const { response, text } = await request(
      () => {
        throw new Error('Shelf collapsed')
      },
      '/',
      {},
      { exposeMessages: true }
    )
    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({ message: 'Shelf collapsed' })
  })

  it('hides the message and data of response errors marked as not exposed', async () => {
    const { response, text } = await request(() => {
      throw new ResponseError({
        message: 'Catalog server down',
        status: 503,
        host: 'catalog.internal',
        expose: false
      })
    })
    expect(response.status).toBe(503)
    expect(JSON.parse(text)).toEqual({ message: 'An error has occurred.' })
  })

  it('responds with the message of errors marked as exposed', async () => {
    const { response, text } = await request(ctx => {
      ctx.throw(404, 'Shelf not found')
    })
    expect(response.status).toBe(404)
    expect(JSON.parse(text)).toEqual({ message: 'Shelf not found' })
  })

  it('responds with the message of other errors with client status', async () => {
    const { response, text } = await request(() => {
      throw Object.assign(new Error('Shelf is full'), { status: 409 })
    })
    expect(response.status).toBe(409)
    expect(JSON.parse(text)).toEqual({ message: 'Shelf is full' })
  })

  it('hides the message of errors marked as not exposed', async () => {
    const { response, text } = await request(() => {
      throw Object.assign(new Error('Shelf at shelves.internal is full'), {
        status: 409,
        expose: false
      })
    })
    expect(response.status).toBe(409)
    expect(JSON.parse(text)).toEqual({ message: 'An error has occurred.' })
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
