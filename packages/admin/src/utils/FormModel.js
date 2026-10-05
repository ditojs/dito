import { effectScope, watch, nextTick, shallowRef } from 'vue'
import { equals, clone } from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { DataSchemaResolver } from './DataSchemaResolver.js'
import { isSourceWithResource } from './schema/structure.js'
import { isEmptySchema } from './schema/lookup.js'
import {
  shouldRenderSchema,
  setDefaultValues,
  computeValue,
  hasValueFromDataSchema,
  processSchemaData,
  processData
} from './schema/data.js'

// FormModel holds the state of the data edited by a form, view or dialog that
// is derived from schema and data, independently of what is rendered:
//
// - Missing values are set to their defaults when the data is set up.
// - Computed values, the results of `schema.compute()` and of the data schemas
//   of the `computed` types (`schema.data`, `schema.dataPath`), are written
//   into the data by watchers that the model owns, one scope per component,
//   for all components whose `if` doesn't evaluate to `false`.
// - Options, `schema.options`, are resolved per component when they are first
//   read, by `compute()` through `context.options` or by the component that
//   displays them, see `getOptions()`. Both get the same option objects, and
//   computes that read options run again when they are loaded.
// - Submitting waits for the loads of data schemas and options that are still
//   pending, see `waitForPendingLoads()`.
// - The data is dirty when its processed data differs from a snapshot taken
//   when the data was set up, saved or applied, see `isDirty`. Only forms
//   track this, by passing `getSourceSchema()`, see the constructor.
//
// Sources with their own resource are skipped, as their items are edited
// through their own forms.
//
// The model handles components through their entries, the objects that
// `processSchemaData()` passes to `before()` and `after()`, with the schema,
// data, name, data path and component path of each component. Components that
// read their options pass entries of the same shape, see `getOptions()`.
//
// `component` is the component that owns the data, e.g. `DitoForm`. Its
// `dataPath`, `componentPath`, `rootData` and `mainSchemaComponent` are used
// when present. The model needs to be stopped when the component unmounts.

export class FormModel {
  // The entries of the components with computed values and the scopes of the
  // watchers that write these values into the data, by component path:
  computedValueRecords = new Map()
  // The entries of the components whose options were read and the resolvers
  // of their options, by component path, see `getOptionsResolver()`:
  optionsRecords = new Map()
  // The promises of the loads of data schemas and options that are pending,
  // see `waitForPendingLoads()`:
  pendingLoads = new Set()
  // The processed data to compare with in `isDirty`, `null` until it is taken,
  // see `takeProcessedDataSnapshotWhenSettled()`:
  processedDataSnapshot = shallowRef(null)

