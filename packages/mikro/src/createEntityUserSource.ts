import { tryGetContext } from 'hono/context-storage'
import type { z } from 'zod'
import type { EntityClass, EntityManager } from '@mikro-orm/core'
import { isArray, mapValues } from '@ditojs/utils'
import { getPrimaryKey, toPrimaryKey } from './metadata.ts'

// The `UserSource` of `@ditojs/auth`, which depends on this package.

export interface EntityUserSourceOptions<U extends object> {
  // The ORM, for queries outside of the API's requests.
  orm: { em: EntityManager }
  // The property of the username. Default: `username`.
  usernameProperty?: string
  // The condition that users must also meet to be found, such as
  // `{ isActive: true }`.
  where?: object
  // The properties of the user that the admin and `get self` get, or a
  // function that returns the JSON.
  serialize: string[] | ((context: { user: U }) => unknown)
  // Values computed from the user, added to the properties of `serialize`.
  computed?: Record<string, (context: { user: U }) => unknown>
  // The schema of new passwords, for `defineUserActions()` and
  // `defineUserWrites()`. At least 8 characters by default.
  password?: z.ZodType<string>
}

export function createEntityUserSource<U extends { id: number | string }>(
  entity: EntityClass<U>,
  {
    orm,
    usernameProperty = 'username',
    where,
    serialize,
    computed = {},
    password
  }: EntityUserSourceOptions<U>
) {
  // Outside of the API, such as in session middleware, query with a fork:
  const getEm = (): EntityManager => tryGetContext()?.var.em ?? orm.em.fork()

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
    async findById(id: string): Promise<U | null> {
      const em = getEm()
      const key = getKey(em)
      const value = toPrimaryKey(key, id)
      return value === undefined ? null : findOne(em, { [key.name]: value })
    },
    async findByUsername(username: string): Promise<U | null> {
      return findOne(getEm(), { [usernameProperty]: username })
    },
    // Write the values at once, without flushing the request's other changes:
    async patch(user: U, values: object) {
      const em = getEm()
      const { name } = getKey(em)
      const where = { [name]: user[name as keyof U] }
      await em.nativeUpdate(entity, where as never, values)
      Object.assign(user, values)
    },
    serialize(user: U) {
      const record = user as Record<string, unknown>
      return isArray(serialize)
        ? {
            ...Object.fromEntries(serialize.map(key => [key, record[key]])),
            ...mapValues(computed, get => get({ user }))
          }
        : serialize({ user })
    }
  }
}
