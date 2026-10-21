import { defineCases, type TypeCase } from './define.js'

// Cases shared by all input types, generated from one sample per type: a
// value stored before the test, and another value to enter.

interface Sample {
  property: Record<string, unknown>
  /** Base schema, e.g. with options. */
  schema?: Record<string, unknown>
  seed: unknown
  value: unknown
  /** Whether the type supports `required`. */
  required?: boolean
  /** Whether the type has a clear button with `clearable`. */
  clearable?: boolean
}

const sizes = [
  { label: 'Small', value: 's' },
  { label: 'Medium', value: 'm' },
  { label: 'Large', value: 'l' }
]

const string = { type: 'string' }

const text = (seed: string, value: string): Sample => ({
  property: string,
  seed,
  value,
  required: true,
  clearable: true
})

const samples: Record<string, Sample> = {
  text: text('Hello', 'Changed'),
  email: text('a@example.com', 'b@example.com'),
  url: text('https://a.com', 'https://b.com'),
  hostname: text('a.example.com', 'b.example.com'),
  domain: text('a.com', 'b.com'),
  tel: text('+41 1', '+41 2'),
  password: text('secret', 'changed'),
  creditcard: text('4111111111111111', '5555555555554444'),
  textarea: { ...text('A', 'B'), property: { type: 'text' }, clearable: false },
  number: {
    ...text('', ''),
    property: { type: 'number' },
    seed: 1,
    value: '2'
  },
  integer: {
    ...text('', ''),
    property: { type: 'integer' },
    seed: 1,
    value: '2'
  },
  switch: { property: { type: 'boolean' }, seed: true, value: false },
  checkbox: { property: { type: 'boolean' }, seed: true, value: false },
  select: { ...text('s', 'Large'), schema: { options: sizes } },
  radio: {
    ...text('s', 'Large'),
    schema: { options: sizes },
    clearable: false
  },
  checkboxes: {
    property: { type: 'array' },
    schema: { options: sizes },
    seed: ['s'],
    value: ['Large'],
    required: true
  },
  multiselect: { ...text('s', 'Large'), schema: { options: sizes } },
  slider: {
    property: { type: 'number' },
    schema: { range: [0, 10] },
    seed: 3,
    value: '7',
    required: true
  },
  color: text('#ff0000', '00ff00'),
  date: {
    ...text('', ''),
    property: { type: 'date' },
    seed: '2026-05-14',
    value: 'June 1, 2026'
  },
  datetime: {
    ...text('', ''),
    property: { type: 'datetime' },
    seed: '2026-05-14T09:30:00.000Z',
    value: 'June 1, 2026, 10:00:00 AM'
  },
  code: { ...text('a', 'b'), property: { type: 'text' }, clearable: false },
  markup: {
    ...text('<p>A</p>', 'B'),
    property: { type: 'text' },
    clearable: false
  }
}

function getSharedCases(sample: Sample): TypeCase[] {
  const { schema = {}, seed, value } = sample
  const unchangeable = (title: string, extra: Record<string, unknown>) => ({
    title,
    schema: { ...schema, ...extra },
    seed,
    value,
    state: 'unchangeable' as const
  })
  return [
    ...(
      sample.required
        ? [
            {
              title: 'is required with required',
              schema: { ...schema, required: true },
              invalid: true
            }
          ]
        : []
    ),
    ...(
      sample.clearable
        ? [
            {
              title: 'clears the value with clearable',
              schema: { ...schema, clearable: true },
              seed,
              value: { clear: true },
              stored: null
            }
          ]
        : []
    ),
    unchangeable('cannot be changed with readonly', { readonly: true }),
    unchangeable('cannot be changed with disabled', { disabled: true }),
    unchangeable('cannot be changed with a disabled function', {
      disabled: () => true
    }),
    {
      title: 'is hidden with visible: false',
      schema: { ...schema, visible: false },
      state: 'hidden'
    },
    {
      title: 'is not rendered with if: false',
      schema: { ...schema, if: false },
      state: 'hidden'
    }
  ]
}

export default Object.entries(samples).map(([type, sample]) =>
  defineCases(type, sample.property, getSharedCases(sample))
)
