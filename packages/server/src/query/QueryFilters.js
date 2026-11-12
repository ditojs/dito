import { isArray } from '@ditojs/utils'
import Registry from './Registry.js'
export const QueryFilters = new Registry()

QueryFilters.register({
  'text': {
    parameters: {
      operator: {
        type: 'string'
      },
      text: {
        type: 'string'
      }
    },

    handler(query, property, { operator, text }) {
      if (text === undefined) {
        text = operator
        operator = null
      }
      operator ||= 'contains'
      const templates = {
        'equals': text => text,
        'contains': text => `%${text}%`,
        'starts-with': text => `${text}%`,
        'ends-with': text => `%${text}`
      }
      if (text) {
        const operand = templates[operator]?.(text)
        if (operand) {
          if (query.isPostgreSQL()) {
            query.where(property, 'ILIKE', operand)
          } else {
            query.whereRaw(
              `LOWER(??) LIKE ?`,
              [property, operand.toLowerCase()]
            )
          }
        }
      }
    }
  },

  'equals': {
    parameters: {
      value: {
        type: ['string', 'number', 'boolean', 'null', 'array'],
        items: { type: ['string', 'number', 'boolean', 'null'] },
        required: true
      }
    },

    handler(query, property, { value }) {
      if (isArray(value)) {
        const values = value.filter(value => value !== null)
        if (values.length < value.length) {
          // `IN (NULL)` matches no rows, so match `null` with `IS NULL`:
          query.where(query =>
            query.whereIn(property, values).orWhereNull(property)
          )
        } else {
          query.whereIn(property, values)
        }
      } else {
        query.where(property, value)
      }
    }
  },

  'date-range': {
    parameters: {
      from: {
        type: 'datetime',
        nullable: true
      },
      to: {
        type: 'datetime',
        nullable: true
      }
    },

    handler(query, property, { from, to }) {
      if (from && to) {
        query.whereBetween(property, [new Date(from), new Date(to)])
      } else if (from) {
        query.where(property, '>=', new Date(from))
      } else if (to) {
        query.where(property, '<=', new Date(to))
      } else {
        // TODO: Can we get validation to catch the case where both are empty?
      }
    }
  }
})
