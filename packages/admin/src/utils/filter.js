import { asArray, labelize } from '@ditojs/utils'

export const filterComponents = {
  text(filter) {
    const options = [
      {
        label: 'contains',
        value: 'contains'
      },
      {
        label: 'equals',
        value: 'equals'
      },
      {
        label: 'starts with',
        value: 'starts-with'
      },
      {
        label: 'ends with',
        value: 'ends-with'
      }
    ]
    return {
      operator: {
        type: 'select',
        options:
          filter.operators
            ? options.filter(
              option => filter.operators.includes(option.value)
            )
            : options,
        width: '40%'
      },
      text: {
        type: 'text',
        width: '60%'
      }
    }
  },

  'date-range'() {
    return {
      from: {
        type: 'datetime',
        width: '50%'
      },
      to: {
        type: 'datetime',
        width: '50%'
      }
    }
  }
}

export function getFiltersPanel(filters, dataPath, proxy) {
  const panel = {
    label: 'Filters',
    name: 'filters',
    target: dataPath,
    data() {
      return parseFiltersData(
        panel,
        proxy.query
      )
    },
    components: getFiltersComponents(filters),
    buttons: {
      clear: {
        text: 'Clear',
        events: {
          click({ schemaComponent }) {
            schemaComponent.resetData()
            schemaComponent.applyFilters()
          }
        }
      },

      filter: {
        type: 'submit',
        text: 'Filter',
        events: {
          click({ schemaComponent }) {
            schemaComponent.applyFilters()
          }
        }
      }
    },
    methods: {
      applyFilters() {
        const filter = formatFiltersData(this.schema, this.data)
        const query = {
          ...proxy.query,
          filter
        }
        // Reset pagination when applying or clearing filters:
        query.page = undefined
        proxy.query = query
      }
    }
  }
  return panel
}

export function getFiltersComponents(filters) {
  const comps = {}
  for (const filter of Object.values(filters || {})) {
    const { filter: type } = filter
    const components = type
      ? filterComponents[type]?.(filter)
      : filter.components
    if (components) {
      const form = type
        ? {}
        : { ...filter }
      form.components = {}
      // Convert labels to placeholders:
      for (const [key, component] of Object.entries(components)) {
        const label = component.label || labelize(component.name || key)
        form.components[key] = {
          ...component,
          label: false,
          placeholder: label
        }
      }
      comps[filter.name] = {
        label: form.label,
        type: 'object',
        default: () => ({}),
        form,
        nested: true,
        inline: true
      }
    } else {
      throw new Error(
        `Invalid filter '${filter.name}': Unknown filter type '${type}'.`
      )
    }
  }
  return comps
}

export function getComponentsForFilter(filtersSchema, name) {
  const filterComponent = filtersSchema.components[name]
  return filterComponent?.form?.components
}

export function parseFiltersData(filtersSchema, query) {
  const filters = {}
  // Same as @ditojs/server's QueryParameters.filter: Translate the string data
  // from $route.query back to param lists per filter:
  if (query) {
    for (const filter of asArray(query.filter)) {
      const [, name, json] = filter.match(/^(\w+):(.*)$/)
      try {
        filters[name] = asArray(JSON.parse(`[${json}]`))
      } catch (error) {
      }
    }
  }
  const filtersData = {}
  for (const name in filtersSchema.components) {
    const data = {}
    // If we have retrieved params from the query, fetch the associated
    // form components so we can map the values back to object keys:
    const args = filters[name]
    if (args) {
      const filterComponents = getComponentsForFilter(filtersSchema, name)
      if (filterComponents) {
        let index = 0
        for (const key in filterComponents) {
          data[key] = args[index++]
        }
      }
    }
    filtersData[name] = data
  }
  return filtersData
}

export function formatFiltersData(filtersSchema, filtersData) {
  const filters = []
  for (const name in filtersData) {
    const entry = filtersData[name]
    if (entry) {
      // Map components sequence to arguments:
      const args = Object.keys(getComponentsForFilter(filtersSchema, name)).map(
        key => entry[key] ?? null
      )
      // Only apply filter if there are some arguments that aren't null:
      if (args.some(value => value !== null)) {
        filters.push(`${name}:${args.map(JSON.stringify).join(',')}`)
      }
    }
  }
  return filters
}
