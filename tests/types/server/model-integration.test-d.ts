import {
  assertType,
  expectTypeOf,
  describe,
  it
} from 'vitest'
import type {
  Application,
  ModelProperties,
  ModelProperty,
  ModelRelations,
  ModelRelation,
  ModelFilter,
  ModelFilters,
  QueryFilterTypes,
  Storage,
  KoaContext
} from '@ditojs/server'
import { Model, Service } from '@ditojs/server'
import type * as ModelsType from '../../server/models'
import { Task, Tag } from '../../server/models'

interface MailConfig {
  smtp: { host: string; port: number }
  from: string
}

class MailService extends Service<MailConfig> {
  send(_to: string, _body: string): boolean { return true }
}

declare module '@ditojs/server' {
  interface QueryFilterTypes {
    'country': true
  }
  interface ApplicationServices {
    mail: MailService
  }
  interface ApplicationConfig {
    externalUrls?: {
      frontend: string
      backend: string
    }
  }
  interface ApplicationStorages {
    s3: Storage
  }
  interface KoaContextState {
    user: { id: number; role: string }
  }
}

describe('ModelProperties<T> — typed property keys', () => {
  it('accepts valid properties with type arg', () => {
    class _Good extends Model {
      declare name: string

      static override properties: ModelProperties<_Good> = {
        name: { type: 'string' }
      }
    }
  })

  it('rejects unknown property keys', () => {
    class _Bad extends Model {
      declare name: string

      static override properties: ModelProperties<_Bad> = {
        name: { type: 'string' },
        // @ts-expect-error - 'unknown' is not a declared property
        unknown: { type: 'string' }
      }
    }
  })

  it('allows subclass to add properties', () => {
    class _Base extends Model {
      declare name: string

      static override properties: ModelProperties<_Base> = {
        name: { type: 'string' }
      }
    }

    class _Sub extends _Base {
      declare extra: number

      static override properties: ModelProperties<_Sub> = {
        name: { type: 'string' },
        extra: { type: 'integer' }
      }
    }
  })

  it('rejects string type for number field', () => {
    class _Bad extends Model {
      declare a: number

      static override properties: ModelProperties<_Bad> = {
        // @ts-expect-error - a is number, not string
        a: { type: 'string' }
      }
    }
  })

  it('rejects mismatched schema type for string', () => {
    class _Bad extends Model {
      declare name: string

      static override properties: ModelProperties<_Bad> = {
        // @ts-expect-error - name is string, not boolean
        name: { type: 'boolean' }
      }
    }
  })

  it('rejects mismatched schema type for boolean', () => {
    class _Bad extends Model {
      declare done: boolean

      static override properties: ModelProperties<_Bad> = {
        // @ts-expect-error - done is boolean, not string
        done: { type: 'string' }
      }
    }
  })

  it('rejects mismatched schema type for number', () => {
    class _Bad extends Model {
      declare count: number

      static override properties: ModelProperties<_Bad> = {
        // @ts-expect-error - count is number, not string
        count: { type: 'string' }
      }
    }
  })

  it('accepts integer for number field', () => {
    class _Good extends Model {
      declare count: number

      static override properties: ModelProperties<_Good> = {
        count: { type: 'integer' }
      }
    }
  })

  it('accepts text for string field', () => {
    class _Good extends Model {
      declare bio: string

      static override properties: ModelProperties<_Good> = {
        bio: { type: 'text' }
      }
    }
  })

  it('allows partial properties (not all keys required)', () => {
    class _Partial extends Model {
      declare name: string
      declare done: boolean

      static override properties: ModelProperties<_Partial> = {
        name: { type: 'string' }
      }
    }
  })
})

