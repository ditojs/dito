import { toRaw } from 'vue'
import { getValueAtDataPath, isFunction } from '@ditojs/utils'
import {
  appendDataPath,
  getItemDataPath,
  getParentItemDataPath,
  getParentItem,
  getItem,
  getLastDataPathName,
  getLastDataPathIndex,
  getRelativeDataPath
} from './utils/data.js'
import { hasNestedData, isButton } from './utils/schema/structure.js'
import { getTextFromHtml } from './utils/html.js'

const { hasOwnProperty } = Object.prototype

// See also `ContextMixin`: `DitoContext` instances are a thin wrapper around
// raw `context` objects, which themselves actually inherit from the linked
// `component` instance, so that they only need to provide the values that
// should be different than in the underlying component. In order to not expose
// all fields from the component, the wrapper is introduced.

// Use WeakMap for the raw `context` objects, so we don't have to pollute the
// actual `DitoContext` instance with it.
const contexts = new WeakMap()

function toObject(context) {
  const rawStart = toRaw(context)
  let raw = rawStart
  let object
  // In case `DitoContext.extend()` was used, we need to find the actual context
  // object from the object's the inheritance chain:
  do {
    object = contexts.get(raw)
    if (object) break
    raw = Object.getPrototypeOf(raw)
  } while (raw)
  if (object && raw !== rawStart) {
    // Assign the passed context with the original object as well, so we don't
    // have to search for it again:
    contexts.set(raw, object)
  }
  return object
}

function get(context, key, defaultValue) {
  const object = toObject(context)
  const value = key in object ? object[key] : undefined
  // If `object` explicitly sets the key to `undefined`, return it.
  return value !== undefined || hasOwnProperty.call(object, key)
    ? value
    : isFunction(defaultValue)
      ? defaultValue()
      : defaultValue
}

