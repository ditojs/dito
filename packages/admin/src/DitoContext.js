import { isFunction } from '@ditojs/utils'
import {
  getItem, getParentItem, getParentKey, getParentIndex
} from '@/utils/data'

// `DitoContext` instances are a thin wrapper around raw `context` objects,
// which themselves actually inherit from the linked `component` instance, so
// that they only need to provide the values that should be different than
// in the underlying component. In order to not expose all fields from the
// component, the wrapper is introduced:
// Use WeakMap for the raw `context` objects, so we don't have to pollute the
// actual `DitoContext` instance with it.
const contexts = new WeakMap()

function get(instance, key) {
  return contexts.get(instance)[key]
}

function set(instance, key, value) {
  contexts.get(instance)[key] = value
}

export default class DitoContext {
  constructor(component, context) {
    // Use the provided params object / function, or create a new one:
    context = context
      ? (isFunction(context) ? context() : context)
      : {}
    context.component = component
    // Have `context` inherit from the `component` instance, so it can override
    // its values and still retrieve from it, and associate it with `this`
    // through `paramsMap`:
    contexts.set(this, Object.setPrototypeOf(context, component))
  }

  static get(component, context) {
    return context instanceof DitoContext
      ? context
      : new DitoContext(component, context)
  }

  get value() {
    return get(this, 'value')
  }

  get name() {
    return get(this, 'name') ?? getParentKey(this.dataPath)
  }

  get index() {
    return get(this, 'index') ?? getParentIndex(this.dataPath)
  }

  get dataPath() {
    return get(this, 'dataPath') || ''
  }

  get item() {
    // NOTE: While internally, we speak of `data`, in the API surface the
    // term `item` is used for the data that relates to editing objects:
    // If `data` isn't provided, we can determine it from rootData & dataPath:
    return get(this, 'data') || getItem(this.rootItem, this.dataPath, true)
  }

  // NOTE: `parentItem` isn't the closest data parent to `item`, it's the
  // closest parent that isn't an array, e.g. for relations or nested JSON
  // data.  This is why the term `item` was chosen over `data`, e.g. VS the
  // use of `parentData` in server-sided validation, which is the closest
  // parent. If needed, we could expose this data here too, as we can do all
  // sorts of data processing with `rootData` and `dataPath`.
  get parentItem() {
    const parentItem = getParentItem(this.rootItem, this.dataPath, true) || null
    return parentItem !== this.item ? parentItem : null
  }

  get rootItem() {
    return get(this, 'rootData') || null
  }

  get processedItem() {
    return get(this, 'processedData') || null
  }

  get user() {
    return get(this, 'user') || null
  }

  get api() {
    return get(this, 'api') || null
  }

  get itemLabel() {
    return get(this, 'itemLabel') || null
  }

  get formLabel() {
    return get(this, 'formLabel') || null
  }

  get component() {
    return get(this, 'component') || null
  }

  // TODO: `DitoContext.target` was deprecated in favor of
  // `DitoContext.component` on 2020-09-11, remove later.
  get target() {
    return this.component
  }

  get schemaComponent() {
    return get(this, 'schemaComponent') || null
  }

  get formComponent() {
    return get(this, 'formComponent') || null
  }

  get viewComponent() {
    return get(this, 'viewComponent') || null
  }

  get dialogComponent() {
    return get(this, 'dialogComponent') || null
  }

  get panelComponent() {
    return get(this, 'panelComponent') || null
  }

  get resourceComponent() {
    return get(this, 'resourceComponent') || null
  }

  get sourceComponent() {
    return get(this, 'sourceComponent') || null
  }

  // When used in OptionsMixin for `schema.options.value`,
  // `schema.options.label`, `schema.search.filter`:
  get option() {
    return get(this, 'option')
  }

  get options() {
    return get(this, 'options')
  }

  // TODO: Rename this to `searchTerm` or `searchQuery`, to perhaps free `query`
  // for the actual `resourceComponent.query` object?
  get query() {
    return get(this, 'query')
  }

  // The error field is only populated in the context of buttons that send
  // requests, see `ResourceMixin.emitButtonEvent()`:
  get error() {
    return get(this, 'error')
  }

  get wasNotified() {
    return get(this, 'wasNotified') ?? false
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
