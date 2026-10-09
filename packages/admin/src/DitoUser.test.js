import DitoUser from './DitoUser.js'

function createUser(roles) {
  return Object.assign(new DitoUser(), { roles })
}

describe('DitoUser', () => {
  describe('hasRole()', () => {
    it('checks whether the user has any of the roles', () => {
      const user = createUser(['editor', 'librarian'])
      expect(user.hasRole('editor')).toBe(true)
      expect(user.hasRole('admin', 'librarian')).toBe(true)
      expect(user.hasRole('admin')).toBe(false)
      expect(user.hasRole()).toBe(false)
    })

    it('returns `false` for users without roles', () => {
      expect(createUser(undefined).hasRole('editor')).toBe(false)
      expect(createUser([]).hasRole('editor')).toBe(false)
    })
  })
})
