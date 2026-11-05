import type { Context } from 'hono'
import type { EntityClass, EntityManager } from '@mikro-orm/core'
import { isArray, isFunction, mapValues } from '@ditojs/utils'
import { getPrimaryKey, toPrimaryKey } from './metadata.ts'

// The user source of `@ditojs/auth` for a MikroORM entity. It queries with the
// request's entity manager, else with a fork of `em`, such as in session
// middleware that runs before the API. It implements auth's `UserSource`
// without importing auth.

export interface EntityUserSourceOptions<U extends object> {
  // The ORM's entity manager, or a function that returns it, for queries
  // outside of the API's requests.
  em?: EntityManager | (() => EntityManager)
  // The property of the username. Default: `username`.
  usernameProperty?: string
  // The condition that users must also meet to be found, such as
  // `{ isActive: true }`.
  where?: object
  // The properties of the user that the admin and `get self` get, or a
  // function that returns the JSON.
  serialize: string[] | ((context: { c: Context; user: U }) => unknown)
  // Values computed from the user, added to the properties of `serialize`.
  computed?: Record<string, (context: { user: U }) => unknown>
}

export function createEntityUserSource<U extends { id: number | string }>(
  entity: EntityClass<U>,
  {
    em,
    usernameProperty = 'username',
    where,
    serialize,
    computed = {}
  }: EntityUserSourceOptions<U>
) {
  const getEm = (c: Context): EntityManager => {
    if (c.var.em) return c.var.em
    const root = isFunction(em) ? em() : em
    if (!root) {
      throw new Error(
        `createEntityUserSource(${entity.name}) needs \`em\` outside of the API`
      )
    }
    return root.fork()
  }

  const getKey = (em: EntityManager) =>
    getPrimaryKey(em.getMetadata().get(entity))

  const findOne = (em: EntityManager, condition: object) =>
    em.findOne(
      entity,
      (where ? { $and: [condition, where] } : condition) as never
    )

  return {
    name: entity.name,
    // Ids that don't fit the key, such as those of tampered tokens, find none.
    async findById(c: Context, id: string): Promise<U | null> {
      const em = getEm(c)
      const key = getKey(em)
      const value = toPrimaryKey(key, id)
      return value === undefined ? null : findOne(em, { [key.name]: value })
    },
    async findByUsername(c: Context, value: string): Promise<U | null> {
      return findOne(getEm(c), { [usernameProperty]: value })
    },
    // Writes the values at once and sets them on the user, without flushing
    // the request's other changes.
    async patch(c: Context, user: U, values: object) {
      const em = getEm(c)
      const { name } = getKey(em)
      const where = { [name]: user[name as keyof U] }
      await em.nativeUpdate(entity, where as never, values)
      Object.assign(user, values)
    },
    serialize(c: Context, user: U) {
      if (!isArray(serialize)) return serialize({ c, user })
      const record = user as Record<string, unknown>
      return {
        ...Object.fromEntries(serialize.map(key => [key, record[key]])),
        ...mapValues(computed, get => get({ user }))
      }
    }
  }
}
