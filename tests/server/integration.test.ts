import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Task extends Model {
  declare id: number
  declare name: string
  declare done: boolean

  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    },
    done: {
      type: 'boolean'
    }
  }
}

class Tag extends Model {
  declare id: number
  declare label: string
  declare tasks: Task[]

  static override properties: ModelProperties = {
    label: {
      type: 'string',
      required: true
    }
  }

  static override relations = {
    tasks: {
      relation: 'manyToMany' as const,
      from: 'Tag.id',
      to: 'Task.id'
    }
  }
}

describe('PGlite integration', () => {
  const app = createTestApp({
    models: { Task, Tag }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.knex.schema.createTable(
      'TagTask',
      table => {
        table.increments('id').primary()
        table
          .integer('tagId')
          .unsigned()
          .references('id')
          .inTable('Tag')
        table
          .integer('taskId')
          .unsigned()
          .references('id')
          .inTable('Task')
      }
    )
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  afterEach(async () => {
    await app.knex('TagTask').del()
    await app.knex('Tag').del()
    await app.knex('Task').del()
  })

  it('should insert and query a model', async () => {
    await Task.query().insert({
      name: 'Write tests',
      done: false
    })
    const tasks = await Task.query()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).toBe('Write tests')
    expect(tasks[0].done).toBe(false)
  })

  it('should update a model', async () => {
    const task = await Task.query().insert({
      name: 'Update me',
      done: false
    })
    await Task.query()
      .findById(task.id)
      .patch({ done: true })
    const updated = await Task.query().findById(
      task.id
    )
    expect(updated!.done).toBe(true)
  })

  it('should delete a model', async () => {
    const task = await Task.query().insert({
      name: 'Delete me'
    })
    await Task.query().deleteById(task.id)
    const result = await Task.query()
    expect(result).toHaveLength(0)
  })

  it('should support relations', async () => {
    const task = await Task.query().insert({
      name: 'Tagged task',
      done: false
    })
    const tag = await Tag.query().insert({
      label: 'urgent'
    })
    await app.knex('TagTask').insert({
      tagId: tag.id,
      taskId: task.id
    })
    const tagWithTasks = await Tag.query()
      .findById(tag.id)
      .withGraphFetched('tasks')
    expect(tagWithTasks!.tasks).toHaveLength(1)
    expect(tagWithTasks!.tasks[0].name).toBe(
      'Tagged task'
    )
  })

  it('should support transactions', async () => {
    const trx = await app.knex.transaction()
    try {
      await Task.query(trx).insert({
        name: 'In transaction'
      })
      await trx.rollback()
    } catch {
      await trx.rollback()
    }
    const tasks = await Task.query()
    expect(tasks).toHaveLength(0)
  })
})
