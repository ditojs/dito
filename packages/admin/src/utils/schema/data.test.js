import { registerTypeComponent } from './types.js'
import { processSchemaData, getComponentPathByDataPath } from './data.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('section', { defaultNested: false })
registerTypeComponent('list', {
  defaultNested: true,
  getSourceType: () => 'list'
})

const chapters = {
  type: 'list',
  form: {
    type: 'form',
    components: { title: { type: 'text' } }
  }
}

const schema = {
  type: 'form',
  components: {
    title: { type: 'text' },
    publishing: {
      type: 'section',
      components: { publisher: { type: 'text' } }
    }
  },
  tabs: {
    structure: { type: 'tab', components: { chapters } },
    layout: { type: 'tab', components: { chapters } }
  },
  panels: {
    info: { type: 'panel', components: { note: { type: 'text' } } }
  }
}

const data = {
  title: 'Book',
  publisher: 'Publisher',
  note: 'Note',
  chapters: [{ title: 'One' }, { title: 'Two' }]
}

describe('processSchemaData()', () => {
  it('passes the component paths of components, tabs and panels', () => {
    const componentPaths = {}
    processSchemaData(schema, data, {
      dataPath: '',
      componentPath: 'book',
      shouldProcess: ({ componentPath, dataPath }) => {
        componentPaths[componentPath] = dataPath
        return true
      },
      options: { component: null }
    })
    expect(componentPaths).toEqual({
      'book/title': 'title',
      'book/publishing': '',
      'book/publishing/publisher': 'publisher',
      'book/structure': '',
      'book/structure/chapters': 'chapters',
      'book/structure/chapters/0/title': 'chapters/0/title',
      'book/structure/chapters/1/title': 'chapters/1/title',
      'book/layout': '',
      'book/layout/chapters': 'chapters',
      'book/layout/chapters/0/title': 'chapters/0/title',
      'book/layout/chapters/1/title': 'chapters/1/title',
      'book/info': '',
      'book/info/note': 'note'
    })
  })
})

describe('getComponentPathByDataPath()', () => {
  const getComponentPath = (dataPath, options) =>
    getComponentPathByDataPath(schema, data, dataPath, options)

  it('adds the names of tabs and unnested components', () => {
    expect(getComponentPath('title')).toBe('title')
    expect(getComponentPath('publisher')).toBe('publishing/publisher')
    expect(getComponentPath('note')).toBe('info/note')
  })

  it('appends the item indices of list items', () => {
    expect(getComponentPath('chapters/1')).toBe('structure/chapters/1')
    expect(getComponentPath('chapters/1/title')).toBe(
      'structure/chapters/1/title'
    )
  })

  it('uses the first component in schema order', () => {
    expect(getComponentPath('chapters')).toBe('structure/chapters')
  })

  it('appends the data path of values without component', () => {
    expect(getComponentPath('unknown/0')).toBe('unknown/0')
    expect(getComponentPath('chapters/0/unknown')).toBe(
      'structure/chapters/0/unknown'
    )
  })

  it('continues `componentPath`', () => {
    expect(getComponentPath('chapters/0', { componentPath: 'main' })).toBe(
      'main/structure/chapters/0'
    )
    expect(getComponentPathByDataPath(schema, null, 'chapters/0')).toBe(
      'chapters/0'
    )
  })
})
