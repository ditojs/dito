import type { Context } from 'hono'
import {
  HttpError,
  type DitoContext,
  type MixinDefinition
} from '@ditojs/server'
import { isFunction } from '@ditojs/utils'
import type {
  EntityClass,
  EntityMetadata,
  EntityProperty
} from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import type { ModelControllerDefinition } from './controller.ts'
import {
  checkFind,
  mergeFind,
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
import { getPrimaryKey } from './metadata.ts'
import { getOutput, type Output } from './serialize.ts'
import { getEntityManager } from './createMikroAdapter.ts'

// One request of a model controller, created by the middleware of the base
// layer. That middleware runs inside the transaction, so `em` is the
// transaction's. Its methods `record()`, `find()`, `list()` and `listQuery()`
// are `c.var.getRecord()`, `c.var.find()`, `c.var.list()` and
// `c.var.getListQuery()`.

declare module '@ditojs/server' {
  interface DitoVariables {
    // In model controllers: the id of a member action, converted to the type of
    // the primary key, so a number for integer keys. An id that doesn't fit
    // responds with 404, and stays a string with `load`, such as `self`.
    id: any
    // In model controllers: the entity class of the controller. Its metadata is
    // `db.getMetadata(entity)`.
    entity: EntityClass<any>
    // In model controllers: loads the record of the id once per request. On
    // other actions, it returns the record that a handler set with
    // `setRecord()`, such as the row that the default `post` creates.
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

// What the requests of a controller share.
export interface ModelDefinition<T extends object = any>
  extends Pick<ModelControllerDefinition<T>, 'entity' | 'load'> {
  find: Find<T>
  filters: Record<string, Filter>
  beforeSerializers: NonNullable<MixinDefinition['beforeSerialize']>[]
  serializers: NonNullable<MixinDefinition['serialize']>[]
  deserializers: NonNullable<MixinDefinition['deserialize']>[]
}

// The request of each context of a model controller, for Dito's own handlers.
const requests = new WeakMap<Context, ModelRequest>()

export const getModelRequest = (c: Context) => requests.get(c)

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
  #query?: ReturnType<ModelRequest<T>['getQuery']>
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

  record() {
    return (this.#record ??= this.#loadRecord())
  }

  setRecord(record: T) {
    this.#record = Promise.resolve(record)
  }

  async find(find?: FindShape<T>) {
    const { where, options } = await this.query(find)
    return this.em.find(this.entity, where, options) as Promise<any[]>
  }

  async list(find?: ListFind<T>) {
    const list = await this.#getList(find)
    this.output = list.output
    return findRows(this, list) as Promise<any>
  }

  async listQuery(find?: ListFind<T>) {
    return getListQuery(this, await this.#getList(find))
  }

  // The query of the controller's `find`, once per request, or of `extra`.
  query(extra?: FindShape<T>) {
    return extra ? this.getQuery(extra) : (this.#query ??= this.getQuery())
  }

  // The controller's `find` merged with `extra`, see `mergeFind()`, as a
  // query and its output. A function of the context runs once per request.
  async getQuery(extra?: FindShape<T>) {
    const { meta } = this
    const { find } = this.definition
    this.#find ??= isFunction(find)
      ? Promise.resolve(find(this.c)).then(checkFind)
      : Promise.resolve(find)
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
    const { c } = this
    const { load } = this.definition
    const id = c.req.param('id')
    if (id === undefined) {
      throw new Error(
        'getRecord() has no record here: only member actions load one, and ' +
        'other actions need a handler that calls `setRecord()`'
      )
    }
    const record = load ? await load(c, id) : await this.#findRecord()
    if (record == null) throw new HttpError(404)
    return record
  }

  async #findRecord() {
    const { where, options } = await this.query()
    return this.em.findOne(
      this.entity,
      { $and: [where, { [this.key.name]: this.c.var.id }] } as never,
      options
    ) as Promise<T | null>
  }

  // The query of the list with its parameters, see `findRows()`.
  async #getList({ query, ...extra }: ListFind<T> = {}) {
    return {
      ...(await this.query(extra)),
      query: parseListQuery(this.c, query)
    }
  }
}

// Sets the record that `getRecord()` returns, such as the row that a `post`
// creates.
export function setRecord(c: Context, record: unknown) {
  getModelRequest(c)!.setRecord(record)
}