describe('Model properties — override without annotation', () => {
  it('override rejects invalid property values', () => {
    // @ts-expect-error - type must be a string
    class _Bad extends Model {
      static override properties = {
        bad: { type: 123 }
      }
    }
  })

  it('definition.properties is ModelProperties', () => {
    expectTypeOf(Task.definition.properties)
      .not.toBeAny()
    expectTypeOf(Task.definition.properties)
      .toEqualTypeOf<ModelProperties>()
  })

  it('inferred relations are assignable to ModelRelations', () => {
    assertType<ModelRelations>(Tag.relations)
  })

  it('definition.relations is ModelRelations', () => {
    expectTypeOf(Tag.definition.relations)
      .not.toBeAny()
    expectTypeOf(Tag.definition.relations)
      .toEqualTypeOf<ModelRelations>()
  })
})

describe('Model properties — shared', () => {
  it('accepts property with database modifiers', () => {
    assertType<ModelProperties>({
      id: {
        type: 'integer',
        primary: true,
        unsigned: true
      },
      userId: {
        type: 'integer',
        foreign: true,
        index: true,
        nullable: true
      },
      email: {
        type: 'string',
        unique: true
      }
    })
  })

  it('accepts grouped unique constraint', () => {
    assertType<ModelProperties>({
      first: { type: 'string', unique: 'name' },
      last: { type: 'string', unique: 'name' }
    })
  })

  it('rejects property with invalid type value', () => {
    assertType<ModelProperties>({
      // @ts-expect-error - type must be a string
      bad: { type: 123 }
    })
  })
})

describe('ModelRelations<T> — typed relation keys', () => {
  it('accepts valid relation with type arg', () => {
    class _Good extends Model {
      declare items: Task[]

      static override relations: ModelRelations<_Good> = {
        items: {
          relation: 'hasMany',
          from: '_Good.id',
          to: 'Task.goodId'
        }
      }
    }
  })

  it('rejects unknown relation keys', () => {
    class _Bad extends Model {
      declare items: Task[]

      static override relations: ModelRelations<_Bad> = {
        items: {
          relation: 'hasMany',
          from: '_Bad.id',
          to: 'Task.badId'
        },
        // @ts-expect-error - 'nope' is not a declared property
        nope: {
          relation: 'hasMany',
          from: '_Bad.id',
          to: 'Task.badId'
        }
      }
    }
  })

  it('rejects non-relation properties as keys', () => {
    class _Bad extends Model {
      declare name: string
      declare items: Task[]

      static override relations: ModelRelations<_Bad> = {
        // @ts-expect-error - name is string, not a relation
        name: {
          relation: 'hasMany',
          from: '_Bad.id',
          to: 'Task.badId'
        }
      }
    }
  })

  it('allows partial relations', () => {
    class _Partial extends Model {
      declare items: Task[]
      declare tags: Tag[]

      static override relations: ModelRelations<_Partial> = {
        items: {
          relation: 'hasMany',
          from: '_Partial.id',
          to: 'Task.partialId'
        }
      }
    }
  })

  it('accepts hasOne relation for single model', () => {
    class _Good extends Model {
      declare profile: Task

      static override relations: ModelRelations<_Good> = {
        profile: {
          relation: 'hasOne',
          from: '_Good.id',
          to: 'Task.goodId'
        }
      }
    }
  })
})

