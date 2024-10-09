import { toRaw } from 'vue'
import { isFunction } from '@ditojs/utils'
import {
  getItemDataPath,
  getParentItemDataPath,
  getParentItem,
  getItem,
  getLastDataPathName,
  getLastDataPathIndex
} from './utils/data.js'

const { hasOwnProperty } = Object.prototype

// `DitoContext` instances are a thin wrapper around raw `context` objects,
// which themselves actually inherit from the linked `component` instance, so
// that they only need to provide the values that should be different than
// in the underlying component. In order to not expose all fields from the
// component, the wrapper is introduced:
// Use WeakMap for the raw `context` objects, so we don't have to pollute the
// actual `DitoContext` instance with it.
const contexts = new WeakMap()

function get(context, key, defaultValue) {
  let raw = toRaw(context)
  let object = null
  // In case `DitoContext.extend()` was used, we need to find the actual context
  // object from the object's the inheritance chain:
  while (raw && !object) {
    object = contexts.get(raw)
    raw = Object.getPrototypeOf(raw)
  }
  const value = key in object ? object[key] : undefined
  // If `object` explicitly sets the key to `undefined`, return it.
  return value !== undefined || hasOwnProperty.call(object, key)
    ? value
    : isFunction(defaultValue)
      ? defaultValue()
      : defaultValue
}

function set(context, key, value) {
  contexts.get(toRaw(context))[key] = value
}

export default class DitoContext {
  constructor(component, context) {
    // Use the provided params object / function, or create a new one:
    context = context
      ? isFunction(context)
        ? context()
        : { ...context }
      : {}
    // If not explicitly set (to false), default to true so we don't fall back
    // to `component` for its value.
    context.nested ??= true
    context.component = component
    // Have `object` inherit from the `component` instance, so it can override
    // its values and still retrieve from it, and associate it with `this`
    // through `contexts` map:
    const object = Object.setPrototypeOf(context, component)
    // No need for `toRaw(this)` here as it's always raw inside the constructor.
    contexts.set(this, object)
  }

  static get(component, context) {
    return context instanceof DitoContext
      ? context
      : new DitoContext(component, context)
  }

  extend(object) {
    // Create a copy of this context that inherits from the real one, but
    // overrides some properties with the ones from the passed `object`.
    return Object.setPrototypeOf(object, this)
  }

  // `nested` is `true` when the data-path points a value inside an item, and
  // `false` when it points to the item itself.
  get nested() {
    return get(this, 'nested', true)
  }

  get schema() {
    return get(this, 'schema', null)
  }

  get value() {
    return get(this, 'value', undefined)
  }

  get dataPath() {
    return get(this, 'dataPath', '')
  }

  get name() {
    return get(this, 'name', () => getLastDataPathName(this.dataPath))
  }

  get index() {
    return get(this, 'index', () => getLastDataPathIndex(this.dataPath))
  }

  get itemDataPath() {
    return getItemDataPath(this.dataPath, this.nested)
  }

  get parentItemDataPath() {
    return getParentItemDataPath(this.dataPath, this.nested)
  }

  get itemIndex() {
    return getLastDataPathIndex(this.itemDataPath)
  }

  get parentItemIndex() {
    return getLastDataPathIndex(this.parentItemDataPath)
  }

  // NOTE: While internally, we speak of `data`, in the API surface the
  // term `item` is used for the data that relates to editing objects:
  // If `data` isn't provided, we can determine it from rootData & dataPath:
  get item() {
    return get(this, 'data', () =>
      getItem(this.rootItem, this.dataPath, this.nested)
    )
  }

  // NOTE: `parentItem` isn't the closest data parent to `item`, it's the
  // closest parent that isn't an array, e.g. for relations or nested JSON data.
  // This is why the term `item` was chosen over `data`, e.g. VS the use of
  // `parentData` in server-sided validation, which is the closest parent. If
  // needed, we could expose this data here too, as we can do all sorts of data
  // processing with `rootData` and `dataPath`.
  get parentItem() {
    const item = (
      getParentItem(this.rootItem, this.dataPath, this.nested) ||
      null
    )
    return item !== this.item ? item : null
  }

  get rootItem() {
    return get(this, 'rootData', null)
  }

  get processedItem() {
    return get(this, 'processedData', null)
  }

  get processedRootItem() {
    return get(this, 'processedRootData', null)
  }

  get clipboardItem() {
    return get(this, 'clipboardData', null)
  }

  get user() {
    return get(this, 'user', null)
  }

  get api() {
    return get(this, 'api', null)
  }

  get views() {
    return get(this, 'views', null)
  }

  get flattenedViews() {
    return get(this, 'flattenedViews', null)
  }

  get itemLabel() {
    return get(this, 'itemLabel', null)
  }

  get formLabel() {
    return get(this, 'formLabel', null)
  }

  // NOTE: Like 'options', the associated component doesn't always exist, e.g.
  // in nested forms during `processData()`. But `schema` is guaranteed to
  // always be available.
  get component() {
    return get(this, 'component', null)
  }

  // TODO: Add `componentSchema` getter for the schema of the current component,
  // even when the component isn't actually instantiated. Consider adding
  // `sourceSchema` as well?

  // TODO: Fix unclear naming: Which schema is this, that of the component or of
  // its parent? Isn't exposing `formComponent` and `viewComponent` enough, once
  // we offer access to their components there through `getComponent()` & co. on
  // `DitoMixin` perhaps?  Also, there could be a `tabComponent` getter for
  // schemas in tabs?
  get schemaComponent() {
    return get(this, 'schemaComponent', null)
  }

  get formComponent() {
    return get(this, 'formComponent', null)
  }

  get viewComponent() {
    return get(this, 'viewComponent', null)
  }

  get dialogComponent() {
    return get(this, 'dialogComponent', null)
  }

  get panelComponent() {
    return get(this, 'panelComponent', null)
  }

  get resourceComponent() {
    return get(this, 'resourceComponent', null)
  }

  get sourceComponent() {
    return get(this, 'sourceComponent', null)
  }

  // When used in OptionsMixin for `schema.options.value()`,
  // `schema.options.label()` and  `schema.search.filter()` callbacks:
  get option() {
    return get(this, 'option', undefined)
  }

  get options() {
    return get(this, 'options', undefined)
  }

  get open() {
    return get(this, 'open', undefined)
  }

  // TODO: Rename this to `searchTerm` or `searchQuery`, to perhaps free `query`
  // for the actual `resourceComponent.query` object?
  get query() {
    return get(this, 'query', undefined)
  }

  // The error field is only populated in the context of buttons that send
  // requests, see `ResourceMixin.emitButtonEvent()`:
  get error() {
    return get(this, 'error', undefined)
  }

  get wasNotified() {
    return get(this, 'wasNotified', false)
  }

  // Helper Methods

  get request() {
    return options => this.component.request(options)
  }

  get format() {
    return (value, options) => this.component.format(value, options)
  }

  get navigate() {
    return location => this.component.navigate(location)
  }

  get download() {
    return options => this.component.download(options)
  }

  get getResourceUrl() {
    return resource => this.component.getResourceUrl(resource)
  }

  get notify() {
    return options => {
      this.component.notify(options)
      set(this, 'wasNotified', true)
    }
  }
}
