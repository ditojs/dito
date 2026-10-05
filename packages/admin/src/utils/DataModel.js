import { effectScope, computed, watch, nextTick, shallowRef } from 'vue'
import {
  isArray,
  isPlainObject,
  equals,
  clone,
  parseDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { DataSchemaResolver } from './DataSchemaResolver.js'
import { isNested } from './schema/structure.js'
import { isEmptySchema } from './schema/lookup.js'
import {
  getSchemaValue,
  shouldSetDefaultValue,
  getDefaultValue,
  initializeData,
  computeValue,
  hasValueFromDataSchema,
  processSchemaData,
  processData
} from './schema/data.js'

// DataModel holds the state of the data edited by a form, view or dialog that
// is derived from schema and data, independently of what is rendered:
//
// - Missing values are set to their defaults when the data is set up, and when
//   they go missing later, e.g. in items that code adds, except the values of
//   components with `compute()`, which fall back to their defaults when
//   `compute()` doesn't return a value, unlike in new data, see
//   `initializeData()`.
// - The items of lists with `orderKey` are numbered when the data is set up,
//   which doesn't make the data dirty.
// - Computed values, the results of `schema.compute()` and of the data schemas
//   of the `computed` types (`schema.data`, `schema.dataPath`), are written
//   into the data by watchers that the model owns, one scope per component,
//   for all components whose `if` doesn't evaluate to `false`.
// - Options, `schema.options`, are resolved per component when they are first
//   read, by `compute()` through `context.options` or by the component that
//   displays them, see `getOptions()`. Both get the same option objects, and
//   computes that read options only run once they are loaded.
// - Submitting waits for the loads of data schemas and options that are still
//   pending, see `waitForPendingLoads()`.
// - The data is dirty when its processed data differs from a snapshot taken
//   when the data was set up, saved or applied, see `isDirty`. The values that
//   the model derives until it settled, e.g. from loaded options, don't count,
//   see `takeProcessedDataSnapshot()`. Only forms track this, by passing
//   `getSourceSchema()`, see the constructor.
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
// when present. The model needs to be stopped before the component unmounts.

export class DataModel {
  // The entries of the components with computed values and the scopes of the
  // watchers that write these values into the data, by component path:
  computedValueRecords = new Map()
  // The entries of the components whose options were read and the resolvers
  // of their options, by component path, see `getOptionsResolver()`:
  optionsRecords = new Map()
  // The promises of the loads of data schemas and options that are pending,
  // see `waitForPendingLoads()`:
  pendingLoads = new Set()
  // The data that the snapshot was taken of, and its processed data to compare
  // with in `isDirty`, see `takeProcessedDataSnapshot()`:
  processedDataSnapshot = shallowRef(null)
  // The data paths of the values that the model writes while it settles after
  // the snapshot is taken, which `isDirty` takes from the current data, `null`
  // once it settled, see `takeProcessedDataSnapshot()`:
  derivedValueDataPaths = null

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
        ([schema, data]) => this.initializeData(schema, data),
        modelWatchOptions
      )
      // The entries are read through a computed property, so that the watchers
      // of the entries can check synchronously whether their entry is still
      // current, see `createComputedValueScope()`.
      this.dataEntries = computed(() => this.getDataEntries())
      watch(
        () => this.dataEntries.value.computedValueEntries,
        entries => this.updateComputedValueRecords(entries),
        modelWatchOptions
      )
      // Values that go missing after the data was set up, e.g. in items that
      // code adds, get their defaults too:
      watch(
        () => this.dataEntries.value.entriesWithMissingValues,
        entries => this.setDefaultValues(entries),
        modelWatchOptions
      )
      if (getSourceSchema) {
        // Data that is set up, e.g. loaded, saved or applied, isn't dirty:
        // After the data is set up, as the watchers run in the order in which
        // they're created, see `modelWatchOptions`.
        watch(
          getData,
          () => this.takeProcessedDataSnapshot().catch(console.error),
          modelWatchOptions
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
  // the data was set up, saved or applied, see `takeProcessedDataSnapshot()`.
  // Excluded values don't count, unless their components have `process()`,
  // see `processData()`, and neither do the values that the model derives
  // until it settled.
  get isDirty() {
    const processedDataSnapshot = this.processedDataSnapshot.value
    const data = this.getData()
    // A snapshot only applies to the data that it was taken of. Data that was
    // replaced since isn't dirty until its own snapshot is taken, and neither
    // is missing data.
    if (!data || processedDataSnapshot?.data !== data) {
      return false
    }
    const processedData = this.getProcessedDataForDirtyCheck()
    const processedDataToCompare = this.derivedValueDataPaths
      ? takeOverValuesAtDataPaths(
          processedDataSnapshot.processedData,
          processedData,
          this.derivedValueDataPaths
        )
      : processedDataSnapshot.processedData
    return !equals(processedData, processedDataToCompare)
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

  // Takes the snapshot of the processed data that `isDirty` compares with,
  // when the data is set up, saved or applied. Until the model settled, i.e.
  // the pending loads finished and the computed values that depend on them are
  // written into the data, see `waitForPendingLoads()`, the values that the
  // model writes are recorded in `derivedValueDataPaths` and don't count, as
  // they're derived from the data, e.g. from loaded options. Once settled, they
  // are taken over into the snapshot, so that changes made in the meantime,
  // e.g. by the user, count right away. Values that the model derives from
  // these changes while it settles are taken over too, so reverting the
  // changes afterwards leaves the data dirty, which only asks for confirmation
  // unnecessarily.
  async takeProcessedDataSnapshot() {
    const data = this.getData()
    const derivedValueDataPaths = data ? new Set() : null
    this.derivedValueDataPaths = derivedValueDataPaths
    this.processedDataSnapshot.value = data
      ? { data, processedData: clone(this.getProcessedDataForDirtyCheck()) }
      : null
    if (!data) {
      return
    }
    // Let the watchers and the rendering start their loads first:
    await nextTick()
    await this.waitForPendingLoads()
    // Snapshots that were taken since settle by themselves.
    const isSnapshotReplaced = (
      this.derivedValueDataPaths !==
      derivedValueDataPaths
    )
    // Check whether the model stopped first, as its component may be gone.
    const isModelStopped = !this.rootScope.active
    if (isSnapshotReplaced || isModelStopped) {
      return
    }
    this.derivedValueDataPaths = null
    const processedDataSnapshot = this.processedDataSnapshot.value
    if (processedDataSnapshot?.data === this.getData()) {
      this.processedDataSnapshot.value = {
        data,
        processedData: takeOverValuesAtDataPaths(
          processedDataSnapshot.processedData,
          this.getProcessedDataForDirtyCheck(),
          derivedValueDataPaths
        )
      }
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
          // Like `getComputedValueResult()`:
          component: this.component.mainSchemaComponent ?? this.component,
          rootData: this.rootData,
          schemaOnly: true,
          target: 'clipboard',
          // Reading the dirty state doesn't call `process()`, see
          // `processData()`:
          shouldCallProcess: false
        })
      : null
  }

  // Makes clean changes to the data, which don't make it dirty, while other
  // changes still do, e.g. to apply what an action on the server already
  // saved: Once the model settled, the values that changed in the processed
  // data, including the values derived from the changes, are taken over into
  // the snapshot. Arrays whose length changes are taken over as a whole, see
  // `takeOverChangedValues()`. `makeChanges()` is called synchronously.
  async applyCleanChanges(makeChanges) {
    const data = this.getData()
    const hasSnapshotOfData = this.processedDataSnapshot.value?.data === data
    // Clone the processed data, as it shares nested values with the data,
    // which `makeChanges()` may change in place.
    const processedDataBeforeChanges = hasSnapshotOfData
      ? clone(this.getProcessedDataForDirtyCheck())
      : null
    makeChanges()
    if (hasSnapshotOfData) {
      // Let the watchers write the values derived from the changes first:
      await nextTick()
      await this.waitForPendingLoads()
      // Take the changes over into the current snapshot of the data, which may
      // have been replaced in the meantime, e.g. once the model settled.
      const processedDataSnapshot = this.processedDataSnapshot.value
      if (processedDataSnapshot?.data === data && this.rootScope.active) {
        this.processedDataSnapshot.value = {
          data,
          processedData: takeOverChangedValues(
            processedDataSnapshot.processedData,
            processedDataBeforeChanges,
            this.getProcessedDataForDirtyCheck()
          )
        }
      }
    }
  }

  // Tracks the promise of a pending load until it settles, so that
  // `waitForPendingLoads()` waits for it.
  trackPendingLoad(promise) {
    this.pendingLoads.add(promise)
    promise.finally(() => this.pendingLoads.delete(promise))
  }

  // Sets missing values to their defaults and numbers the items of lists by
  // their order key when the data is set up, see `initializeData()`.
  initializeData(schema, data) {
    if (data && !isEmptySchema(schema)) {
      initializeData(schema, data, this.component, {
        dataPath: this.dataPath,
        rootData: this.rootData,
        shouldSkipSourcesWithResource: true,
        // The model writes the values of components with `compute()`,
        // including their defaults:
        shouldSetDefaultsOfComponentsWithCompute: false
      })
    }
  }

  // Walks the data and returns the entries of `processSchemaData()` of the
  // components whose `if` doesn't evaluate to `false`: the ones with computed
  // values, by component path, and the ones whose values are missing. Called
  // by a computed property, so that it runs again when the data structure
  // changes, e.g. when list items are added or removed, values go missing, or
  // `if` conditions change.
  getDataEntries() {
    const schema = this.getSchema()
    const data = this.getData()
    const computedValueEntries = new Map()
    const entriesWithMissingValues = []
    if (data && !isEmptySchema(schema)) {
      processSchemaData(schema, data, {
        dataPath: this.dataPath,
        componentPath: this.componentPath,
        shouldProcess: entry => this.isEntryShown(entry),
        shouldSkipSourcesWithResource: true,
        before: entry => {
          if (hasComputedValueSource(entry.schema)) {
            computedValueEntries.set(entry.componentPath, entry)
          }
          if (this.shouldSetDefaultValue(entry)) {
            entriesWithMissingValues.push(entry)
          }
        },
        options: { component: this.component, rootData: this.rootData }
      })
    }
    return { computedValueEntries, entriesWithMissingValues }
  }

  // Returns whether the `if` of the entry's component doesn't evaluate to
  // `false`. Unlike `shouldRenderSchema()`, it doesn't evaluate the components
  // of sections and tabs, as the walk of the data visits them anyway, see
  // `getDataEntries()`, which leads to the same entries.
  isEntryShown(entry) {
    return (
      entry.schema.if === undefined ||
      getSchemaValue('if', {
        type: Boolean,
        schema: entry.schema,
        context: this.createEntryContext(entry),
        default: true
      })
    )
  }

  // Returns whether the value of the entry is missing and needs its default.
  // The model writes the values of components with `compute()`, including
  // their defaults, see `computeValue()`.
  shouldSetDefaultValue(entry) {
    const { schema, data, name } = entry
    return shouldSetDefaultValue(
      schema,
      data,
      name,
      () => this.createEntryContext(entry),
      { shouldSetDefaultsOfComponentsWithCompute: false }
    )
  }

  // Sets the defaults of the values of the entries, unless they were set in
  // the meantime.
  setDefaultValues(entries) {
    for (const entry of entries) {
      if (this.shouldSetDefaultValue(entry)) {
        const { schema, data, name } = entry
        data[name] = getDefaultValue(schema, () =>
          this.createEntryContext(entry)
        )
      }
    }
  }

  // Keeps the records of the components that are still present with the same
  // schema and data, creates records with new scopes for new ones, and stops
  // the scopes of the others.
  updateComputedValueRecords(entries) {
    const previousRecords = this.computedValueRecords
    this.computedValueRecords = new Map()
    for (const [componentPath, entry] of entries) {
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

  // Creates the scope of the watchers that write the computed values of the
  // entry into the data. Entries stop being current before their scope is
  // stopped, as watchers that don't belong to components run in the order in
  // which they're triggered, e.g. when list items are removed or `if`
  // conditions change. The watchers skip these entries, see `isEntryCurrent()`.
  createComputedValueScope(entry) {
    const scope = this.rootScope.run(() => effectScope())
    scope.run(() => {
      const isEntryCurrent = computed(() => this.isEntryCurrent(entry))
      if (entry.schema.compute) {
        watch(
          // Return a new object each time, so that the value is also written
          // when only the value in the data changed, e.g. through user input.
          () =>
            isEntryCurrent.value ? this.getComputedValueResult(entry) : null,
          computedResult => {
            if (computedResult) {
              this.writeComputedValue(entry, computedResult.value)
            }
          },
          modelWatchOptions
        )
      }
      if (hasValueFromDataSchema(entry.schema)) {
        const dataSchemaResolver = this.createDataSchemaResolver(
          entry.schema,
          entry
        )
        watch(
          () =>
            isEntryCurrent.value && !dataSchemaResolver.isLoading
              ? { value: dataSchemaResolver.value }
              : null,
          resolved => {
            if (resolved) {
              this.writeComputedValue(entry, resolved.value)
            }
          },
          modelWatchOptions
        )
      }
    })
    return scope
  }

  // Returns whether the model computes the value of the component at the
  // component path, i.e. whether its walk of the data visits the component.
  hasComputedValueEntry(componentPath) {
    return this.dataEntries.value.computedValueEntries.has(componentPath)
  }

  // Returns whether the entry is still one of the current entries, with the
  // same schema and data, see `getDataEntries()`.
  isEntryCurrent({ componentPath, schema, data }) {
    const currentEntry =
      this.dataEntries.value.computedValueEntries.get(componentPath)
    return currentEntry?.schema === schema && currentEntry.data === data
  }

  // Calls `schema.compute()` with the main schema component of the data, like
  // `processData()`, and with the options resolved by the model, so that the
  // result doesn't depend on whether the component is rendered. Returns the
  // value as `{ value }`, or `null` if `compute()` reads options that aren't
  // loaded, which aborts it, so that the current value is kept until they are
  // and `compute()` can rely on them. The watcher that calls it depends on the
  // options through reading them, and calls it again once they're loaded.
  getComputedValueResult(entry) {
    const { schema, data, name, dataPath } = entry
    try {
      const value = computeValue(schema, data, name, dataPath, {
        component: this.component.mainSchemaComponent ?? this.component,
        rootData: this.rootData,
        getOptions: schema.options ? () => this.getLoadedOptions(entry) : null
      })
      return { value }
    } catch (error) {
      if (error === optionsNotLoaded) {
        return null
      }
      throw error
    }
  }

  // Returns the options of the component of the entry, or aborts the
  // `compute()` that reads them, while they aren't loaded, see
  // `getComputedValueResult()`.
  getLoadedOptions(entry) {
    const options = this.getOptions(entry)
    if (options === undefined) {
      throw optionsNotLoaded
    }
    return options
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
      // Values written while the model settles are derived, see
      // `takeProcessedDataSnapshot()`:
      this.derivedValueDataPaths?.add(this.getRelativeDataPath(entry))
      // Access `data[name]` directly to update the value without calling
      // `parse()`, see `ValueMixin`:
      data[name] = value
    }
  }

  // Returns the data path of the value of the entry, relative to the model's
  // data, as in its processed data.
  getRelativeDataPath({ schema, name, dataPath }) {
    // The data paths of nested components include their own name.
    const tokens = isNested(schema)
      ? parseDataPath(dataPath)
      : [...parseDataPath(dataPath), name]
    return tokens.slice(parseDataPath(this.dataPath).length).join('/')
  }

  // Returns the context for `if`, data schemas and options, with the component
  // that owns the data, which stays the same when components are mounted, so
  // that data schemas and options don't load again.
  createEntryContext({ schema, data, name, dataPath }) {
    return DitoContext.createForSchema(this.component, {
      schema,
      name,
      data,
      dataPath,
      rootData: this.rootData
    })
  }
}

// Returns a copy of `processedData` with the values at `dataPaths` taken over
// from `currentProcessedData`, or removed if they're missing there. Values
// whose parents are missing in `processedData` are left out, as their parents
// differ anyway.
function takeOverValuesAtDataPaths(
  processedData,
  currentProcessedData,
  dataPaths
) {
  if (dataPaths.size === 0) {
    return processedData
  }
  const result = clone(processedData)
  for (const dataPath of dataPaths) {
    const tokens = parseDataPath(dataPath)
    const parentDataPath = tokens.slice(0, -1)
    const key = tokens.at(-1)
    const parent = getValueAtDataPath(result, parentDataPath, () => null)
    if (parent && typeof parent === 'object') {
      const value = getValueAtDataPath(
        currentProcessedData,
        dataPath,
        () => notFound
      )
      if (value === notFound) {
        delete parent[key]
      } else {
        parent[key] = clone(value)
      }
    }
  }
  return result
}

// Returns a copy of `target` with the values that differ between `before` and
// `after` taken over from `after`, comparing objects and arrays of the same
// length entry by entry. Arrays whose length changed are taken over as a whole,
// as their entries can't be matched, including changes of their entries that
// were made before.
function takeOverChangedValues(target, before, after) {
  if (equals(before, after)) {
    return target
  }
  const isSameShape = (
    (
      isPlainObject(before) &&
      isPlainObject(after) &&
      isPlainObject(target)
    ) || (
      isArray(before) &&
      isArray(after) &&
      isArray(target) &&
      before.length === after.length &&
      after.length === target.length
    )
  )
  if (!isSameShape) {
    return clone(after)
  }
  const result = isArray(target) ? [...target] : { ...target }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) {
      delete result[key]
    } else {
      result[key] = takeOverChangedValues(target[key], before[key], after[key])
    }
  }
  return result
}

const notFound = Symbol('notFound')

// The watchers of the model run after the post-flush hooks, so that they write
// the values that they derive from the data after the components that display
// them are mounted. Otherwise, the `mounted` hooks of `v-model` directives
// would restore the values that inputs had when they were mounted, see
// https://github.com/vuejs/core/issues/15774. Vue processes the updates that
// the written values cause in the same flush, before the browser renders them.
// The watchers run in the order in which they're created.
const modelWatchOptions = { immediate: true, flush: 'post' }

// Aborts `compute()` when it reads options that aren't loaded, see
// `DataModel.getComputedValueResult()`.
const optionsNotLoaded = Symbol('optionsNotLoaded')

// Returns whether the schema is a source of computed values, through
// `schema.compute()` or a data schema of the `computed` types.
function hasComputedValueSource(schema) {
  return !!schema.compute || hasValueFromDataSchema(schema)
}