describe('ModelRelations<T> — relation type narrowing', () => {
  it('accepts hasMany for array property', () => {
    class _Good extends Model {
      declare items: Task[]

      static override relations: ModelRelations<_Good> = {
        items: {
          relation: 'hasMany',
          from: '_Good.id',
          to: 'Task.goodId'
        }
      }
    }
  })

  it('accepts manyToMany for array property', () => {
    class _Good extends Model {
      declare items: Task[]

      static override relations: ModelRelations<_Good> = {
        items: {
          relation: 'manyToMany',
          from: '_Good.id',
          to: 'Task.id'
        }
      }
    }
  })

  it('rejects hasOne for array property', () => {
    class _Bad extends Model {
      declare items: Task[]

      static override relations: ModelRelations<_Bad> = {
        items: {
          // @ts-expect-error - array property can't be hasOne
          relation: 'hasOne',
          from: '_Bad.id',
          to: 'Task.badId'
        }
      }
    }
  })

  it('rejects belongsTo for array property', () => {
    class _Bad extends Model {
      declare items: Task[]

      static override relations: ModelRelations<_Bad> = {
        items: {
          // @ts-expect-error - array property can't be belongsTo
          relation: 'belongsTo',
          from: '_Bad.id',
          to: 'Task.badId'
        }
      }
    }
  })

  it('accepts belongsTo for single model', () => {
    class _Good extends Model {
      declare task: Task

      static override relations: ModelRelations<_Good> = {
        task: {
          relation: 'belongsTo',
          from: '_Good.id',
          to: 'Task.id'
        }
      }
    }
  })

  it('rejects hasMany for single model', () => {
    class _Bad extends Model {
      declare task: Task

      static override relations: ModelRelations<_Bad> = {
        task: {
          // @ts-expect-error - single model can't be hasMany
          relation: 'hasMany',
          from: '_Bad.id',
          to: 'Task.badId'
        }
      }
    }
  })

  it('rejects manyToMany for single model', () => {
    class _Bad extends Model {
      declare task: Task

      static override relations: ModelRelations<_Bad> = {
        task: {
          // @ts-expect-error - single model can't be manyToMany
          relation: 'manyToMany',
          from: '_Bad.id',
          to: 'Task.id'
        }
      }
    }
  })
})

// Models map for typed from/to tests
type TestModels = {
  Task: typeof Task
  Tag: typeof Tag
}

describe('ModelRelations<T, Models> — typed from/to', () => {
  it('accepts valid from/to strings', () => {
    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good, TestModels & {
          _Good: typeof _Good
        }> = {
          tasks: {
            relation: 'hasMany',
            from: '_Good.id',
            to: 'Task.id'
          }
        }
    }
  })

  it('rejects invalid from model name', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad, TestModels & {
          _Bad: typeof _Bad
        }> = {
          tasks: {
            relation: 'hasMany',
            // @ts-expect-error - 'Wrong' is not a model name
            from: 'Wrong.id',
            to: 'Task.id'
          }
        }
    }
  })

  it('rejects invalid to model name', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad, TestModels & {
          _Bad: typeof _Bad
        }> = {
          tasks: {
            relation: 'hasMany',
            from: '_Bad.id',
            // @ts-expect-error - 'Wrong' is not a model name
            to: 'Wrong.id'
          }
        }
    }
  })

  it('rejects invalid property name in from', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad, TestModels & {
          _Bad: typeof _Bad
        }> = {
          tasks: {
            relation: 'hasMany',
            // @ts-expect-error - 'nope' is not a property of _Bad
            from: '_Bad.nope',
            to: 'Task.id'
          }
        }
    }
  })

  it('rejects invalid property name in to', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad, TestModels & {
          _Bad: typeof _Bad
        }> = {
          tasks: {
            relation: 'hasMany',
            from: '_Bad.id',
            // @ts-expect-error - 'nope' is not a property of Task
            to: 'Task.nope'
          }
        }
    }
  })

  it('to references related model properties', () => {
    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good, TestModels & {
          _Good: typeof _Good
        }> = {
          tasks: {
            relation: 'hasMany',
            from: '_Good.id',
            to: 'Task.name'
          }
        }
    }
  })
})

