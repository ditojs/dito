import { vi } from 'vitest'
import { registerTypeComponent } from './types.js'
import {
  hasComponentNamed,
  iterateSchemaComponents,
  iterateNestedSchemaComponents,
  findNestedSchemaComponent,
  someNestedSchemaComponent,
  everyNestedSchemaComponent,
  hasNestedSchemaComponents,
  isSchema,
  isForm,
  isView,
  isTab,
  isPanel,
  isPanelWithOwnData,
  isMenu,
  getSchemaIdentifier,
  isSingleComponentView,
  isCompact,
  isInlined,
  isNested,
  hasLabel,
  omitSpacing,
  getTabSchemas,
  getPanelSchemas,
  isObjectSource,
  isListSource,
  isSourceWithResource
} from './structure.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true, generateLabel: true })
registerTypeComponent('section', { defaultNested: false })
registerTypeComponent('label', { omitSpacing: true })
registerTypeComponent('list', {
  defaultNested: true,
  generateLabel: true,
  getSourceType: () => 'list'
})
registerTypeComponent('object', {
  defaultNested: true,
  getSourceType: () => 'object'
})

describe('hasComponentNamed()', () => {
  const schema = {
    type: 'form',
    components: {
      title: { type: 'text' },
      unnested: {
        type: 'section',
        components: {
          note: { type: 'text' },
          inner: {
            type: 'section',
            components: { remark: { type: 'text' } }
          }
        }
      },
      nested: {
        type: 'section',
        nested: true,
        components: { subtitle: { type: 'text' } }
      }
    },
    tabs: {
      tab: {
        type: 'tab',
        components: { edition: { type: 'text' } }
      }
    }
  }

  it('finds components and components in tabs', () => {
    expect(hasComponentNamed(schema, 'title')).toBe(true)
    expect(hasComponentNamed(schema, 'edition')).toBe(true)
  })

  it('finds components of unnested components', () => {
    expect(hasComponentNamed(schema, 'note')).toBe(true)
    expect(hasComponentNamed(schema, 'remark')).toBe(true)
  })

  it('finds nested components, but not their components', () => {
    expect(hasComponentNamed(schema, 'nested')).toBe(true)
    expect(hasComponentNamed(schema, 'subtitle')).toBe(false)
  })

  it('ignores the names of unnested components', () => {
    expect(hasComponentNamed(schema, 'unnested')).toBe(false)
    expect(hasComponentNamed(schema, 'unknown')).toBe(false)
  })
})

