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
import { hasNestedData } from './utils/schema/structure.js'
import { getTextFromHtml } from './utils/html.js'
import {
  getRootData,
  getResourceUrl,
  request,
  format,
  download
} from './utils/services.ts'

const { hasOwnProperty } = Object.prototype

// The raw context objects of the instances, which inherit from their services:
const contexts = new WeakMap()

export default class SchemaContext {
  constructor(services, context) {
    context = context
      ? isFunction(context)
        ? context()
        : { ...context }
      : {}
    // Default to `true`, so `nested` doesn't fall back to the services:
    context.nested ??= true
    context.services = services
    // `this` is always raw inside the constructor:
    contexts.set(this, Object.setPrototypeOf(context, services))
  }

  // Create the context of a component before it's rendered, e.g. for its `if`.
  static createForSchema(services, {
    schema,
    name,
    nested = hasNestedData(schema),
    data,
    dataPath,
    rootData
  }) {
    // Read `value` only when it's used, so watchers only depend on it then:
    return new SchemaContext(services, () => ({
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

  createChildContext(schema, name) {
    const nested = hasNestedData(schema)
    // Contexts without a schema don't hold a value, e.g. of `DitoMenu`:
    const holdsOwnValue = !!this.schema && hasNestedData(this.schema)
    return SchemaContext.createForSchema(getServices(this), {
      schema,
      name,
      nested,
      // Items that are being created aren't part of the root data:
      data: holdsOwnValue ? this.item?.[this.name] : this.item,
      dataPath: nested ? appendDataPath(this.dataPath, name) : this.dataPath,
      rootData: this.rootItem
    })
  }

  // Override members in a copy that inherits from this context:
  extend(object) {
    return Object.setPrototypeOf(object, this)
  }

  get nested() {
    return get(this, 'nested', true)
  }

  get schema() {
    return get(this, 'schema', null)
  }

  get value() {
    const object = toObject(this)
    // Type components hold their value, also while it's `undefined`, e.g. a
    // computed value that isn't written yet. Others read it from the root:
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

  // NOTE: Internally we speak of `data`, the API of `item`:
  get item() {
    return get(
      this,
      'data',
      () => getItem(this.rootItem, this.dataPath, this.nested) || null
    )
  }

  // NOTE: `parentItem` is the closest parent that isn't an array, unlike
  // `parentData` in the server's validation, which is the closest parent.
  get parentItem() {
    const item = (
      getParentItem(this.rootItem, this.dataPath, this.nested) || null
    )
    return item !== this.item ? item : null
  }

  get rootItem() {
    return get(this, 'rootData', () => {
      const services = getServices(this)
      return services ? getRootData(services) : null
    })
  }

  // `serializeValue()` receives the serialized items being built:
  get serializedItem() {
    return get(this, 'serializedData', () =>
      getSerializedData(this, this.dataPath, this.nested)
    )
  }

  get serializedRootItem() {
    return get(
      this,
      'serializedRootData',
      () => getDataContext(this)?.model.serializedRootData.value ?? null
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

  get itemLabel() {
    return get(this, 'itemLabel', null)
  }

  get itemLabelText() {
    return getTextFromHtml(this.itemLabel)
  }

  get formLabel() {
    return get(this, 'formLabel', null)
  }

  get option() {
    return get(this, 'option', undefined)
  }

  get options() {
    return get(this, 'options', undefined)
  }

  get isSelected() {
    return get(this, 'isSelected', false)
  }

  get open() {
    return get(this, 'open', undefined)
  }

  get searchTerm() {
    return get(this, 'searchTerm', undefined)
  }

  get error() {
    return get(this, 'error', undefined)
  }

  get wasNotified() {
    return get(this, 'wasNotified', false)
  }

  get isRunning() {
    return get(this, 'isRunning', false)
  }

  // Handlers can end the running action early, e.g. before opening a dialog:
  set isRunning(value) {
    // Set the state of components that run actions, e.g. buttons:
    const services = getServices(this)
    if (services && 'isRunning' in services) {
      services.isRunning = value
    } else {
      set(this, 'isRunning', value)
    }
  }

  get isDirty() {
    return !!getDataContext(this)?.isDirty
  }

  get isCreating() {
    return !!getDataContext(this)?.isCreating
  }

  get selectedTab() {
    const { routeContext } = getServices(this)
    return routeContext?.isForm ? routeContext.selectedTab : null
  }

  get routeQuery() {
    return getAdminContext(this).router.currentRoute.value.query
  }

  get sourceQuery() {
    return getServices(this).sourceContext?.listQuery.query ?? null
  }

  get request() {
    return options => request(getServices(this), options)
  }

  get format() {
    return (value, options) => format(getServices(this), value, options)
  }

  get navigate() {
    return location => getAdminContext(this).router.push(location)
  }

  get getRouteUrl() {
    return location => getAdminContext(this).router.resolve(location).href
  }

  get download() {
    return options => download(getServices(this), options)
  }

  get getResourceUrl() {
    return resource => {
      const services = getServices(this)
      resource ??= services.resourceContext?.getResource()
      if (!resource) {
        throw new Error(
          'Unable to get the resource URL: There is no form or list with a ' +
          'resource.'
        )
      }
      return getResourceUrl(services, resource)
    }
  }

  get notify() {
    return options => {
      getAdminContext(this).notify(options)
      set(this, 'wasNotified', true)
    }
  }

  get validate() {
    return match => getDataContextFor(this, 'validate').validate(match)
  }

  get verify() {
    return match => getDataContextFor(this, 'verify').verify(match)
  }

  get markEdited() {
    return () => getDataContextFor(this, 'mark the data edited').markEdited()
  }

  get replaceItem() {
    return data => getDataContextFor(this, 'replace the item').replaceItem(data)
  }

  get submit() {
    return options => {
      const { submit } = getServices(this)
      if (!submit) {
        throw new Error(
          'Unable to submit: There is no button of a form or source.'
        )
      }
      return submit(options)
    }
  }

  get closeForm() {
    return () => {
      const { routeContext } = getServices(this)
      if (!routeContext?.isForm) {
        throw new Error('Unable to close the form: There is no form.')
      }
      return routeContext.close()
    }
  }

  get showDialog() {
    return (schema, options) =>
      getAdminContext(this).showDialog(schema, options)
  }

  get closeDialog() {
    return value => {
      const closeDialog = getDataContext(this)?.closeDialog
      if (!closeDialog) {
        throw new Error('Unable to close the dialog: There is no dialog.')
      }
      closeDialog(value)
    }
  }
}

function getServices(context) {
  return toObject(context).services
}

function getAdminContext(context) {
  return getServices(context).adminContext
}

// Contexts may override the admin's members, and lack services:
function getAdminValue(context, key) {
  return get(
    context,
    key,
    () => getServices(context)?.adminContext?.[key] ?? null
  )
}

function getDataContext(context) {
  return getServices(context)?.dataContext ?? null
}

// Components outside of views, forms, dialogs and panels, e.g. menus, have no
// data to act on:
function getDataContextFor(context, action) {
  const dataContext = getDataContext(context)
  if (!dataContext) {
    throw new Error(`Unable to ${action}: There is no data.`)
  }
  return dataContext
}

// Find the model that holds `dataPath`, in its own data or its parent's:
function getSerializedData(context, dataPath, nested) {
  let dataModel = getDataContext(context)?.model
  let path = null
  while (dataModel) {
    path = getRelativeDataPath(dataPath, dataModel.dataPath)
    if (path !== null) break
    dataModel = dataModel.parent
  }
  return dataModel
    ? getItem(dataModel.serializedData.value, path, nested) || null
    : null
}

function toObject(context) {
  const rawStart = toRaw(context)
  let raw = rawStart
  let object
  // Find the context object of extended contexts in their prototype chain:
  do {
    object = contexts.get(raw)
    if (object) break
    raw = Object.getPrototypeOf(raw)
  } while (raw)
  if (object && raw !== rawStart) {
    contexts.set(rawStart, object) // Don't search for it again.
  }
  return object
}

function get(context, key, defaultValue) {
  const object = toObject(context)
  const value = key in object ? object[key] : undefined
  // Keys explicitly set to `undefined` return it, instead of the default:
  return value !== undefined || hasOwnProperty.call(object, key)
    ? value
    : isFunction(defaultValue)
      ? defaultValue()
      : defaultValue
}

function set(context, key, value) {
  // An assignment would change the services that the object inherits from:
  Object.defineProperty(toObject(context), key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  })
}