describe('ModelRelations<T, Models> — typed through', () => {
  it('accepts valid through with known model', () => {
    class TagTask extends Model {
      declare tagId: number
      declare taskId: number
    }

    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good, TestModels & {
          _Good: typeof _Good
          TagTask: typeof TagTask
        }> = {
          tasks: {
            relation: 'manyToMany',
            from: '_Good.id',
            to: 'Task.id',
            through: {
              from: 'TagTask.tagId',
              to: 'TagTask.taskId'
            }
          }
        }
    }
  })

  it('accepts through with unknown table name', () => {
    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good, TestModels & {
          _Good: typeof _Good
        }> = {
          tasks: {
            relation: 'manyToMany',
            from: '_Good.id',
            to: 'Task.id',
            through: {
              from: 'goodTask.goodId',
              to: 'goodTask.taskId'
            }
          }
        }
    }
  })

  it('rejects through without dot separator', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad, TestModels & {
          _Bad: typeof _Bad
        }> = {
          tasks: {
            relation: 'manyToMany',
            from: '_Bad.id',
            to: 'Task.id',
            through: {
              // @ts-expect-error - must be 'Table.column' format
              from: 'noDot',
              to: 'goodTask.taskId'
            }
          }
        }
    }
  })

  it('accepts through: true for auto-generated join', () => {
    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good, TestModels & {
          _Good: typeof _Good
        }> = {
          tasks: {
            relation: 'manyToMany',
            from: '_Good.id',
            to: 'Task.id',
            through: true
          }
        }
    }
  })
})

describe('ModelRelations<T, Models> — import() as Models', () => {
  it('accepts import type * as ModelsType', () => {
    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good, typeof ModelsType & {
          _Good: typeof _Good
        }> = {
          tasks: {
            relation: 'hasMany',
            from: '_Good.id',
            to: 'Task.id'
          }
        }
    }
  })

  it('rejects invalid from with import type *', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad, typeof ModelsType & {
          _Bad: typeof _Bad
        }> = {
          tasks: {
            relation: 'hasMany',
            // @ts-expect-error - 'Wrong' is not a model name
            from: 'Wrong.id',
            to: 'Task.id'
          }
        }
    }
  })

  it('accepts typeof import() (Promise-wrapped)', () => {
    class _Good extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Good,
          typeof import('../../server/models.ts') & {
            _Good: typeof _Good
          }
        > = {
          tasks: {
            relation: 'hasMany',
            from: '_Good.id',
            to: 'Task.id'
          }
        }
    }
  })

  it('rejects invalid from with typeof import()', () => {
    class _Bad extends Model {
      declare id: number
      declare tasks: Task[]

      static override relations:
        ModelRelations<_Bad,
          typeof import('../../server/models.ts') & {
            _Bad: typeof _Bad
          }
        > = {
          tasks: {
            relation: 'hasMany',
            // @ts-expect-error - 'Wrong' is not a model name
            from: 'Wrong.id',
            to: 'Task.id'
          }
        }
    }
  })
})

describe('QueryFilterTypes — extensible filter registry', () => {
  it('accepts built-in filter types', () => {
    assertType<ModelFilter>({
      filter: 'text',
      properties: ['name']
    })
    assertType<ModelFilter>({
      filter: 'date-range',
      properties: ['createdAt']
    })
  })

  it('rejects unknown filter types', () => {
    assertType<ModelFilter>({
      // @ts-expect-error - 'unknown' is not a registered filter
      filter: 'unknown',
      properties: ['name']
    })
  })

  it('accepts custom filter via module augmentation', () => {
    assertType<ModelFilter>({
      filter: 'country',
      properties: ['count']
    })
  })

  it('accepts handler function filter', () => {
    assertType<ModelFilter>({
      handler: query => {
        void query
      },
      parameters: {
        search: { type: 'string' }
      }
    })
  })

  it('accepts bare function filter', () => {
    assertType<ModelFilter>((query, ...args) => {
      void query
      void args
    })
  })

  it('accepts mixed filters map', () => {
    assertType<ModelFilters>({
      name: {
        filter: 'text',
        properties: ['name']
      },
      search: (query, term) => {
        void query
        void term
      }
    })
  })
})

describe('Model relations — shared', () => {
  it('relation indexer returns ModelRelation', () => {
    const relations = {} as ModelRelations
    expectTypeOf(relations['tasks']).not.toBeAny()
    expectTypeOf(relations['tasks'])
      .toEqualTypeOf<ModelRelation>()
  })

  it('rejects relation missing required fields', () => {
    // @ts-expect-error - from and to are required
    assertType<ModelRelation>({
      relation: 'manyToMany'
    })
  })
})

