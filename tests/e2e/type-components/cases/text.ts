import { defineCases } from './define.js'

const string = { type: 'string' }

export default [
  defineCases('text', string, [
    { title: 'stores the entered text', value: 'Hello', stored: 'Hello' },
    { title: 'shows a stored value', seed: 'Seeded', shown: 'Seeded' },
    {
      title: 'keeps whitespace by default',
      value: '  Hi  ',
      stored: '  Hi  '
    },
    {
      title: 'trims whitespace with trim',
      schema: { trim: true },
      value: '  Hi  ',
      stored: 'Hi',
      shown: 'Hi'
    },
    {
      title: 'stores null for an empty value',
      seed: 'Seeded',
      value: '',
      stored: null
    }
  ]),
  defineCases('email', string, [
    {
      title: 'stores a valid email address',
      value: 'name@example.com',
      stored: 'name@example.com'
    },
    { title: 'rejects an invalid email address', value: 'name@', invalid: true }
  ]),
  defineCases('url', string, [
    {
      title: 'stores a valid url',
      value: 'https://example.com/path',
      stored: 'https://example.com/path'
    },
    { title: 'rejects an invalid url', value: 'not a url', invalid: true }
  ]),
  defineCases('hostname', string, [
    {
      title: 'stores a valid hostname',
      value: 'www.example.com',
      stored: 'www.example.com'
    },
    { title: 'rejects an invalid hostname', value: 'not_a host', invalid: true }
  ]),
  defineCases('domain', string, [
    {
      title: 'stores a valid domain',
      value: 'example.com',
      stored: 'example.com'
    },
    { title: 'rejects an invalid domain', value: 'example', invalid: true }
  ]),
  defineCases('tel', string, [
    {
      title: 'stores a phone number',
      value: '+41 44 123 45 67',
      stored: '+41 44 123 45 67'
    }
  ]),
  defineCases('password', string, [
    { title: 'stores the entered password', value: 'secret', stored: 'secret' }
  ]),
  defineCases('creditcard', string, [
    {
      title: 'stores a valid card number',
      value: '4111111111111111',
      stored: '4111111111111111'
    },
    {
      title: 'rejects an invalid card number',
      value: '4111111111111112',
      invalid: true
    }
  ])
]
