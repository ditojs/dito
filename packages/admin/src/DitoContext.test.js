import DitoContext from './DitoContext.js'

describe('DitoContext', () => {
  describe('value', () => {
    it('reads the value of nested components from the root data', () => {
      const rootData = { items: [{ title: 'Book' }] }
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'items/0/title'
      })
      expect(context.value).toBe('Book')
    })

    it('reads the values of components, also while they are `undefined`', () => {
      // E.g. a computed value that the data model hasn't written yet, which is
      // not read through the data path.
      const component = { value: undefined }
      const rootData = { items: [{ status: 'Stale' }] }
      const context = new DitoContext(component, {
        rootData,
        dataPath: 'items/0/status'
      })
      expect(context.value).toBe(undefined)
      component.value = 'Published'
      expect(context.value).toBe('Published')
    })

    it('is `undefined` for values missing in the root data', () => {
      // E.g. computed values that the data model hasn't written yet.
      const rootData = { items: [{}] }
      const context = new DitoContext(null, {
        rootData,
        dataPath: 'items/0/status'
      })
      expect(context.value).toBe(undefined)
    })
  })
})