describe('ModelRelations — static get relations()', () => {
  it('supports getter with dynamic from/to', () => {
    class _Revisioned extends Model {
      declare previous: Model
      declare next: Model

      static override get relations(): ModelRelations<_Revisioned> {
        return {
          previous: {
            relation: 'belongsTo',
            from: `${this.name}.previousId`,
            to: `${this.name}.id`
          },
          next: {
            relation: 'hasOne',
            from: `${this.name}.id`,
            to: `${this.name}.previousId`
          }
        }
      }
    }
  })

  it('this.name is typed as string in static getter', () => {
    class _Check extends Model {
      declare previous: Model

      static override get relations(): ModelRelations<_Check> {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this.name).not.toBeAny()
        expectTypeOf(this.name).toBeString()
        return {
          previous: {
            relation: 'belongsTo',
            from: `${this.name}.id`,
            to: `${this.name}.id`
          }
        }
      }
    }
  })

  it('rejects unknown relation keys in getter', () => {
    class _Bad extends Model {
      declare previous: Model

      static override get relations(): ModelRelations<_Bad> {
        return {
          // @ts-expect-error - 'nope' is not a declared property
          nope: {
            relation: 'belongsTo',
            from: `${this.name}.id`,
            to: `${this.name}.id`
          }
        }
      }
    }
  })
})

describe('Schema<$Value>.validate — typed data param', () => {
  it('data is typed via ModelProperty<T>', () => {
    const prop: ModelProperty<string> = {
      type: 'string',
      validate({ data }) {
        expectTypeOf(data).not.toBeAny()
        expectTypeOf(data).toBeString()
        return true
      }
    }
    assertType<ModelProperty<string>>(prop)
  })

  it('data flows through ModelProperties<T>', () => {
    class _Good extends Model {
      declare name: string

      static override properties: ModelProperties<_Good> = {
        name: {
          type: 'string',
          validate({ data }) {
            expectTypeOf(data).not.toBeAny()
            expectTypeOf(data).toBeString()
            return true
          }
        }
      }
    }
  })

  it('data is number for number property', () => {
    class _Good extends Model {
      declare count: number

      static override properties: ModelProperties<_Good> = {
        count: {
          type: 'integer',
          validate({ data }) {
            expectTypeOf(data).not.toBeAny()
            expectTypeOf(data).toBeNumber()
            return true
          }
        }
      }
    }
  })
})

// Kanel generates interfaces from Postgres tables:
//   type FilmId = number & { __flavor?: 'FilmId' }
//   interface Film {
//     film_id: FilmId
//     title: string
//     description: string | null
//   }
// These can be merged onto Dito Model classes via interface merging,
// so ModelProperties<T> validates schema types against DB-derived types.
describe('DB-driven model definition (Kanel pattern)', () => {
  // Simulates Kanel output from DB schema
  interface TaskRow {
    id: number
    name: string
    done: boolean
  }

  interface _DBTask extends TaskRow {}
  class _DBTask extends Model {
    static override properties: ModelProperties<_DBTask> = {
      name: { type: 'string', required: true },
      done: { type: 'boolean' }
    }
  }

  it('instance has typed properties from interface', () => {
    const task = {} as _DBTask
    expectTypeOf(task.id).not.toBeAny()
    expectTypeOf(task.id).toBeNumber()
    expectTypeOf(task.name).not.toBeAny()
    expectTypeOf(task.name).toBeString()
    expectTypeOf(task.done).not.toBeAny()
    expectTypeOf(task.done).toBeBoolean()
  })

  it('rejects schema type mismatch with DB type', () => {
    interface BadData {
      name: string
    }

    interface _BadDB extends BadData {}
    class _BadDB extends Model {
      static override properties: ModelProperties<_BadDB> = {
        // @ts-expect-error - name is string, not boolean
        name: { type: 'boolean' }
      }
    }
  })

  it('rejects unknown property not in DB type', () => {
    interface SmallData {
      name: string
    }

    interface _SmallDB extends SmallData {}
    class _SmallDB extends Model {
      static override properties: ModelProperties<_SmallDB> = {
        name: { type: 'string' },
        // @ts-expect-error - 'extra' not in SmallData
        extra: { type: 'string' }
      }
    }
  })
})