  // `getSchema()` and `getData()` return the schema and the data that the
  // model handles. `getSourceSchema()` returns the schema of the source that
  // the data is an item of, as needed by `processData()`. Only forms pass it,
  // to track whether their data is dirty, see `isDirty`.
  constructor({ component, getSchema, getData, getSourceSchema = null }) {
    this.component = component
    this.getSchema = getSchema
    this.getData = getData
    this.getSourceSchema = getSourceSchema
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
      if (getSourceSchema) {
        // Data that is set up, e.g. loaded, saved or applied, isn't dirty:
        watch(
          getData,
          () =>
            this.takeProcessedDataSnapshotWhenSettled().catch(console.error),
          { immediate: true }
        )
      }
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

  // Returns whether the processed data differs from the snapshot taken when
  // the data was set up, saved or applied, see
  // `takeProcessedDataSnapshotWhenSettled()`. Values that aren't processed,
  // e.g. of excluded components, don't count.
  get isDirty() {
    const processedDataSnapshot = this.processedDataSnapshot.value
    return (
      processedDataSnapshot !== null &&
      !equals(this.getProcessedDataForDirtyCheck(), processedDataSnapshot)
    )
  }

  stop() {
    this.rootScope.stop()
    this.computedValueRecords.clear()
    this.optionsRecords.clear()
    this.pendingLoads.clear()
  }

  // Waits for the pending loads of data schemas and options, including the
  // ones that they cause, e.g. options that depend on computed values that
  // depend on loaded options, and for the watchers to write the resulting
  // computed values into the data.
  async waitForPendingLoads() {
    while (this.pendingLoads.size > 0) {
      await Promise.all(this.pendingLoads)
      await nextTick()
    }
  }

  // Clears the snapshot of the processed data that `isDirty` compares with,
  // and takes it anew once the model settled: once the pending loads finished
  // and the computed values that depend on them are written into the data,
  // see `waitForPendingLoads()`, so that the values derived when the data is
  // set up don't count as changes. Until then, the data isn't dirty. No
  // snapshot is taken if the data was replaced or the model stopped since,
  // as replacing the data takes a new one.
  async takeProcessedDataSnapshotWhenSettled() {
    this.processedDataSnapshot.value = null
    const dataToSnapshot = this.getData()
    // Let the watchers and the rendering start their loads first:
    await nextTick()
    await this.waitForPendingLoads()
    const isDataReplaced = this.getData() !== dataToSnapshot
    const isModelStopped = !this.rootScope.active
    if (dataToSnapshot && !isDataReplaced && !isModelStopped) {
      this.processedDataSnapshot.value = clone(
        this.getProcessedDataForDirtyCheck()
      )
    }
  }

  // Returns the processed data that `isDirty` compares with
  // `processedDataSnapshot`, and that the snapshot is taken of. The data is
  // processed like for the clipboard, not for the server, which gives
  // references to new items random prefixes each time, see
  // `SchemaGraph.getReferencePrefix()`.
  getProcessedDataForDirtyCheck() {
    const schema = this.getSchema()
    const data = this.getData()
    return data && !isEmptySchema(schema)
      ? processData(schema, this.getSourceSchema(), data, this.dataPath, {
          // Like `getComputedValue()`:
          component: this.component.mainSchemaComponent ?? this.component,
          rootData: this.rootData,
          schemaOnly: true,
          target: 'clipboard'
        })
      : null
  }

  // Tracks the promise of a pending load until it settles, so that
  // `waitForPendingLoads()` waits for it.
  trackPendingLoad(promise) {
    this.pendingLoads.add(promise)
    promise.finally(() => this.pendingLoads.delete(promise))
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
        const dataSchemaResolver = this.createDataSchemaResolver(
          entry.schema,
          entry
        )
        watch(
          () =>
            dataSchemaResolver.isLoading
              ? null
              : { value: dataSchemaResolver.value },
          resolved => {
            if (resolved) {
              this.writeComputedValue(entry, resolved.value)
            }
          },
          { immediate: true }
        )
      }
    })
    return scope
  }

  // Calls `schema.compute()` with the main schema component of the data, like
  // `processData()`, and with the options resolved by the model, so that the
  // result doesn't depend on whether the component is rendered.
  getComputedValue(entry) {
    const { schema, data, name, dataPath } = entry
    return computeValue(schema, data, name, dataPath, {
      component: this.component.mainSchemaComponent ?? this.component,
      rootData: this.rootData,
      getOptions: schema.options ? () => this.getOptions(entry) : null
    })
  }

  // Returns the options of the component of the entry, resolved from
  // `schema.options` when they're first read, `undefined` while loading.
  getOptions(entry) {
    return this.getOptionsResolver(entry).value
  }

  // Returns the resolver of the options of the component of the entry, shared
  // by all callers with the same component path, schema and data, so that
  // computes and the component that displays the options get the same option
  // objects, and the options only load once.
  getOptionsResolver(entry) {
    const { schema, data, componentPath } = entry
    let optionsRecord = this.optionsRecords.get(componentPath)
    if (
      !optionsRecord ||
      optionsRecord.entry.schema.options !== schema.options ||
      optionsRecord.entry.data !== data
    ) {
      optionsRecord = {
        entry,
        resolver: this.createDataSchemaResolver(schema.options, entry)
      }
      this.optionsRecords.set(componentPath, optionsRecord)
    }
    return optionsRecord.resolver
  }

  createDataSchemaResolver(dataSchema, entry) {
    return new DataSchemaResolver(dataSchema, {
      createContext: () => this.createEntryContext(entry),
      onLoadStart: promise => this.trackPendingLoad(promise)
    })
  }

  writeComputedValue(entry, value) {
    const { data, name } = entry
    if (!equals(value, data[name])) {
      // Access `data[name]` directly to update the value without calling
      // `parse()`, see `ValueMixin`:
      data[name] = value
    }
  }

  // Returns the context for `if`, data schemas and options, with the component
  // that owns the data, which stays the same when components are mounted, so
  // that data schemas and options don't load again.
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
