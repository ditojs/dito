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
      'equals': text => text,
      'contains': text => `%${text}%`,
      'starts-with': text => `${text}%`,
      'ends-with': text => `%${text}`
    }
    if (text) {
      const operand = templates[operator]?.(text)
      if (operand) {
        builder.where(property, 'ilike', operand)
      }
    }
  },

  @parameters(
    {
      name: 'from',
      type: 'datetime',
      nullable: true
    },
    {
      name: 'to',
      type: 'datetime',
      nullable: true
    }
  )
  'date-range'(builder, property, from, to) {
    if (from && to) {
      builder.whereBetween(property, [new Date(from), new Date(to)])
    } else if (from) {
      builder.where(property, '>=', new Date(from))
    } else if (to) {
      builder.where(property, '<=', new Date(to))
    } else {
      // TODO: Can we get validation to catch the case where both are empty?
    }
  }
})