describe('iterateSchemaComponents()', () => {
  it('passes the components with their names and relative levels', () => {
    const title = { type: 'text' }
    const books = { type: 'list' }
    const callback = vi.fn()
    iterateSchemaComponents(
      [
        { type: 'form', components: { title } },
        // Single component views pass their component one level up:
        { type: 'view', name: 'books', component: books },
        // Values that aren't schemas are skipped:
        null
      ],
      callback
    )
    expect(callback.mock.calls).toEqual([
      [title, 'title', 1],
      [books, 'books', 0]
    ])
  })

  it("stops at and returns the first result that isn't `undefined`", () => {
    const callback = vi.fn((component, name) =>
      name === 'isbn' ? false : undefined
    )
    const result = iterateSchemaComponents(
      [
        {
          type: 'form',
          components: {
            title: { type: 'text' },
            isbn: { type: 'text' },
            pages: { type: 'text' }
          }
        }
      ],
      callback
    )
    expect(result).toBe(false)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('stops at the components of single component views', () => {
    const result = iterateSchemaComponents(
      [{ type: 'view', name: 'books', component: { type: 'list' } }],
      (component, name) => name
    )
    expect(result).toBe('books')
  })
})

describe('nested schema component lookups', () => {
  const title = { type: 'text' }
  const summary = { type: 'text', label: 'Summary' }
  const chapters = { type: 'list' }
  const schema = {
    type: 'form',
    components: { title, chapters },
    tabs: { notes: { type: 'tab', components: { summary } } }
  }

  it('iterate the components of the schema and of its tabs', () => {
    const names = []
    iterateNestedSchemaComponents(schema, (component, name) => {
      names.push(name)
    })
    expect(names).toEqual(['title', 'chapters', 'summary'])
    expect(iterateNestedSchemaComponents(null, () => true)).toBe(undefined)
  })

  it('find the first component that matches', () => {
    expect(findNestedSchemaComponent(schema, isListSource)).toBe(chapters)
    expect(
      findNestedSchemaComponent(schema, component => !!component.label)
    ).toBe(summary)
    expect(findNestedSchemaComponent(schema, isObjectSource)).toBe(null)
  })

  it('tell whether some or every component matches', () => {
    expect(someNestedSchemaComponent(schema, isListSource)).toBe(true)
    expect(someNestedSchemaComponent(schema, isObjectSource)).toBe(false)
    expect(
      someNestedSchemaComponent(schema, (component, name) => name === 'title')
    ).toBe(true)
    expect(everyNestedSchemaComponent(schema, isNested)).toBe(true)
    expect(everyNestedSchemaComponent(schema, isListSource)).toBe(false)
  })

  it('tell whether there are any components', () => {
    expect(hasNestedSchemaComponents(schema)).toBe(true)
    expect(hasNestedSchemaComponents({ type: 'form', components: {} })).toBe(
      false
    )
    expect(hasNestedSchemaComponents({ type: 'form' })).toBe(false)
  })
})

describe('schema type predicates', () => {
  it('only consider objects with a string `type` schemas', () => {
    expect(isSchema({ type: 'form' })).toBe(true)
    expect(isSchema({ components: {} })).toBe(false)
    expect(isSchema('form')).toBe(false)
    expect(isSchema(null)).toBe(false)
  })

  it('tell schemas apart by their type', () => {
    expect(isForm({ type: 'form' })).toBe(true)
    expect(isView({ type: 'view' })).toBe(true)
    expect(isTab({ type: 'tab' })).toBe(true)
    expect(isPanel({ type: 'panel' })).toBe(true)
    expect(isMenu({ type: 'menu' })).toBe(true)
    expect(isForm({ type: 'view' })).toBe(false)
    expect(isMenu(null)).toBe(false)
  })

  it('tell panels with their own data apart', () => {
    expect(isPanelWithOwnData({ type: 'panel', data: () => ({}) })).toBe(true)
    expect(isPanelWithOwnData({ type: 'panel' })).toBe(false)
    expect(isPanelWithOwnData({ type: 'form', data: {} })).toBe(false)
  })

  it('tell single component views apart', () => {
    const list = { type: 'list' }
    expect(isSingleComponentView({ type: 'view', component: list })).toBe(true)
    expect(isSingleComponentView({ type: 'view', components: {} })).toBe(false)
    expect(isSingleComponentView({ type: 'form', component: list })).toBe(
      false
    )
  })

  it('tell sources apart by the source type of their type', () => {
    expect(isListSource({ type: 'list' })).toBe(true)
    expect(isListSource('list')).toBe(true)
    expect(isObjectSource({ type: 'object' })).toBe(true)
    expect(isObjectSource({ type: 'list' })).toBe(false)
    expect(isListSource({ type: 'text' })).toBe(false)
    expect(isListSource({ type: 'unregistered' })).toBe(false)
  })

  it('tell sources with their own resource apart', () => {
    expect(isSourceWithResource({ type: 'list', resource: 'books' })).toBe(true)
    expect(isSourceWithResource({ type: 'list' })).toBe(false)
    expect(isSourceWithResource({ type: 'text', resource: 'books' })).toBe(
      false
    )
  })
})

describe('schema setting predicates', () => {
  it('tell compact and inlined schemas apart', () => {
    expect(isCompact({ compact: true })).toBe(true)
    expect(isCompact({})).toBe(false)
    expect(isInlined({ inlined: true })).toBe(true)
    expect(isInlined({ components: {} })).toBe(true)
    expect(isInlined({ form: {} })).toBe(false)
  })

  it('use `nested` or the default of the type for nesting', () => {
    expect(isNested({ type: 'text' })).toBe(true)
    expect(isNested({ type: 'section' })).toBe(false)
    expect(isNested({ type: 'section', nested: true })).toBe(true)
    expect(isNested({ type: 'unregistered' })).toBe(false)
  })

  it('tell components with labels apart, also generated ones', () => {
    expect(hasLabel({ type: 'section', label: 'Details' }, false)).toBe(true)
    expect(hasLabel({ type: 'text' }, false)).toBe(false)
    expect(hasLabel({ type: 'text' }, true)).toBe(true)
    expect(hasLabel({ type: 'section' }, true)).toBeFalsy()
    expect(hasLabel({ type: 'text', label: false }, true)).toBe(false)
  })

  it('tell components without spacing apart by their type', () => {
    expect(omitSpacing({ type: 'label' })).toBe(true)
    expect(omitSpacing({ type: 'text' })).toBe(false)
  })
})

describe('getTabSchemas() and getPanelSchemas()', () => {
  it('return the tabs and panels as arrays', () => {
    const notes = { type: 'tab' }
    const summary = { type: 'panel' }
    const schema = { tabs: { notes }, panels: { summary } }
    expect(getTabSchemas(schema)).toEqual([notes])
    expect(getPanelSchemas(schema)).toEqual([summary])
    expect(getTabSchemas({})).toEqual([])
    expect(getPanelSchemas(null)).toEqual([])
  })
})

describe('getSchemaIdentifier()', () => {
  it('identifies schemas by their JSON', () => {
    expect(getSchemaIdentifier({ type: 'form', name: 'book' })).toBe(
      '{"type":"form","name":"book"}'
    )
  })
})
