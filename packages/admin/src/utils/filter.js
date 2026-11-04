import {
  isArray,
  isDate,
  isObject,
  asArray,
  equals,
  labelize,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import { getText } from './html.js'
import { iterateNestedSchemaComponents } from './schema/structure.js'
import { getNamedSchemas, getFormSchemas } from './schema/lookup.js'
import { applySchemaDefaults } from './schema/setup.js'
import { walkData } from './schema/walk.js'

export const filterComponents = {
  'text'(filter) {
    const options = [
      { label: 'contains', value: 'contains' },
      { label: 'equals', value: 'equals' },
      { label: 'starts with', value: 'starts-with' },
      { label: 'ends with', value: 'ends-with' }
    ]
    return {
      operator: filter.operators
        ? {
            type: 'select',
            width: '2/5',
            options: isArray(filter.operators)
              ? options.filter(
                  option => filter.operators.includes(option.value)
                )
              : options,
            clearable: true
          }
        : null,
      text: {
        type: 'text',
        width: filter.operators ? '3/5' : 'fill',
        clearable: true
      }
    }
  },

  'date-range'() {
    const datetime = {
      type: 'datetime',
      width: '1/2',
      formats: {
        // Use shorter date format in date-range filters:
        date: { day: '2-digit', month: '2-digit', year: 'numeric' }
      },
      clearable: true
    }
    return { from: datetime, to: datetime }
  }
}

export function createFiltersPanel(api, filters, dataPath, query) {
  const { sticky, ...filterSchemas } = filters
  // The contexts of the filters' change events are the ones of the changed
  // filters, so we keep the panel's data to apply it on changes:
  let filtersData = null

  const applyFilters = data => {
    query.value = {
      ...query.value,
      ...clearFilters(panel),
      ...formatFiltersData(panel, data),
      // Clear pagination when applying or clearing filters:
      page: undefined
    }
  }

  const createButtons = small => ({
    clear: {
      type: 'button',
      text: small ? null : 'Clear',
      disabled: ({ item }) => (
        Object.keys(formatFiltersData(panel, item)).length === 0
      ),
      onClick({ resetItem }) {
        filtersData = resetItem()
        applyFilters(filtersData)
      }
    },

    submit: {
      type: 'submit',
      text: small ? null : 'Filter',
      visible: !small,
      onClick({ item }) {
        applyFilters(item)
      }
    }
  })

  const panel = {
    type: 'panel',
    label: 'Filters',
    name: '$filters',
    disabled: false,
    sticky,

    data() {
      // The query holds the values as strings:
      filtersData = parseFiltersData(panel, query.value)
      return filtersData
    },

    fields: createFiltersComponents(filterSchemas),
    buttons: createButtons(false),
    panelButtons: createButtons(true),

    onChange() {
      applyFilters(filtersData)
    }
  }
  applyNestedSchemaDefaults(api, panel)
  return panel
}

export function applyNestedSchemaDefaults(api, schema) {
  // A sync version of the defaults of `setupSchemaComponents()`, for filters:
  iterateNestedSchemaComponents(schema, (component, name) => {
    applySchemaDefaults(api, component, name)
    const forms = getFormSchemas(component)
    for (const form of Object.values(forms)) {
      applyNestedSchemaDefaults(api, form)
    }
  })
}

function getDataName(filterName) {
  // Prefix filter data keys with '$' to avoid conflicts with other data keys:
  return `$${filterName}`
}

// The server keys the validation errors of filters by filter name and
// argument index, e.g. `title/1`, while the panel keys the filter data by data
// name and component, `$title/text`. Arguments past the last component belong
// to its array, see `formatFiltersData()`:
export function getFiltersDataErrors(errors, schema = null) {
  const dataErrors = {}
  for (const [dataPath, errs] of Object.entries(errors)) {
    const [token, key, ...rest] = parseDataPath(normalizeDataPath(dataPath))
    const dataName =
      !token || token.startsWith('$') ? token : getDataName(token)
    const keys = Object.keys(getComponentsForFilter(schema, dataName) ?? {})
    const filtersDataPath = [
      dataName,
      ...(
        key !== undefined
          ? [/^\d+$/.test(key) ? (keys[key] ?? keys.at(-1) ?? key) : key]
          : []
      ),
      ...rest
    ].join('/')
    dataErrors[filtersDataPath] = [
      ...(dataErrors[filtersDataPath] ?? []),
      ...errs
    ]
  }
  return dataErrors
}

function getFilterName(dataName) {
  return dataName.startsWith('$') ? dataName.slice(1) : null
}

function createFiltersComponents(filters) {
  const comps = {}
  for (const filter of Object.values(getNamedSchemas(filters) || {})) {
    // Use the properties of default filters as the base of `form` too, so
    // things like `label` can be changed:
    const { filter: type, width, ...form } = filter
    const fields = type
      ? filterComponents[type]?.(filter)
      : filter.fields
    if (fields) {
      form.type = 'form'
      form.fields = {}
      // Convert labels to placeholders, which are text:
      for (const [key, component] of Object.entries(fields)) {
        if (component) {
          const { label } = component
          form.fields[key] = {
            ...component,
            label: false,
            placeholder: isObject(label)
              ? getText(label)
              : label || labelize(component.name || key)
          }
        }
      }
      comps[getDataName(filter.name)] = {
        label: form.label ?? labelize(filter.name),
        type: 'object',
        width,
        default: () => ({}),
        form,
        inlined: true
      }
    } else {
      throw new Error(
        `Invalid filter '${filter.name}': Unknown filter type '${type}'.`
      )
    }
  }
  return comps
}

function getComponentsForFilter(schema, dataName) {
  const component = schema?.fields?.[dataName]
  return component?.form?.fields
}

// A filter sends its arguments as repeated `filter[name]` values, one per
// component in order and as strings: dates in ISO format, other values with
// `String()`. Empty values are sent as '' to keep the positions of the ones
// after them, and trailing empty values are left out. An array in the last
// component gives the remaining arguments, e.g. the values of a multiselect.
function formatFiltersData(schema, data) {
  const query = {}
  for (const dataName in data) {
    const entry = data[dataName]
    const components = getComponentsForFilter(schema, dataName)
    if (entry && components) {
      const values = Object.keys(components).map(key => entry[key])
      const last = values.pop()
      const args = [...values, ...asArray(last)].map(formatArgument)
      while (args.at(-1) === '') {
        args.pop()
      }
      if (args.length > 0) {
        query[getFilterKey(getFilterName(dataName))] =
          args.length === 1 ? args[0] : args
      }
    }
  }
  return query
}

function formatArgument(value) {
  return value == null ? '' : isDate(value) ? value.toISOString() : `${value}`
}

function getFilterKey(filterName) {
  return `filter[${filterName}]`
}

// The keys of the panel's filters, set to `undefined` to remove them when the
// query is merged with other filters. The filters of `filterTabs` stay:
function clearFilters(schema) {
  const cleared = {}
  for (const dataName in schema.fields) {
    cleared[getFilterKey(getFilterName(dataName))] = undefined
  }
  return cleared
}

// The query of a tab of `filterTabs`. Its values are strings, as in routes:
export function getTabQuery(tab) {
  const query = {}
  for (const [name, value] of Object.entries(tab?.filter ?? {})) {
    query[getFilterKey(name)] = isArray(value) ? value.map(String) : `${value}`
  }
  return query
}

// The keys of the filters of all tabs:
export function getTabKeys(tabs) {
  const keys = Object.values(tabs ?? {}).flatMap(
    tab => Object.keys(getTabQuery(tab))
  )
  return [...new Set(keys)]
}

// The keys of all tabs, set to `undefined` to remove them from the query:
export function clearTabs(tabs) {
  return Object.fromEntries(getTabKeys(tabs).map(key => [key, undefined]))
}

// The tab that `query` matches, the one with the most filters if several do.
// A tab without filters matches every query.
export function getSelectedTab(tabs, query) {
  let selected = null
  let selectedCount = -1
  for (const tab of Object.values(tabs)) {
    const entries = Object.entries(getTabQuery(tab))
    if (
      entries.length > selectedCount &&
      entries.every(([key, value]) =>
        equals(asArray(query[key]), asArray(value))
      )
    ) {
      selected = tab
      selectedCount = entries.length
    }
  }
  return selected
}

// Read the arguments of the filters back from the query, e.g. of a reloaded
// route, and convert them to the types of their components' properties:
function parseFiltersData(schema, query) {
  const filtersData = {}
  const argumentsByData = new Map()
  for (const dataName in schema.fields) {
    const data = {}
    const components = getComponentsForFilter(schema, dataName)
    const value = query?.[getFilterKey(getFilterName(dataName))]
    if (components && value !== undefined) {
      // Query values without a value, e.g. `?filter[title]`, are `null`:
      const args = asArray(value).map(arg => arg ?? '')
      const keys = Object.keys(components)
      const argumentsByKey = {}
      keys.forEach((key, index) => {
        if (index < args.length) {
          argumentsByKey[key] =
            index < keys.length - 1 ? [args[index]] : args.slice(index)
          // The string, for components that `walkData()` doesn't convert:
          data[key] = parseArgument(null, args[index])
        }
      })
      argumentsByData.set(data, argumentsByKey)
    }
    filtersData[dataName] = data
  }
  return walkData(schema, filtersData, {
    visit(entry) {
      const { node, data, name } = entry
      const args = argumentsByData.get(data)?.[name]
      if (args) {
        const propertyNode = node.getPropertyNode(entry)
        const property = propertyNode?.property ?? {}
        const value =
          property.type === 'array'
            ? args.map(arg => parseArgument(property.items, arg))
            : parseArgument(property, args[0])
        data[name] = propertyNode
          ? propertyNode.deserialize(value, entry)
          : value
      }
    }
  })
}

// '' is an empty argument, see `formatFiltersData()`:
function parseArgument(property, arg) {
  const type = property?.type
  return arg === ''
    ? null
    : type === 'number' || type === 'integer'
      ? Number(arg)
      : type === 'boolean'
        ? arg === 'true'
        : arg
}
