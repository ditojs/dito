import type { Context } from 'hono'
import type { z } from 'zod'
import type { EntityClass, EntityManager } from '@mikro-orm/core'
import { isArray, isFunction, mapValues } from '@ditojs/utils'
import { getPrimaryKey, toPrimaryKey } from './metadata.ts'

// Implement the `UserSource` of `@ditojs/auth` without importing it.

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
  // The schema of new passwords, for `defineUserActions()` and
  // `definePasswordWrites()`. At least 8 characters by default.
  password?: z.ZodType<string>
}

export function createEntityUserSource<U extends { id: number | string }>(
  entity: EntityClass<U>,
  {
    em,
    usernameProperty = 'username',
    where,
    serialize,
    computed = {},
    password
  }: EntityUserSourceOptions<U>
) {
  // Outside of the API, such as in session middleware, query with a fork of
  // `em`:
  const getEm = (c: Context): EntityManager => {
    if (c.var.em) return c.var.em
    const root = isFunction(em) ? em() : em
    if (!root) {
      throw new Error(
        `Unable to load the users of '${entity.name}' outside of the API ` +
        'without `em`'
      )
    }
    return root.fork()
  }

  // `hash` needs to be hidden, or it would go out with the users in each
  // response that holds them:
  const getMetadata = (em: EntityManager) => {
    const meta = em.getMetadata().get(entity)
    if (meta.props.some(prop => prop.name === 'hash' && !prop.hidden)) {
      throw new Error(
        `Invalid user entity '${entity.name}': its 'hash' isn't hidden`
      )
    }
    return meta
  }

  const getKey = (em: EntityManager) => getPrimaryKey(getMetadata(em))

  const findOne = (em: EntityManager, condition: object) =>
    em.findOne(
      getMetadata(em).class,
      (where ? { $and: [condition, where] } : condition) as never
    )

  return {
    name: entity.name,
    usernameProperty,
    password,
    // Ids that don't fit the key, such as those of tampered tokens, find none.
    async findById(c: Context, id: string): Promise<U | null> {
      const em = getEm(c)
      const key = getKey(em)
      const value = toPrimaryKey(key, id)
      return value === undefined ? null : findOne(em, { [key.name]: value })
    },
    async findByUsername(c: Context, username: string): Promise<U | null> {
      return findOne(getEm(c), { [usernameProperty]: username })
    },
    // Write the values at once, without flushing the request's other changes:
    async patch(c: Context, user: U, values: object) {
      const em = getEm(c)
      const { name } = getKey(em)
      const where = { [name]: user[name as keyof U] }
      await em.nativeUpdate(entity, where as never, values)
      Object.assign(user, values)
    },
    serialize(c: Context, user: U) {
      const record = user as Record<string, unknown>
      return isArray(serialize)
        ? {
            ...Object.fromEntries(serialize.map(key => [key, record[key]])),
            ...mapValues(computed, get => get({ user }))
          }
        : serialize({ c, user })
    }
  }
}
