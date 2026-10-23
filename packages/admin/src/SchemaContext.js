import { toRaw } from 'vue'
import {
  getValueAtDataPath,
  resolveDataPath,
  isFunction,
  isString,
  isArray,
  asArray
} from '@ditojs/utils'
import {
  toModelData,
  appendDataPath,
  getItemDataPath,
  getParentItemDataPath,
  getParentItem,
  getItem,
  getLastDataPathName,
  getLastDataPathIndex,
  getRelativeDataPath
} from './utils/data.js'
import { getSchemaValue } from './utils/schema/data.js'
import { hasNestedData } from './utils/schema/structure.js'
import { navigate } from './utils/route.js'
import {
  getRootData as getServicesRootData,
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
    itemDataPath,
    rootData,
    // Most contexts have no copies, and only a rest keeps them optional in the
    // inferred types:
    ...copies
  }) {
    const { serializedData, serializedRootData } = copies
    // Read `value` only when it's used, so watchers only depend on it then:
    return new SchemaContext(services, () => ({
      schema,
      name,
      nested,
      data,
      dataPath,
      itemDataPath,
      rootData,
      // The copies that walks build, while they build them:
      ...(serializedData && { serializedData, serializedRootData }),
      get value() {
        return name != null ? data?.[name] : undefined
      }
    }))
  }

  createChildContext(schema, name) {
    const nested = hasNestedData(schema)
    // Contexts without a schema don't hold a value, e.g. of `DitoMenu`:
    const holdsOwnValue = !!this.schema && hasNestedData(this.schema)
    const data = getItemData(this)
    return SchemaContext.createForSchema(getServices(this), {
      schema,
      name,
      nested,
      // Items that are being created aren't part of the root data:
      data: holdsOwnValue ? data?.[this.name] : data,
      dataPath: nested ? appendDataPath(this.dataPath, name) : this.dataPath,
      itemDataPath: holdsOwnValue ? this.dataPath : this.itemDataPath,
      rootData: getRootData(this)
    })
  }

  // Override members in a copy that inherits from this context:
  extend(values) {
    return Object.setPrototypeOf(values, this)
  }

  get schema() {
    return get(this, 'schema', null)
  }

  get value() {
    const object = toObject(this)
    const nested = isNested(this)
    // Type components hold their value, also while it's `undefined`, e.g. a
    // computed value that isn't written yet. Others read it from the root:
    const value =
      'value' in object
        ? object.value
        : nested
          ? getValueAtDataPath(
              getRootData(this),
              this.dataPath,
              () => undefined
            )
          : undefined
    return nested ? toEditable(this, value, () => this.dataPath) : value
  }

  get dataPath() {
    return get(this, 'dataPath', '')
  }

  // Event handlers see the data path of the schema that declares them, while
  // `dataPath` is the one of the component that emitted the event:
  get currentDataPath() {
    return get(this, 'currentDataPath', () => this.dataPath)
  }

  get name() {
    return get(this, 'name', () => getLastDataPathName(this.dataPath))
  }

  get valueIndex() {
    return getLastDataPathIndex(this.dataPath)
  }

  // Contexts that receive their item can receive its data path too, e.g. for
  // the wrappers of primitives, which aren't in the root data:
  get itemDataPath() {
    return (
      get(this, 'itemDataPath', null) ??
      getItemDataPath(this.dataPath, isNested(this))
    )
  }

  get parentItemDataPath() {
    return getParentItemDataPath(this.itemDataPath)
  }

  get itemIndex() {
    return getLastDataPathIndex(this.itemDataPath)
  }

  get parentItemIndex() {
    return getLastDataPathIndex(this.parentItemDataPath)
  }

  // NOTE: Internally we speak of `data`, the API of `item`:
  get item() {
    return toEditable(this, getItemData(this), () => this.itemDataPath)
  }

  // NOTE: `parentItem` is the closest parent that isn't an array, unlike
  // `parentData` in the server's validation, which is the closest parent.
  get parentItem() {
    const item = getParentItem(getRootData(this), this.itemDataPath) || null
    return item !== getItemData(this)
      ? toEditable(this, item, () => this.parentItemDataPath)
      : null
  }

  get rootItem() {
    return toEditable(this, getRootData(this), () => '')
  }

  // `serializeValue()` receives the serialized items being built:
  get serializedItem() {
    return get(this, 'serializedData', () =>
      getSerializedData(this, this.itemDataPath)
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

  // The text of the label of the item of the form, computed when it's read:
  get itemLabel() {
    return get(
      this,
      'itemLabel',
      () => getServices(this)?.routeContext?.itemLabel ?? null
    )
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

  get collapsed() {
    return get(this, 'collapsed', undefined)
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
    return get(
      this,
      'sourceQuery',
      () => getServices(this).sourceContext?.listQuery.query ?? null
    )
  }

  get getSchemaValue() {
    return (key, options) =>
      getSchemaValue(key, { ...options, schema: this.schema, context: this })
  }

  // Resolve data paths like `dataPath` of schemas, relative to the item:
  get getValueAt() {
    // Data that isn't there, e.g. after it was reset by code, has no value:
    return dataPath =>
      getValueAtDataPath(
        this.rootItem,
        resolveDataPath(this.itemDataPath, dataPath),
        () => undefined
      )
  }

  get request() {
    return options => request(getServices(this), options)
  }

  get format() {
    return (value, options) => format(getServices(this), value, options)
  }

  get navigate() {
    return location => navigate(getAdminContext(this).router, location)
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
    return match =>
      getDataContextFor(this, 'validate').validate(resolveMatch(this, match))
  }

  get isValid() {
    return match =>
      getDataContextFor(this, 'verify').verify(resolveMatch(this, match))
  }

  get getErrors() {
    return match =>
      getDataContextFor(this, 'get the errors').getErrors(
        resolveMatch(this, match)
      )
  }

  get clearErrors() {
    return match =>
      getDataContextFor(this, 'clear the errors').clearErrors(
        resolveMatch(this, match)
      )
  }

  get markDirty() {
    return () => getDataContextFor(this, 'mark the data dirty').markEdited()
  }

  get resetItem() {
    return (data = {}) =>
      getDataContextFor(this, 'reset the item').resetItem(toModelData(data))
  }

  get mergeItem() {
    return data =>
      getDataContextFor(this, 'merge the item').mergeItem(toModelData(data))
  }

  get submit() {
    return options => {
      const { submit, dataContext } = getServices(this)
      if (submit) {
        return submit(options)
      } else if (dataContext?.submit) {
        // Outside of buttons, forms submit with their submit button:
        return dataContext.submit(null, options)
      } else {
        throw new Error(
          'Unable to submit: There is no button of a form or source.'
        )
      }
    }
  }

  // Reload the items of the list or object that the component is or is in:
  get reload() {
    return async () => {
      const { sourceContext } = getServices(this)
      if (!sourceContext) {
        throw new Error('Unable to reload: There is no list or object.')
      }
      await sourceContext.reload()
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
    return options => getAdminContext(this).showDialog(options)
  }

  get confirm() {
    return (message, options) => getAdminContext(this).confirm(message, options)
  }

  get prompt() {
    return (message, options) => getAdminContext(this).prompt(message, options)
  }

  get alert() {
    return (message, options) => getAdminContext(this).alert(message, options)
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

// Whether the context describes the value at `dataPath`, under its name:
function isNested(context) {
  return get(context, 'nested', false)
}

// The data of the context, which its getters hand out editable:
function getItemData(context) {
  return get(
    context,
    'data',
    () => getItem(getRootData(context), context.itemDataPath) || null
  )
}

function getRootData(context) {
  return get(context, 'rootData', () => {
    const services = getServices(context)
    return services ? getServicesRootData(services) : null
  })
}

// Hand out the data of the data model editable, so that writes of app code
// through it are edits, see `DataModel.toEditable()`. Its objects keep their
// identity in all contexts of the model:
function toEditable(context, value, getDataPath) {
  const model = getDataContext(context)?.model
  return model ? model.toEditable(value, getDataPath) : value
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

// Resolve the data paths in `match` relative to the item. Regular expressions
// and functions match the absolute data paths:
function resolveMatch(context, match) {
  return isString(match) || isArray(match)
    ? asArray(match).map(path => resolveDataPath(context.itemDataPath, path))
    : match
}

// Find the model that holds `dataPath`, in its own data or its parent's:
function getSerializedData(context, dataPath) {
  let dataModel = getDataContext(context)?.model
  let path = null
  while (dataModel) {
    path = getRelativeDataPath(dataPath, dataModel.dataPath)
    if (path !== null) break
    dataModel = dataModel.parent
  }
  return dataModel
    ? getItem(dataModel.serializedData.value, path) || null
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
