import type {
  ModelControllerActions,
  ModelProperties
} from '@ditojs/server'
import { Model, ModelController } from '@ditojs/server'
import {
  createTestApp,
  getAppUrl
} from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Task extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    }
  }
}

describe('Controller action names', () => {
  it('rejects bare action names like "test"', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        allow: ['get'],
        // @ts-expect-error bare action name is intentionally invalid
        test(ctx) {
          return { ok: true }
        }
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await expect(app.setup()).rejects.toThrow(/Unsupported HTTP method/)
    await app.knex?.destroy()
  })

  it('does not route default actions when allow is omitted', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {}
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const resp = await fetch(`${url}/tasks`)
      expect(resp.status).toBe(404)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('routes default actions listed in allow', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        allow: ['get']
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const resp = await fetch(`${url}/tasks`)
      expect(resp.status).toBe(200)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('returns 501 for default actions not in allow list', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        allow: ['get']
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      // POST (create) is not in allow list
      const resp = await fetch(`${url}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' })
      })
      expect(resp.status).toBe(501)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('child allow replaces parent — parent actions need re-listing', async () => {
    class BaseTasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<BaseTasks> = {
        allow: ['get'],
        'get stats'(ctx) {
          ctx.body = { count: 0 }
        }
      }
    }

    class Tasks extends BaseTasks {
      override collection: ModelControllerActions<Tasks> = {
        // Only lists 'get', does NOT list 'get stats'
        allow: ['get']
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      // Default 'get' works
      const get = await fetch(`${url}/tasks`)
      expect(get.status).toBe(200)
      // Parent's 'get stats' is NOT routed because child's
      // allow replaced the allowMap without listing it
      const stats = await fetch(`${url}/tasks/stats`)
      expect(stats.status).toBe(404)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('parent actions are routed when child has no allow', async () => {
    class BaseTasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<BaseTasks> = {
        allow: ['get'],
        'get stats'(ctx) {
          ctx.body = { count: 0 }
        }
      }
    }

    class Tasks extends BaseTasks {
      // No override — inherits parent's collection
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const stats = await fetch(`${url}/tasks/stats`)
      expect(stats.status).toBe(200)
      expect(await stats.json()).toEqual({ count: 0 })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('accepts and routes "post test" action', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        allow: ['get', 'post test'],
        'post test'(ctx) {
          ctx.body = { ok: true }
        }
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const url = getAppUrl(app)
      const resp = await fetch(`${url}/tasks/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(resp.status).toBe(200)
      expect(await resp.json()).toEqual({ ok: true })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})