describe('Model instantiation', () => {
  it('constructor accepts record', () => {
    const task = new Task({ name: 'test', done: false })
    expectTypeOf(task).not.toBeAny()
    expectTypeOf(task).toMatchTypeOf<Model>()
  })

  it('declared properties are typed on instance', () => {
    const task = {} as Task
    expectTypeOf(task.name).toBeString()
    expectTypeOf(task.done).toBeBoolean()
  })

  it('relation property is typed as array', () => {
    const tag = {} as Tag
    expectTypeOf(tag.tasks).not.toBeAny()
    expectTypeOf(tag.tasks).toEqualTypeOf<Task[]>()
  })
})

describe('ApplicationConfig — extensible via augmentation', () => {
  it('custom config keys are typed', () => {
    const app = {} as Application
    expectTypeOf(app.config.externalUrls).not.toBeAny()
    const urls = app.config.externalUrls!
    expectTypeOf(urls.frontend).toBeString()
  })

  it('built-in config keys still work', () => {
    const app = {} as Application
    expectTypeOf(app.config.knex).not.toBeAny()
  })
})

describe('ApplicationServices — typed service registry', () => {
  it('app.services returns typed service', () => {
    const app = {} as Application
    expectTypeOf(app.services.mail).not.toBeAny()
    expectTypeOf(app.services.mail)
      .toEqualTypeOf<MailService>()
  })

  it('service methods are typed', () => {
    const app = {} as Application
    expectTypeOf(app.services.mail.send)
      .toBeFunction()
  })

  it('getService returns typed service', () => {
    const app = {} as Application
    const mail = app.getService('mail')
    expectTypeOf(mail).not.toBeAny()
    expectTypeOf(mail).toEqualTypeOf<MailService>()
  })
})

describe('Service<Config> — typed config', () => {
  it('config reflects the generic parameter', () => {
    const mail = {} as MailService
    expectTypeOf(mail.config).not.toBeAny()
    const config = mail.config!
    expectTypeOf(config.smtp.host).toBeString()
    expectTypeOf(config.smtp.port).toBeNumber()
    expectTypeOf(config.from).toBeString()
  })

  it('setup accepts the typed config', () => {
    const mail = {} as MailService
    mail.setup({
      smtp: { host: 'localhost', port: 587 },
      from: 'noreply@example.com'
    })
  })

  it('setup rejects wrong config shape', () => {
    const mail = {} as MailService
    // @ts-expect-error - missing required keys
    mail.setup({ wrong: true })
  })

  it('unparameterized Service has generic config', () => {
    const svc = {} as Service
    expectTypeOf(svc.config).toEqualTypeOf<
      Record<string, unknown> | null
    >()
  })
})

describe('ApplicationStorages — typed storage registry', () => {
  it('app.storages returns typed storage', () => {
    const app = {} as Application
    expectTypeOf(app.storages.s3).not.toBeAny()
    expectTypeOf(app.storages.s3)
      .toEqualTypeOf<Storage>()
  })

  it('getStorage returns typed storage', () => {
    const app = {} as Application
    const s3 = app.getStorage('s3')
    expectTypeOf(s3).not.toBeAny()
    expectTypeOf(s3).toEqualTypeOf<Storage>()
  })
})

describe('KoaContextState — typed ctx.state', () => {
  it('ctx.state.user is typed', () => {
    const ctx = {} as KoaContext
    expectTypeOf(ctx.state).not.toBeAny()
    expectTypeOf(ctx.state.user).not.toBeAny()
    expectTypeOf(ctx.state.user.id).toBeNumber()
    expectTypeOf(ctx.state.user.role).toBeString()
  })
})
