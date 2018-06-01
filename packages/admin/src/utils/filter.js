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

export function convertFiltersSchema(filters) {
  const comps = {}
  for (const filter of Object.values(filters || {})) {
    const { type } = filter
    const components = type
      ? filterComponents[type](filter)
      : filter.components
    if (components) {
      const form = type
        ? {}
        : { ...filter }
      form.components = {}
      // Convert labels to placeholders:
      for (const [key, schema] of Object.entries(components)) {
        const label = schema.label || labelize(schema.name || key)
        form.components[key] = {
          ...schema,
          label: false,
          placeholder: label
        }
      }
      comps[filter.name] = {
        label: form.label,
        type: 'object',
        form,
        nested: true,
        inline: true
      }
    }
  }
  return {
    components: comps
  }
}

export function getComponentsForFilter(filtersSchema, name) {
  const filterComponent = filtersSchema.components[name]
  return filterComponent?.form?.components
}

export function getFiltersData(filtersSchema, query) {
  const filters = {}
  // Same as @ditojs/server's QueryParameters.filter: Translate the data
  // from the query string back to param lists per filter:
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

export function getFiltersQuery(filtersSchema, filtersData) {
  const filters = []
  for (const name in filtersData) {
    const entry = filtersData[name]
    if (Object.keys(entry).length) {
      const args = Object.keys(getComponentsForFilter(filtersSchema, name)).map(
        key => JSON.stringify(entry[key])
      )
      filters.push(`${name}:${args.join(',')}`)
    }
  }
  return filters
}
