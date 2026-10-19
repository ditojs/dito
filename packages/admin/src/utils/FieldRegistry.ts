import { computed, nextTick, shallowRef, type ComputedRef } from 'vue'
import { equals, normalizeDataPath, parseDataPath } from '@ditojs/utils'
import { getRelativeDataPath } from './data.js'
import {
  applySchemaDefaults,
  setupSchemaComponentAfterDefaults
} from './schema/setup.js'
import type { DataModel } from './DataModel.ts'
import type { Services } from './services.ts'
import type { Schema } from './types.ts'

export interface RegisteredField {
  // Relative to the data of the container, e.g. 'address/city':
  readonly dataPath: string
  readonly schema: Schema
  unregister(): void
}

// The fields that components register in a container, as the components of its
// schema. Fields that unmount stay in it until the data is replaced, to keep
// serializing their values, but only mounted fields validate.
export class FieldRegistry {
  readonly #model: DataModel
  readonly #services: Services
  readonly #knownFields = new Map<string, RegisteredField>()
  readonly #mountedFields = new Set<RegisteredField>()
  readonly #components = shallowRef<Record<string, Schema>>({})
  #isUpdateScheduled = false
  readonly #schema: ComputedRef<Schema>

  constructor(
    model: DataModel,
    {
      schema,
      services
    }: { schema: () => Schema | null; services: Services | null }
  ) {
    if (!services) {
      throw new Error('Unable to register fields without services.')
    }
    this.#model = model
    this.#services = services
    this.#schema = computed(() => ({
      ...schema(),
      components: this.#components.value
    }))
  }

  get schema(): Schema {
    return this.#schema.value
  }

  // Register the schema that `getSource()` returns, e.g. from the props of a
  // field component, at `dataPath`. Its options are read live, only its `type`
  // is fixed at registration. Fields with async setup, e.g. lazy components,
  // join the schema once it's done, which `waitUntilSettled()` waits for.
  register(dataPath: string, getSource: () => Schema): RegisteredField {
    const { api } = this.#services.adminContext
    const path = parseDataPath(dataPath)
    const name = path.at(-1)!
    dataPath = normalizeDataPath(path)
    // Items of lists are edited in the forms of list fields, relative to them:
    if (path.some(key => /^\d+$/.test(key))) {
      throw new Error(
        `Invalid field path '${dataPath}': Use list fields for array items.`
      )
    }
    // Groups only hold fields, fields replace the ones at the same path:
    const fields = [...this.#knownFields.values(), ...this.#mountedFields]
    for (const other of fields) {
      if (
        other.dataPath !== dataPath &&
        isOverlapping(other.dataPath, dataPath)
      ) {
        throw new Error(
          `Invalid field path '${dataPath}': The field at '${
            other.dataPath
          }' overlaps it.`
        )
      }
    }
    const field: RegisteredField = {
      dataPath,
      schema: createFieldSchema(getSource, api, name),
      unregister: () => this.#mountedFields.delete(field)
    }
    this.#mountedFields.add(field)
    const setup = setupSchemaComponentAfterDefaults(
      api,
      field.schema,
      name
    ).then(() => {
      // Fields that unmount before their setup is done stay unknown:
      if (this.#mountedFields.has(field)) {
        this.#knownFields.set(field.dataPath, field)
        this.#scheduleUpdate()
      }
    })
    this.#model.trackPendingLoad(setup)
    return field
  }

  // Groups are mounted with their fields, and the values in fields with them.
  isMounted(dataPath: string): boolean {
    const path = getRelativeDataPath(dataPath, this.#model.dataPath)
    return [...this.#mountedFields].some(field =>
      isOverlapping(field.dataPath, path)
    )
  }

  // Replaced data starts with the fields that are mounted:
  forgetUnmountedFields() {
    for (const [dataPath, field] of this.#knownFields) {
      if (!this.#mountedFields.has(field)) {
        this.#knownFields.delete(dataPath)
        this.#scheduleUpdate()
      }
    }
  }

  // Build the components once per tick, as each new schema is walked again:
  #scheduleUpdate() {
    if (!this.#isUpdateScheduled) {
      this.#isUpdateScheduled = true
      nextTick(() => {
        this.#isUpdateScheduled = false
        this.#components.value = this.#getComponents()
      })
    }
  }

  // Fields at paths like 'address/city' go in nested sections, as groups:
  #getComponents(): Record<string, Schema> {
    const components: Record<string, Schema> = {}
    for (const { dataPath, schema } of this.#knownFields.values()) {
      const path = parseDataPath(dataPath)
      const name = path.pop()!
      let group = components
      for (const key of path) {
        group[key] ??= { type: 'section', nested: true, components: {} }
        group = group[key].components
      }
      group[name] = schema
    }
    return components
  }
}

// The schema of a field reads its source live, with the defaults applied. Its
// own values are the ones that setup writes, e.g. resolved components:
function createFieldSchema(
  getSource: () => Schema,
  api: Services['adminContext']['api'],
  name: string
): Schema {
  const { type } = getSource()
  const source = computed<Schema>(previous => {
    const schema: Schema = { ...getSource(), type }
    applySchemaDefaults(api, schema, name)
    // Values that stay equal keep their identity, e.g. inline options:
    for (const [key, value] of Object.entries(schema)) {
      if (previous && equals(value, previous[key])) {
        schema[key] = previous[key]
      }
    }
    return schema
  })
  return new Proxy({} as Schema, {
    get: (schema, key) =>
      Object.hasOwn(schema, key)
        ? schema[key as string]
        : source.value[key as string],

    has: (schema, key) => key in schema || key in source.value,

    ownKeys: schema => [
      ...new Set([
        ...Reflect.ownKeys(source.value),
        ...Reflect.ownKeys(schema)
      ])
    ],

    getOwnPropertyDescriptor: (schema, key) => (
      Reflect.getOwnPropertyDescriptor(schema, key) ?? (
        Object.hasOwn(source.value, key)
          ? {
              value: source.value[key as string],
              writable: true,
              enumerable: true,
              configurable: true
            }
          : undefined
      )
    )
  })
}

// Whether one data path contains the other, or they're the same:
function isOverlapping(dataPath: string, other: string | null): boolean {
  return (
    getRelativeDataPath(dataPath, other) !== null ||
    getRelativeDataPath(other, dataPath) !== null
  )
}
