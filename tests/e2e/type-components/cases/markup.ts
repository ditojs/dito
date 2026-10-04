import { defineCases } from './define.js'

const marks = {
  bold: true,
  italic: true,
  strike: true,
  underline: true,
  link: true
}

export default [
  defineCases('markup', { type: 'text' }, [
    {
      title: 'stores typed text as a paragraph',
      value: 'Hello',
      stored: '<p>Hello</p>',
      shown: '<p>Hello</p>'
    },
    {
      title: 'stores bold text',
      schema: { marks },
      value: ['Hello ', { button: 'Bold' }, 'world'],
      stored: '<p>Hello <strong>world</strong></p>',
      shown: '<p>Hello <strong>world</strong></p>'
    },
    {
      title: 'stores italic text',
      schema: { marks },
      value: ['Hello ', { button: 'Italic' }, 'world'],
      stored: '<p>Hello <em>world</em></p>',
      shown: '<p>Hello <em>world</em></p>'
    },
    {
      title: 'stores underlined text',
      schema: { marks },
      value: ['Hello ', { button: 'Underline' }, 'world'],
      stored: '<p>Hello <u>world</u></p>',
      shown: '<p>Hello <u>world</u></p>'
    },
    {
      title: 'stores struck text',
      schema: { marks },
      value: ['Hello ', { button: 'Strike' }, 'world'],
      stored: '<p>Hello <s>world</s></p>',
      shown: '<p>Hello <s>world</s></p>'
    },
    {
      title: 'stores a link',
      schema: { marks },
      value: [
        'Visit ',
        { link: { text: 'Lineto', href: 'https://lineto.com' } }
      ],
      stored: '<p>Visit <a href="https://lineto.com">Lineto</a></p>',
      shown: '<p>Visit <a href="https://lineto.com">Lineto</a></p>'
    },
    {
      title: 'stores headings',
      schema: { nodes: { heading: [1, 2, 3] } },
      value: [{ button: 'Heading 1' }, 'Title'],
      stored: '<h1>Title</h1>',
      shown: '<h1>Title</h1>'
    },
    {
      title: 'stores bullet lists',
      schema: { nodes: { bulletList: true } },
      value: [{ button: 'Bullet List' }, 'One', { press: 'Enter' }, 'Two'],
      stored: '<ul><li><p>One</p></li><li><p>Two</p></li></ul>',
      shown: '<ul><li><p>One</p></li><li><p>Two</p></li></ul>'
    },
    {
      title: 'stores ordered lists',
      schema: { nodes: { orderedList: true } },
      value: [{ button: 'Ordered List' }, 'One', { press: 'Enter' }, 'Two'],
      stored: '<ol><li><p>One</p></li><li><p>Two</p></li></ol>',
      shown: '<ol><li><p>One</p></li><li><p>Two</p></li></ol>'
    },
    {
      title: 'stores blockquotes',
      schema: { nodes: { blockquote: true } },
      value: [{ button: 'Blockquote' }, 'Quote'],
      stored: '<blockquote><p>Quote</p></blockquote>',
      shown: '<blockquote><p>Quote</p></blockquote>'
    },
    {
      title: 'shows stored formatted text',
      schema: { marks },
      seed: '<p>Hello <strong>world</strong></p>',
      shown: '<p>Hello <strong>world</strong></p>'
    },
    {
      title: 'processes the value with process',
      schema: {
        process: ({ value }: { value: string }) => value.toUpperCase()
      },
      value: 'Hello',
      stored: '<P>HELLO</P>',
      shown: '<p>HELLO</p>'
    }
  ])
]
