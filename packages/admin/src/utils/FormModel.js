import { effectScope, watch } from 'vue'
import {
  isFunction,
  isPromise,
  equals,
  normalizeDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { isSourceWithResource } from './schema/structure.js'
import { isEmptySchema } from './schema/lookup.js'
import {
  shouldRenderSchema,
  setDefaultValues,
  computeValue,
  hasValueFromDataSchema,
  processSchemaData
} from './schema/data.js'

// FormModel holds the state of the data edited by a form, view or dialog that
// is derived from schema and data, independently of what is rendered:
//
// - Missing values are set to their defaults when the data is set up.
// - Computed values, the results of `schema.compute()` and of the data schemas
//   of the `computed` types (`schema.data`, `schema.dataPath`), are written
//   into the data by watchers that the model owns, one scope per component,
//   for all components whose `if` doesn't evaluate to `false`.
//
// Sources with their own resource are skipped, as their items are edited
// through their own forms.
//
// `component` is the component that owns the data, e.g. `DitoForm`. Its
// `dataPath`, `componentPath`, `rootData` and `mainSchemaComponent` are used
// when present. The model needs to be stopped when the component unmounts.

export class FormModel {
  // The entries of the components with computed values and the scopes of the
  // watchers that write these values into the data, by component path:
  computedValueRecords = new Map()

  constructor({ component, getSchema, getData }) {
    this.component = component
    this.getSchema = getSchema
    this.getData = getData
    this.rootScope = effectScope(true)
    this.rootScope.run(() => {
      watch(
        [getSchema, getData],
        ([schema, data]) => this.applyDefaultValues(schema, data),
        { immediate: true }
      )
      watch(
        () => this.getComputedValueEntries(),
        entries => this.updateComputedValueRecords(entries),
        { immediate: true }
      )
    })
  }

  get dataPath() {
    return this.component.dataPath ?? ''
  }

  get componentPath() {
    return this.component.componentPath ?? ''
  }

  get rootData() {
    return this.component.rootData ?? this.getData()
  }

  stop() {
    this.rootScope.stop()
    this.computedValueRecords.clear()
  }

  // Sets missing values to their defaults when the data is set up.
  applyDefaultValues(schema, data) {
    if (data && !isEmptySchema(schema)) {
      setDefaultValues(schema, data, this.component, {
        dataPath: this.dataPath,
        rootData: this.rootData,
        shouldProcess: entry => !isSourceWithResource(entry.schema)
      })
    }
  }

  // Returns the entries of `processSchemaData()` for all components with
  // computed values whose `if` doesn't evaluate to `false`. Called by a
  // watcher, so that it runs again when the data structure changes, e.g. when
  // list items are added or removed, or when `if` conditions change.
  getComputedValueEntries() {
    const schema = this.getSchema()
    const data = this.getData()
    const entries = []
    if (data && !isEmptySchema(schema)) {
      processSchemaData(schema, data, {
        dataPath: this.dataPath,
        componentPath: this.componentPath,
        shouldProcess: entry => (
          !isSourceWithResource(entry.schema) &&
          shouldRenderSchema(entry.schema, this.createEntryContext(entry))
        ),
        before: entry => {
          if (hasComputedValueSource(entry.schema)) {
            entries.push(entry)
          }
        },
        options: { component: this.component, rootData: this.rootData }
      })
    }
    return entries
  }

  // Keeps the records of the components that are still present with the same
  // schema and data, creates records with new scopes for new ones, and stops
  // the scopes of the others.
  updateComputedValueRecords(entries) {
    const previousRecords = this.computedValueRecords
    this.computedValueRecords = new Map()
    for (const entry of entries) {
      const { componentPath } = entry
      let computedValueRecord = previousRecords.get(componentPath)
      if (
        computedValueRecord?.entry.schema === entry.schema &&
        computedValueRecord.entry.data === entry.data
      ) {
        previousRecords.delete(componentPath)
      } else {
        computedValueRecord = {
          entry,
          scope: this.createComputedValueScope(entry)
        }
      }
      this.computedValueRecords.set(componentPath, computedValueRecord)
    }
    for (const { scope } of previousRecords.values()) {
      scope.stop()
    }
  }

  createComputedValueScope(entry) {
    const scope = this.rootScope.run(() => effectScope())
    scope.run(() => {
      if (entry.schema.compute) {
        watch(
          // Return a new object each time, so that the value is also written
          // when only the value in the data changed, e.g. through user input.
          () => ({ value: this.getComputedValue(entry) }),
          ({ value }) => this.writeComputedValue(entry, value),
          { immediate: true }
        )
      }
      if (hasValueFromDataSchema(entry.schema)) {
        watch(
          () => this.getDataSchemaValueOrLoader(entry),
          (valueOrLoader, _, onCleanup) => {
            let isOutdated = false
            onCleanup(() => {
              isOutdated = true
            })
            // A function returned by `schema.data()` loads the value, while
            // `schema.data()` itself only tracks the dependencies, e.g.
            // `data: ({ item }) => async () => load(item.id)`:
            const valueOrPromise = isFunction(valueOrLoader)
              ? valueOrLoader(this.createEntryContext(entry))
              : valueOrLoader
            const writeResolvedValue = value => {
              if (!isOutdated) {
                this.writeComputedValue(entry, value)
              }
            }
            if (isPromise(valueOrPromise)) {
              valueOrPromise.then(writeResolvedValue).catch(console.error)
            } else {
              writeResolvedValue(valueOrPromise)
            }
          },
          { immediate: true }
        )
      }
    })
    return scope
  }

  getComputedValue(entry) {
    const { schema, data, name, dataPath } = entry
    return computeValue(schema, data, name, dataPath, {
      component: this.getComputeContextComponent(entry),
      rootData: this.rootData
    })
  }

  // Returns the value of the data schema of the component, a promise of it,
  // or a function that loads it, see `createComputedValueScope()`.
  getDataSchemaValueOrLoader(entry) {
    const { schema, dataPath } = entry
    const { data } = schema
    return data
      ? isFunction(data)
        ? data(this.createEntryContext(entry))
        : data
      : getValueAtDataPath(
          this.rootData,
          normalizeDataPath(`${dataPath}/${schema.dataPath}`)
        )
  }

  writeComputedValue(entry, value) {
    const { data, name } = entry
    if (!equals(value, data[name])) {
      // Access `data[name]` directly to update the value without calling
      // `parse()`, see `ValueMixin`:
      data[name] = value
    }
  }

  // Returns the component that `schema.compute()` is called with: the mounted
  // component at the component path of the entry if there is one, so that
  // `context.options` is available, else the main schema component of the
  // data, like in `processData()`.
  getComputeContextComponent(entry) {
    const { mainSchemaComponent } = this.component
    return (
      mainSchemaComponent?.getComponentByComponentPath(entry.componentPath) ??
      mainSchemaComponent ??
      this.component
    )
  }

  // Returns the context for `if` and data schemas, with the component that
  // owns the data, which stays the same when components are mounted, so that
  // data schemas don't load again.
  createEntryContext({ schema, data, name, dataPath }) {
    const { rootData } = this
    // Pass a function, so that the `value` getter isn't evaluated when the
    // context is created, and watchers only depend on the value if it's used.
    return new DitoContext(this.component, () => ({
      schema,
      name,
      data,
      dataPath,
      rootData,
      get value() {
        return name != null ? data[name] : undefined
      }
    }))
  }
}

// Returns whether the schema is a source of computed values, through
// `schema.compute()` or a data schema of the `computed` types.
function hasComputedValueSource(schema) {
  return !!schema.compute || hasValueFromDataSchema(schema)
}
