import { registerTypeComponent } from './types.js'
import { hasComponentNamed } from './structure.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('section', { defaultNested: false })

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
