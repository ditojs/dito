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
