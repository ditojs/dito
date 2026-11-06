import type { Context } from 'hono'
import {
  HttpError,
  type DitoContext,
  type MixinDefinition
} from '@ditojs/server'
import type {
  EntityClass,
  EntityMetadata,
  EntityProperty
} from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import type { ModelControllerDefinition } from './controller.ts'
import {
  mergeFind,
  resolveFind,
  splitFind,
  type Find,
  type FindShape
} from './find.ts'
import type { Filter } from './filters.ts'
import { findRows, getListQuery } from './list.ts'
import {
  parseListQuery,
  type ListParams,
  type ListQuery
} from './listQuery.ts'
import { getEntityManager } from './createMikroAdapter.ts'
import { getPrimaryKey } from './metadata.ts'
import { getOutput, type Output } from './serialize.ts'

declare module '@ditojs/server' {
  interface DitoVariables {
    // In model controllers: the id of a record action, converted to the type of
    // the primary key, so a number for integer keys. An id that doesn't fit
    // responds with 404.
    id: any
    // In model controllers: the entity class of the controller. Its metadata is
    // `em.getMetadata(entity)`.
    entity: EntityClass<any>
    // In model controllers: loads the record of the id once per request. After
    // a `post`, it returns the record that the action created and returned.
    getRecord: <T = any>() => Promise<T>
    // In model controllers: queries the records of the controller, through its
    // `find` merged with `find`, without the row limit of lists.
    find: <T = any>(find?: FindShape) => Promise<T[]>
    // In model controllers: the list of the controller, through its `find`
    // merged with `find`, with the filters, `order`, `range` and row limit of
    // `findRows()`. `query` replaces the list parameters of the URL, such as
    // `{ range: '0,49' }`. The records go out in the merged shape.
    list: <T = any>(
      find?: ListFind
    ) => Promise<T[] | { results: T[]; total: number }>
    // In model controllers: the `where` and `orderBy` of the list that `list()`
    // would load, with its filters and `order`, and the `range` of the request,
    // for queries over its rows, such as summaries and exports.
    getListQuery: (find?: ListFind) => Promise<{
      where: object
      orderBy: object[]
      range: ListQuery['range']
    }>
  }
}

type ListFind<T extends object = any> = FindShape<T> & { query?: ListParams }

export type Query<T extends object> = ReturnType<typeof splitFind<T>> & {
  own: FindShape<T>
  shape: FindShape<T>
  output: Output
}

export interface ModelDefinition<T extends object = any>
  extends Pick<ModelControllerDefinition<T>, 'entity'> {
  find: Find<T>
  filters: Record<string, Filter>
  beforeSerializers: NonNullable<MixinDefinition['beforeSerialize']>[]
  serializers: NonNullable<MixinDefinition['serialize']>[]
  deserializers: NonNullable<MixinDefinition['deserialize']>[]
}

const requests = new WeakMap<Context, ModelRequest>()

export const getModelRequest = (c: Context) => requests.get(c)

// The base layer's middleware creates the request inside the transaction, so
// `em` is the transaction's.
export class ModelRequest<T extends object = any> {
  c: DitoContext
  definition: ModelDefinition<T>
  entity: EntityClass<T>
  em: EntityManager
  meta: EntityMetadata<T>
  key: EntityProperty
  // The output of the last list, whose records go out in its shape.
  output?: Output
  #find?: Promise<FindShape<T>>
  #query?: Promise<Query<T>>
  #record?: Promise<T>

  constructor(c: DitoContext, definition: ModelDefinition<T>) {
    this.c = c
    this.definition = definition
    this.entity = definition.entity
    this.em = getEntityManager(c)
    this.meta = this.em.getMetadata().get(definition.entity)
    this.key = getPrimaryKey(this.meta)
    requests.set(c, this)
  }

  getRecord() {
    return (this.#record ??= this.#loadRecord())
  }

  setRecord(record: T) {
    this.#record = Promise.resolve(record)
  }

  async find(find?: FindShape<T>) {
    const { where, options } = await this.getQuery(find)
    return this.em.find(this.entity, where, options) as Promise<any[]>
  }

  async list(find?: ListFind<T>) {
    const list = await this.#getList(find)
    this.output = list.output
    return findRows(this, list) as Promise<any>
  }

  async getListQuery(find?: ListFind<T>) {
    return getListQuery(this, await this.#getList(find))
  }

  // Without `extra`, the query is the same for the whole request:
  getQuery(extra?: FindShape<T>) {
    return extra
      ? this.#createQuery(extra)
      : (this.#query ??= this.#createQuery())
  }

  // The controller's `find` merged with `extra`, as a query and its output. A
  // `find` function runs once per request.
  async #createQuery(extra?: FindShape<T>): Promise<Query<T>> {
    const { meta } = this
    const { find } = this.definition
    this.#find ??= resolveFind(find, this.c)
    const own = await this.#find
    const shape = extra ? mergeFind(own, extra) : own
    return {
      own,
      shape,
      ...splitFind(meta, shape),
      output: getOutput(meta, shape)
    }
  }

  async #loadRecord() {
    if (this.c.req.param('id') === undefined) {
      throw new Error(
        'Unable to get the record: only record actions load one, and `post` ' +
        'sets the record that it returns'
      )
    }
    const { where, options } = await this.getQuery()
    const record = await this.em.findOne(
      this.entity,
      { $and: [where, { [this.key.name]: this.c.var.id }] } as never,
      options
    )
    if (record == null) throw new HttpError(404)
    return record as T
  }

  async #getList({ query, ...extra }: ListFind<T> = {}) {
    return {
      ...(await this.getQuery(extra)),
      query: parseListQuery(this.c, query)
    }
  }
}
