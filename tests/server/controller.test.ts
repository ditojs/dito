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
        'allow': ['get'],
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
        'allow': ['get'],
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
        'allow': ['get', 'post test'],
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

describe('Controller action verbs', () => {
  it('rejects action names whose verb is a Router member', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        // @ts-expect-error `all` is a Router method, not an HTTP method
        all() {
          return { ok: true }
        }
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    try {
      await expect(app.setup()).rejects.toThrow(
        /Unsupported HTTP method 'all'/
      )
    } finally {
      await app.knex?.destroy()
    }
  })
})

describe('ModelController modelClass', () => {
  it('resolves the model class with the `Model` suffix', async () => {
    class ProjectModel extends Model {
      declare id: number
    }

    class Projects extends ModelController<ProjectModel> {
      override collection: ModelControllerActions<Projects> = {
        allow: ['get']
      }
    }

    const app = createTestApp({
      models: { ProjectModel },
      controllers: { Projects }
    })

    await createTestDatabase(app)
    try {
      await app.setup()
      expect(app.getController('/projects')).toMatchObject({
        modelClass: ProjectModel
      })
    } finally {
      await app.knex?.destroy()
    }
  })

  it('throws if the model class cannot be resolved', () => {
    class Unknowns extends ModelController<Task> {}

    expect(() =>
      createTestApp({
        models: { Task },
        controllers: { Unknowns }
      })
    ).toThrow(/Unknowns: Unable to resolve the model class/)
  })
})

describe('Controller action definitions', () => {
  it(`doesn't inherit settings from the parent actions object`, async () => {
    class BaseTasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<BaseTasks> = {
        'authorize': { 'get secret': false } as any,
        'get secret'() {
          return { secret: true }
        }
      }
    }

    class Tasks extends BaseTasks {
      override collection: ModelControllerActions<Tasks> = {
        'get open': {
          handler() {
            return { open: true }
          }
        } as any
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const resp = await fetch(`${getAppUrl(app)}/tasks/open`)
      expect(resp.status).toBe(200)
      expect(await resp.json()).toEqual({ open: true })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })

  it('exposes the query without the consumed parameters', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        'get filtered-query': {
          parameters: { flag: { type: 'boolean' } },
          handler(ctx: any, { flag }: { flag: boolean }) {
            return { flag, filteredQuery: ctx.filteredQuery }
          }
        } as any
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const resp = await fetch(
        `${getAppUrl(app)}/tasks/filtered-query?flag=true&name=Task`
      )
      expect(await resp.json()).toEqual({
        flag: true,
        filteredQuery: { name: 'Task' }
      })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})

describe('Controller logger', () => {
  it('binds the logger to each request', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        'get request-id'() {
          return { requestId: this.logger.bindings().requestId }
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
      const fetchRequestId = async () => {
        const resp = await fetch(`${url}/tasks/request-id`)
        return (await resp.json()).requestId
      }
      const first = await fetchRequestId()
      const second = await fetchRequestId()
      expect(first).toEqual(expect.any(String))
      expect(second).toEqual(expect.any(String))
      expect(second).not.toBe(first)
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})

describe('Controller handler definitions', () => {
  it('passes extra action settings on to the action', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        'get cached': {
          cached: true,
          handler(ctx: any) {
            return { cached: ctx.action.cached }
          }
        } as any
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      const resp = await fetch(`${getAppUrl(app)}/tasks/cached`)
      expect(await resp.json()).toEqual({ cached: true })
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})

describe('Controller collection updates', () => {
  it('rejects non-array bodies as invalid requests', async () => {
    class Tasks extends ModelController<Task> {
      override modelClass = Task

      override collection: ModelControllerActions<Tasks> = {
        allow: ['put', 'patch']
      }
    }

    const app = createTestApp({
      models: { Task },
      controllers: { Tasks }
    })

    await createTestDatabase(app)
    await app.start()

    try {
      for (const method of ['PUT', 'PATCH']) {
        const resp = await fetch(`${getAppUrl(app)}/tasks`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 1, name: 'Task' })
        })
        expect(resp.status).toBe(400)
        expect(await resp.json()).toEqual({
          type: 'BodyValidation',
          message: 'Updating a collection requires an array of models'
        })
      }
    } finally {
      await app.stop()
      await app.knex?.destroy()
    }
  })
})
