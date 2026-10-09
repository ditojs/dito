import verbs from './verbs.js'

describe('verbs', () => {
  it('maps the verbs and their past forms to themselves', () => {
    expect(verbs.save).toBe('save')
    expect(verbs.saved).toBe('saved')
    expect(verbs.cancelled).toBe('cancelled')
    expect(verbs['logged in']).toBe('logged in')
    for (const [key, value] of Object.entries(verbs)) {
      expect(value).toBe(key)
    }
  })
})
