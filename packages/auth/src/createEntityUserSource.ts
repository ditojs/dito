import { z } from 'zod'
import {
  serialize as serializeEntity,
  type EntityClass,
  type EntityManager
} from '@mikro-orm/core'
import { isFunction, mapValues } from '@ditojs/utils'
import type { MikroAdapter } from '@ditojs/mikro'
import { getPrimaryKey, toPrimaryKey } from '@ditojs/mikro/internal'

// The users of one kind, on an entity.

export interface CreateEntityUserSourceOptions<U extends object> {
  // The adapter of the API, with its `session` and `credential` tables.
  adapter: MikroAdapter
  // The property of the username. Default: `username`.
  usernameProperty?: string
  // The condition that users must also meet to be found, such as
  // `{ isActive: true }`.
  where?: object
  // The properties of the user that the admin and `get self` get, or a
  // function that returns the JSON. By default, the entity's own serialization,
  // which leaves out hidden properties.
  serialize?: string[] | ((context: { user: U }) => unknown)
  // Values computed from the user, added to the properties of `serialize`.
  computed?: Record<string, (context: { user: U }) => unknown>
  // The schema of new passwords, for `users.defineActions()` and the users'
  // model controllers. At least 8 characters by default.
  password?: z.ZodType<string>
}

export const defaultPasswordSchema = z
  .string({ error: 'The password is required.' })
  .min(8, 'The password needs at least 8 characters.')

export function createEntityUserSource<U extends { id: number | string }>(
  entity: EntityClass<U>,
  {
    adapter,
    usernameProperty = 'username',
    where,
    serialize,
    computed = {},
    password = defaultPasswordSchema
  }: CreateEntityUserSourceOptions<U>
) {
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
    // The users' prefix in sessions and credentials, as in `'<name>-<id>'`.
    name: entity.name,
    usernameProperty,
    password,
    // Ids that don't fit the key, such as those of tampered tokens, find none.
    async findById(id: string): Promise<U | null> {
      const em = adapter.getEm()
      const key = getKey(em)
      const value = toPrimaryKey(key, id)
      return value === undefined ? null : findOne(em, { [key.name]: value })
    },
    async findByUsername(username: string): Promise<U | null> {
      return findOne(adapter.getEm(), { [usernameProperty]: username })
    },
    getUsername(user: U) {
      return user[usernameProperty as keyof U] as string
    },
    // Ask the entity, as new or partly loaded users lack the keys of properties
    // without a value:
    hasProperty(name: string) {
      const { props } = getMetadata(adapter.getEm())
      return props.some(prop => prop.name === name)
    },
    // Write the values at once and set them on `user`, without flushing the
    // request's other changes:
    async patch(user: U, values: object) {
      const em = adapter.getEm()
      const { name } = getKey(em)
      const where = { [name]: user[name as keyof U] }
      await em.nativeUpdate(entity, where as never, values)
      Object.assign(user, values)
    },
    serialize(user: U) {
      const record = user as Record<string, unknown>
      return isFunction(serialize)
        ? serialize({ user })
        : {
            ...(
              serialize
                ? Object.fromEntries(serialize.map(key => [key, record[key]]))
                : serializeEntity(user)
            ),
            ...mapValues(computed, get => get({ user }))
          }
    }
  }
}
