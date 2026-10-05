import { registerTypeComponent } from './types.js'
import { getAllPanelEntries } from './lookup.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('panel', {
  defaultNested: false,
  getPanelSchema: (api, schema) => schema
})
registerTypeComponent('list', {
  defaultNested: true,
  getPanelSchema: () => ({ type: 'panel', name: '$filters' })
})
registerTypeComponent('section', { defaultNested: false })

describe('getAllPanelEntries()', () => {
  const getPaths = entries =>
    entries.map(({ dataPath, componentPath }) => ({ dataPath, componentPath }))

  it('adds the names of panel components once to their paths', () => {
    // Unnested components add their name to their component path, but not to
    // their data path, so the panel is addressed relative to the data path.
    const links = { type: 'panel', name: 'links' }
    expect(
      getPaths(getAllPanelEntries(null, links, 'book', 'main', 'main/links'))
    ).toEqual([{ dataPath: 'book/links', componentPath: 'main/links' }])
  })

  it('continues the paths of nested components for type panels', () => {
    const books = { type: 'list', name: 'books' }
    expect(
      getPaths(
        getAllPanelEntries(
          null,
          books,
          'shelf/books',
          'main/books',
          'main/books'
        )
      )
    ).toEqual([
      {
        dataPath: 'shelf/books/$filters',
        componentPath: 'main/books/$filters'
      }
    ])
  })

  it('continues the component path of components for their panels', () => {
    const section = {
      type: 'section',
      name: 'section',
      panels: { info: { type: 'panel' } }
    }
    expect(
      getPaths(
        getAllPanelEntries(null, section, 'book', 'main', 'main/section')
      )
    ).toEqual([{ dataPath: 'book/info', componentPath: 'main/section/info' }])
  })
})
