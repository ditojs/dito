import {
  isArray,
  isString,
  asArray,
  labelize,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import { getNamedSchemas } from './schema/lookup.js'
import { applyNestedSchemaDefaults } from './schema/setup.js'
import { deserializeData } from './schema/data.js'

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
      format: {
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
      filter: formatFiltersData(panel, data),
      // Clear pagination when applying or clearing filters:
      page: undefined
    }
  }

  const createButtons = small => ({
    clear: {
      type: 'button',
      text: small ? null : 'Clear',
      disabled: ({ item }) => formatFiltersData(panel, item).length === 0,
      onClick({ replaceItem }) {
        // The data model sets up the new data with the defaults right away,
        // and the errors stay with the replaced data:
        filtersData = replaceItem({})
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
      // The query holds the values serialized, e.g. dates as strings:
      filtersData = deserializeData(panel, parseFiltersData(panel, query.value))
      return filtersData
    },

    components: createFiltersComponents(filterSchemas),
    buttons: createButtons(false),
    panelButtons: createButtons(true),

    onChange() {
      applyFilters(filtersData)
    }
  }
  applyNestedSchemaDefaults(api, panel)
  return panel
}

function getDataName(filterName) {
  // Prefix filter data keys with '$' to avoid conflicts with other data keys:
  return `$${filterName}`
}

// The server keys the validation errors of filters by filter name, e.g.
// `title/text`, while the panel keys the filter data by data name, `$title`:
export function getFiltersDataErrors(errors) {
  const dataErrors = {}
  for (const [dataPath, errs] of Object.entries(errors)) {
    const [token, ...rest] = parseDataPath(normalizeDataPath(dataPath))
    const filtersDataPath = [
      !token || token.startsWith('$') ? token : getDataName(token),
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
    const components = type
      ? filterComponents[type]?.(filter)
      : filter.components
    if (components) {
      form.type = 'form'
      form.components = {}
      // Convert labels to placeholders:
      for (const [key, component] of Object.entries(components)) {
        if (component) {
          const label = component.label || labelize(component.name || key)
          form.components[key] = {
            ...component,
            label: false,
            placeholder: label
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
  const component = schema.components[dataName]
  return component?.form?.components
}

function formatFiltersData(schema, data) {
  const filters = []
  for (const dataName in data) {
    const entry = data[dataName]
    if (entry) {
      // Map components sequence to arguments:
      const args = Object.keys(getComponentsForFilter(schema, dataName)).map(
        key => entry[key] ?? null
      )
      // Only apply filter if there are some arguments that aren't null:
      if (args.some(value => value !== null)) {
        filters.push(
          `${
            getFilterName(dataName)
          }:${
            args.map(JSON.stringify).join(',')
          }`
        )
      }
    }
  }
  return filters
}

function parseFiltersData(schema, query) {
  const filters = {}
  // Same as @ditojs/server's QueryParameters.filter: Translate the string data
  // from $route.query back to param lists per filter:
  if (query) {
    for (const filter of asArray(query.filter)) {
      // Query values without a value, e.g. `?filter`, are `null`:
      const match = isString(filter) ? filter.match(/^(\w+):(.*)$/) : null
      if (!match) {
        console.warn(`Ignoring malformed filter: '${filter}'`)
        continue
      }
      const [, filterName, json] = match
      try {
        filters[filterName] = asArray(JSON.parse(`[${json}]`))
      } catch {}
    }
  }
  const filtersData = {}
  for (const dataName in schema.components) {
    const data = {}
    // Map the params from the query back to the keys of the form components:
    const args = filters[getFilterName(dataName)]
    if (args) {
      const components = getComponentsForFilter(schema, dataName)
      if (components) {
        let index = 0
        for (const key in components) {
          data[key] = args[index++]
        }
      }
    }
    filtersData[dataName] = data
  }
  return filtersData
}