function set(context, key, value) {
  // Define the value on the context object itself: An assignment would be
  // passed on to the component that the object inherits from, see
  // `DitoContext` constructor, and change its state for all its contexts.
  Object.defineProperty(toObject(context), key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  })
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

  // Creates the context of the component described by `schema` and `name` in
  // `data`, e.g. to evaluate its `if` before it's rendered, the same way as
  // once it's rendered. Its `value` is read from `data` only when it's used,
  // so that watchers only depend on it if it's used, and missing values don't
  // need to be resolved through the data path.
  static createForSchema(component, {
    schema,
    name,
    nested = hasNestedData(schema),
    data,
    dataPath,
    rootData
  }) {
    // Pass a function, so that the `value` getter isn't evaluated when the
    // context is created.
    return new DitoContext(component, () => ({
      schema,
      name,
      nested,
      data,
      dataPath,
      rootData,
      get value() {
        return name != null ? data?.[name] : undefined
      }
    }))
  }

  // Creates the context of a component of this context's schema, e.g. of a
  // section, the same way as when that component is rendered: Its data is the
  // value of this context's component if that is nested, or else the same
  // data. The data path adds `name` if the child component is nested.
  createChildContext(schema, name) {
    const nested = hasNestedData(schema)
    // Contexts without a schema don't hold a value either, e.g. the ones of
    // `DitoMenu` and `DitoPanels`, evaluating views and panels.
    const holdsOwnValue = !!this.schema && hasNestedData(this.schema)
    return DitoContext.createForSchema(getComponent(this), {
      schema,
      name,
      nested,
      // Read the value from the item that holds it rather than through the data
      // path, as items that are being created aren't part of the root data.
      data: holdsOwnValue ? this.item?.[this.name] : this.item,
      dataPath: nested ? appendDataPath(this.dataPath, name) : this.dataPath,
      rootData: this.rootItem
    })
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
    const object = toObject(this)
    // Type components hold their value, also while it's `undefined`, e.g. a
    // computed value that the data model hasn't written yet. Other components
    // don't hold a value, but if they're nested, we can get it from the root,
    // or `undefined` if it's missing there.
    return 'value' in object
      ? object.value
      : this.nested
        ? getValueAtDataPath(this.rootItem, this.dataPath, () => undefined)
        : undefined
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
  get item() {
    return get(
      this,
      'data',
      // If `data` isn't provided, we can determine it from rootData & dataPath:
      () => getItem(this.rootItem, this.dataPath, this.nested) || null
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
      getParentItem(this.rootItem, this.dataPath, this.nested) || null
    )
    return item !== this.item ? item : null
  }

  get rootItem() {
    return get(this, 'rootData', null)
  }

  // The processed items are built for the server when they're read, except
  // in `process()`, which receives the ones being built:
  get processedItem() {
    return get(this, 'processedData', () =>
      getProcessedData(this, this.dataPath, this.nested)
    )
  }

  get processedRootItem() {
    return get(
      this,
      'processedRootData',
      () => getComponent(this)?.dataModel?.processedRootData.value ?? null
    )
  }

  get clipboardItem() {
    return get(this, 'clipboardData', null)
  }

  get user() {
    return getAdminValue(this, 'user')
  }

  get api() {
    return getAdminValue(this, 'api')
  }

  get views() {
    return getAdminValue(this, 'views')
  }

  get flattenedViews() {
    return getAdminValue(this, 'flattenedViews')
  }

  // The label of the item as HTML, with escaped item values, see
  // `getItemLabel()`.
  get itemLabel() {
    return get(this, 'itemLabel', null)
  }

  // The text of `itemLabel`, with its escaped item values unescaped, e.g. for
  // places that don't display HTML.
  get itemLabelText() {
    return getTextFromHtml(this.itemLabel)
  }

  get formLabel() {
    return get(this, 'formLabel', null)
  }

  // When used in OptionsMixin for `schema.options.value()`,
  // `schema.options.label()` and  `schema.search.filter()` callbacks:
  get option() {
    return get(this, 'option', undefined)
  }

  get options() {
    return get(this, 'options', undefined)
  }

  // Whether `schema.options.label()` renders the label of the selected value,
  // e.g. of a closed multiselect or its tags, rather than of an option in the
  // list of options:
  get isValueLabel() {
    return get(this, 'isValueLabel', false)
  }

  // Whether a collapsible schema opens, in its `open` event:
  get open() {
    return get(this, 'open', undefined)
  }

  // For search term in selects:
  get searchTerm() {
    return get(this, 'searchTerm', undefined)
  }

  // The error field is only populated in the context of buttons that send
  // requests, see `ResourceMixin.emitButtonEvent()`:
  get error() {
    return get(this, 'error', undefined)
  }

  get wasNotified() {
    return get(this, 'wasNotified', false)
  }

  // Whether the action of the component is running, e.g. the click handler of
  // a button, which disables it. Handlers can set it to `false` to end it
  // early, e.g. before opening a dialog. This changes the state of the
  // component, which resets it when the action ends.
  get isRunning() {
    return get(this, 'isRunning', false)
  }

  set isRunning(value) {
    const component = getComponent(this)
    if (component && 'isRunning' in component) {
      component.isRunning = value
    } else {
      set(this, 'isRunning', value)
    }
  }

  // The state of the data of the context's form, view, dialog or panel with
  // its own data. Nested forms that mutate their item share the parent's data:
  get isDirty() {
    return !!getDataModelComponent(this)?.dataModel.isDirty
  }

  // Only forms that create their item are creating:
  get isCreating() {
    return !!getDataModelComponent(this)?.isCreating
  }

  // The name of the selected tab of the nearest form, if it has tabs:
  get selectedTab() {
    return (
      getComponent(this).formComponent?.mainSchemaComponent?.selectedTab ??
      null
    )
  }

  get routeQuery() {
    return getAdmin(this).router.currentRoute.value.query
  }

  // The query of the nearest list, e.g. its scope, page, order and filters:
  get listQuery() {
    return getComponent(this).sourceComponent?.query ?? null
  }

  // Helper Methods

  get request() {
    return options => getComponent(this).request(options)
  }

  get format() {
    return (value, options) => getComponent(this).format(value, options)
  }

  get navigate() {
    return location => getAdmin(this).router.push(location)
  }

  get getRouteUrl() {
    return location => getAdmin(this).router.resolve(location).href
  }

  get download() {
    return options => getComponent(this).download(options)
  }

  // Without `resource`, return the URL of the nearest form or list with a
  // resource: of the item that the form edits, or of the collection that the
  // list loads or the form creates its item in.
  get getResourceUrl() {
    return resource => {
      const component = getComponent(this)
      resource ??= component.resourceComponent?.resource
      if (!resource) {
        throw new Error(
          'Unable to get the resource URL: There is no form or list with a ' +
          'resource.'
        )
      }
      return component.getResourceUrl(resource)
    }
  }

  get notify() {
    return options => {
      getAdmin(this).notify(options)
      set(this, 'wasNotified', true)
    }
  }

  // Validate the data, or only the values whose data paths match `match`, and
  // show their errors. Return whether they're valid:
  get validate() {
    return match =>
      getDataModelComponent(this).mainSchemaComponent.validateAll(match)
  }

  // Like `validate()`, but without showing the errors:
  get verify() {
    return match =>
      getDataModelComponent(this).mainSchemaComponent.verifyAll(match)
  }

  get markEdited() {
    return () => getDataModelComponent(this).dataModel.markEdited()
  }

  // Forms merge `data` into their item, the others replace their data with it,
  // which their data model sets up with the defaults right away:
  get replaceItem() {
    return data => getDataModelComponent(this).setData(data)
  }

  // Submit the data through the button of the context, like buttons with a
  // resource do when clicked, and resolve with whether it succeeded:
  get submit() {
    return options => {
      const component = getComponent(this)
      if (!isButton(component.schema) || !component.resourceComponent) {
        throw new Error(
          'Unable to submit: There is no button of a form or of a list with a ' +
          'resource.'
        )
      }
      return component.submit(options)
    }
  }

  get closeForm() {
    return () => {
      const { formComponent } = getComponent(this)
      if (!formComponent) {
        throw new Error('Unable to close the form: There is no form.')
      }
      return formComponent.close()
    }
  }

  // Resolves with the value that the dialog is closed with, see `closeDialog()`
  // in the contexts of the dialog's components.
  get showDialog() {
    return (schema, options) => getAdmin(this).showDialog(schema, options)
  }

  get closeDialog() {
    return value => {
      const { dialogComponent } = getComponent(this)
      if (!dialogComponent) {
        throw new Error('Unable to close the dialog: There is no dialog.')
      }
      dialogComponent.resolve(value)
    }
  }
}

function getComponent(context) {
  return toObject(context).component
}

function getAdmin(context) {
  return getComponent(context).admin
}

// Read the members of the admin's context, unless the context overrides them,
// or `null` for contexts without components:
function getAdminValue(context, key) {
  return get(context, key, () => getComponent(context)?.admin?.[key] ?? null)
}

function getDataModelComponent(context) {
  return getComponent(context)?.dataModelComponent ?? null
}

// Returns the item at `dataPath` in the data that the model holding it
// processed for the server.
function getProcessedData(context, dataPath, nested) {
  let dataModel = getComponent(context)?.dataModel
  let path = null
  while (dataModel) {
    path = getRelativeDataPath(dataPath, dataModel.dataPath)
    if (path !== null) break
    dataModel = dataModel.component.parentComponent?.dataModel
  }
  return dataModel
    ? getItem(dataModel.processedData.value, path, nested) || null
    : null
}
