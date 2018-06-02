import Registry from './Registry'
import { parameters } from '@/decorators'

export const QueryFilters = new Registry()

QueryFilters.register({
  @parameters(
    {
      name: 'operator',
      type: 'string'
    },
    {
      name: 'text',
      type: 'string'
    }
  )
  text(builder, property, operator, text) {
    if (text === undefined) {
      text = operator
      operator = 'contains'
    }
    const templates = {
      equals: text => text,
      contains: text => `%${text}%`,
      'starts-with': text => `${text}%`,
      'ends-with': text => `%${text}`
    }
    const operand = templates[operator]?.(text) || ''
    if (operand) {
      builder.where(property, 'ilike', operand)
    }
  },

  @parameters(
    {
      name: 'from',
      type: 'date'
    },
    {
      name: 'to',
      type: 'date'
    }
  )
  'date-range'(builder, property, from, to) {
    builder.whereBetween(property, [new Date(from), new Date(to)])
  }
})
