export default {
  firstName: {
    type: 'string',
    required: true
  },
  lastName: {
    type: 'string',
    required: true
  },
  fullName: {
    type: 'string',
    computed: true
  },
  prefix: 'string',
  country: {
    type: 'string',
    required: true
  },
  dateOfBirth: {
    type: 'date'
  },
  email: {
    type: 'string',
    format: 'email'
  },
  dogs: {
    type: 'array',
    items: {
      type: 'string'
    }
  },
  age: 'integer',
  factor: {
    type: 'number',
    range: [0, 50],
    required: true
  },
  colors: {
    type: 'array',
    items: {
      type: 'string'
    }
  },
  verified: 'boolean',
  comments: 'string'
}
