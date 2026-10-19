import { computed, nextTick, shallowRef, type ComputedRef } from 'vue'
import { equals, normalizeDataPath, parseDataPath } from '@ditojs/utils'
import { appendDataPath, getRelativeDataPath } from './data.js'
import {
  applySchemaDefaults,
  setupSchemaComponentAfterDefaults
} from './schema/setup.js'
import type { DataModel } from './DataModel.ts'
import type { Services } from './services.ts'
import type { Schema } from './types.ts'

export interface RegisteredField {
  // Relative to the data that the field is placed in, e.g. 'address/city':
  readonly dataPath: string
  readonly schema: Schema
  readonly getParentDataPath: () => string
  readonly items: FieldRegistry | null
  unregister(): void
}

export interface FieldOptions {
  // The data path of the data that the field is placed in, e.g. of an item:
  getParentDataPath?: () => string
  // The registry of the fields of the items in the field's value:
  items?: FieldRegistry | null
}

// The fields that components register in a container, as the components of its
// schema. Fields that unmount stay in it until the data is replaced, to keep
// serializing their values, but only mounted fields validate. The fields of
// list items register in the item form of their list, once for all items.
export class FieldRegistry {
  readonly #model: DataModel
  readonly #services: Services
  readonly #parentRegistry: FieldRegistry | null
  readonly #knownFields = new Map<string, RegisteredField>()
  readonly #mountedFields = new Set<RegisteredField>()
  readonly #components = shallowRef<Record<string, Schema>>({})
  #isUpdateScheduled = false
  readonly #schema: ComputedRef<Schema>

  constructor(
    model: DataModel,
    {
      schema,
      services,
      parentRegistry = null
    }: {
      schema: () => Schema | null
      services: Services | null
      parentRegistry?: FieldRegistry | null
    }
  ) {
    if (!services) {
      throw new Error('Unable to register fields without services.')
    }
    this.#model = model
    this.#services = services
    this.#parentRegistry = parentRegistry
    this.#schema = computed(() => ({
      ...schema(),
      components: this.#components.value
    }))
  }

  get schema(): Schema {
    return this.#schema.value
  }

  // The registry of the item form of a list or object field, which is part of
  // this registry's schema:
  createItemRegistry(): FieldRegistry {
    return new FieldRegistry(this.#model, {
      schema: () => ({ type: 'form' }),
      services: this.#services,
      parentRegistry: this
    })
  }

  // Register the schema that `getSource()` returns, e.g. from the props of a
  // field component, at `dataPath`. Its options are read live, only its `type`
  // is fixed at registration. Fields with async setup, e.g. lazy components,
  // join the schema once it's done, which `waitUntilSettled()` waits for. Of
  // several mounted fields at the same path, e.g. in list items, the first one
  // registers its schema.
  register(
    dataPath: string,
    getSource: () => Schema,
    {
      getParentDataPath = () => this.#model.dataPath,
      items = null
    }: FieldOptions = {}
  ): RegisteredField {
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
      getParentDataPath,
      items,
      unregister: () => this.#mountedFields.delete(field)
    }
    this.#mountedFields.add(field)
    const setup = setupSchemaComponentAfterDefaults(
      api,
      field.schema,
      name
    ).then(() => {
      // Fields that unmount before their setup is done stay unknown:
      const known = this.#knownFields.get(field.dataPath)
      if (
        this.#mountedFields.has(field) &&
        !(known && this.#mountedFields.has(known))
      ) {
        this.#knownFields.set(field.dataPath, field)
        this.#scheduleUpdate()
      }
    })
    this.#model.trackPendingLoad(setup)
    return field
  }

  isMounted(dataPath: string): boolean {
    return [...this.#mountedFields].some(field => {
      const fieldDataPath = appendDataPath(
        field.getParentDataPath(),
        field.dataPath
      )
      const path = getRelativeDataPath(dataPath, fieldDataPath)
      if (path !== null) {
        return (
          // The field itself, or a value inside it...
          !path ||
          !field.items ||
          // ...unless it's in an item, whose fields mount per item:
          field.items.isMounted(dataPath)
        )
      } else {
        // A group that contains the field:
        return getRelativeDataPath(fieldDataPath, dataPath) !== null
      }
    })
  }

  // Replaced data starts with the fields that are mounted:
  forgetUnmountedFields() {
    for (const [dataPath, field] of this.#knownFields) {
      if (this.#mountedFields.has(field)) {
        field.items?.forgetUnmountedFields()
      } else {
        this.#knownFields.delete(dataPath)
        this.#scheduleUpdate()
      }
    }
  }

  // Build the components once per tick, as each new schema is walked again.
  // Item forms are part of the schema of their parent, which changes with them:
  #scheduleUpdate() {
    if (!this.#isUpdateScheduled) {
      this.#isUpdateScheduled = true
      nextTick(() => {
        this.#isUpdateScheduled = false
        this.#components.value = this.#getComponents()
        if (this.#parentRegistry) {
          this.#parentRegistry.#scheduleUpdate()
        }
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
// own values are the ones that setup writes, e.g. resolved components, unless
// they're the source's values, e.g. set up forms:
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

    set: (schema, key, value) => {
      if (value !== source.value[key as string]) {
        schema[key as string] = value
      }
      return true
    },

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
