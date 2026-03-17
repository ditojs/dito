import type { ModelProperties } from '@ditojs/server'
import { Model, ModelController, Validator } from '@ditojs/server'
import {
  createTestApp,
  getAppUrl
} from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Item extends Model {
  declare id: number
  declare name: string
  declare score: number

  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    },
    score: {
      type: 'integer',
      range: [0, 100]
    }
  }
}

class Items extends ModelController<Item> {
  override modelClass = Item

  override collection = {
    allow: ['get', 'post'] as const
  }
}

describe('Validator — built-in keywords', () => {
  it('rejects score outside range', async () => {
    const app = createTestApp({
      models: { Item },
      controllers: { Items }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const resp = await fetch(`${url}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', score: 200 })
      })
      expect(resp.status).toBe(400)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('accepts score within range', async () => {
    const app = createTestApp({
      models: { Item },
      controllers: { Items }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const resp = await fetch(`${url}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', score: 50 })
      })
      expect(resp.status).toBe(201)
      expect(await resp.json()).toMatchObject({ name: 'test', score: 50 })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('rejects missing required field', async () => {
    const app = createTestApp({
      models: { Item },
      controllers: { Items }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const resp = await fetch(`${url}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 50 })
      })
      expect(resp.status).toBe(400)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})

describe('Validator — custom keywords', () => {
  it('validates with a custom keyword', async () => {
    const validator = new Validator({
      keywords: {
        evenOnly: {
          type: ['integer', 'number'],
          validate(_schema: boolean, value: number) {
            return value % 2 === 0
          }
        }
      }
    })

    class EvenItem extends Model {
      declare id: number
      declare value: number

      static override properties: ModelProperties = {
        value: {
          type: 'integer',
          evenOnly: true
        }
      }
    }

    class EvenItems extends ModelController<EvenItem> {
      override modelClass = EvenItem
      override collection = {
        allow: ['get', 'post'] as const
      }
    }

    const app = createTestApp({
      models: { EvenItem },
      controllers: { EvenItems },
      validator
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)

      // Odd number should be rejected
      const odd = await fetch(`${url}/even-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 3 })
      })
      expect(odd.status).toBe(400)

      // Even number should be accepted
      const even = await fetch(`${url}/even-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 4 })
      })
      expect(even.status).toBe(201)
      expect(await even.json()).toMatchObject({ value: 4 })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})

describe('Validator — custom formats', () => {
  it('validates with a custom format', async () => {
    const validator = new Validator({
      formats: {
        'starts-with-hello': {
          type: 'string',
          validate: (value: string) => value.startsWith('hello')
        }
      }
    })

    class Greeting extends Model {
      declare id: number
      declare message: string

      static override properties: ModelProperties = {
        message: {
          type: 'string',
          format: 'starts-with-hello',
          required: true
        }
      }
    }

    class Greetings extends ModelController<Greeting> {
      override modelClass = Greeting
      override collection = {
        allow: ['get', 'post'] as const
      }
    }

    const app = createTestApp({
      models: { Greeting },
      controllers: { Greetings },
      validator
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)

      // Wrong format should be rejected
      const bad = await fetch(`${url}/greetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'goodbye world' })
      })
      expect(bad.status).toBe(400)

      // Correct format should be accepted
      const good = await fetch(`${url}/greetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello world' })
      })
      expect(good.status).toBe(201)
      expect(await good.json()).toMatchObject({ message: 'hello world' })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('validates with a regex format and custom message', async () => {
    const validator = new Validator({
      formats: {
        sha1: {
          validate: /^[a-f0-9]{40}$/,
          message: 'needs to be in SHA-1 format'
        }
      }
    })

    class Hash extends Model {
      declare id: number
      declare value: string

      static override properties: ModelProperties = {
        value: {
          type: 'string',
          format: 'sha1',
          required: true
        }
      }
    }

    class Hashes extends ModelController<Hash> {
      override modelClass = Hash
      override collection = {
        allow: ['get', 'post'] as const
      }
    }

    const app = createTestApp({
      models: { Hash },
      controllers: { Hashes },
      validator
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)

      // Invalid SHA-1 should be rejected with custom message
      const bad = await fetch(`${url}/hashes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'not-a-sha1' })
      })
      expect(bad.status).toBe(400)
      const errors = await bad.json()
      expect(JSON.stringify(errors)).toContain('needs to be in SHA-1 format')

      // Valid SHA-1 should be accepted
      const good = await fetch(`${url}/hashes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' })
      })
      expect(good.status).toBe(201)
      expect(await good.json()).toMatchObject({
        value: 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
      })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})
